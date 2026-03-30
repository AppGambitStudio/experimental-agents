// Server entry point — Hono HTTP server for the legal contract agent web UI.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { uploadRoutes } from "./routes/upload.js";
import { sessionRoutes } from "./routes/sessions.js";

const app = new Hono();

// CORS for local dev
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Mount routes
app.route("/api/upload", uploadRoutes);
app.route("/api/sessions", sessionRoutes);

// Health check
app.get("/api/health", (c) =>
  c.json({ status: "ok", service: "legal-contract-agent", timestamp: new Date().toISOString() }),
);

// Start server
const PORT = Number(process.env.PORT) || 4101;

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Legal Contract Agent server listening on http://localhost:${info.port}`);
});

export { app };
