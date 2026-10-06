import http from "node:http";
import "dotenv/config";
import { Server } from "socket.io";

import app from "./app.js";
import { pool } from "./config/db.js";

const port = Number(process.env.PORT || 4000);
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN ? (process.env.CORS_ORIGIN.includes(",") ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim()) : process.env.CORS_ORIGIN) : "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

async function startServer() {
  try {
    await pool.query("SELECT 1");

    httpServer.listen(port, () => {
      console.log(`ProxiFix API running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Could not connect to PostgreSQL:", error.message);
    process.exit(1);
  }
}

startServer();