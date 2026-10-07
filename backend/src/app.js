import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { resolve } from "node:path";

import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import workersRoutes from "./routes/workers.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";

const app = express();
const uploadsDirectory = resolve(import.meta.dirname, "../uploads");
const frontendBuildDirectory = resolve(import.meta.dirname, "../../frontend/location-app/dist");

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN ? (process.env.CORS_ORIGIN.includes(",") ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : process.env.CORS_ORIGIN) : true,
  credentials: true
}));

app.use(express.json({
  limit: "1mb"
}));

app.use("/uploads", express.static(uploadsDirectory, {
  setHeaders(response) {
    response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  },
}));

const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Dashboards poll for live service updates, so normal customer and worker use
  // can exceed a small per-IP limit during a 15-minute window.
  max: Number(process.env.API_RATE_LIMIT_MAX || 1200),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please wait a moment and try again.",
  },
});

app.get("/api/health", (request, response) => {
  response.json({
    success: true,
    message: "ProxiFix API is running"
  });
});

app.use("/api", apiRateLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/workers", workersRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationsRoutes);

// The production build is served by the API server. This lets one Cloudflare
// Tunnel hostname serve the React application, API, uploads, and SPA routes.
import { existsSync } from "node:fs";

// The production build is served if it exists. Otherwise, provide API root info.
if (existsSync(resolve(frontendBuildDirectory, "index.html"))) {
  app.use(express.static(frontendBuildDirectory));

  app.get("/{*path}", (request, response, next) => {
    if (request.path.startsWith("/api") || request.path.startsWith("/uploads")) {
      return next();
    }

    return response.sendFile(resolve(frontendBuildDirectory, "index.html"), (error) => {
      if (error) next(error);
    });
  });
} else {
  app.get("/", (request, response) => {
    response.json({
      success: true,
      message: "ProxiFix API server is running.",
      health: "/api/health"
    });
  });
}

app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: "Route not found"
  });
});

export default app;
