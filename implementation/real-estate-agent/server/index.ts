// Hono API server — serves agent session routes with SSE streaming

import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { sessionRoutes } from "./routes/sessions.js";

const app = new Hono();

// CORS for local dev (Vite + direct)
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// Mount session routes
app.route("/api/sessions", sessionRoutes);

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Start server
const port = Number(process.env.PORT) || 4100;
serve({ fetch: app.fetch, port }, () => {
  console.log(`Real Estate Agent API server running on http://localhost:${port}`);
});
