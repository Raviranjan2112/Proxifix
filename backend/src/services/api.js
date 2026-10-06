import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import adminRoutes from "./routes/admin.routes.js";
import authRoutes from "./routes/auth.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import servicesRoutes from "./routes/services.routes.js";
import workersRoutes from "./routes/workers.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/api/health", (request, response) => {
  response.json({
    success: true,
    message: "ProxiFix API is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/workers", workersRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/admin", adminRoutes);

app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((error, request, response, next) => {
  console.error(error);

  response.status(error.status || 500).json({
    success: false,
    message: error.message || "Internal server error",
  });
});

export default app;