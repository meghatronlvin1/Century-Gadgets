import "dotenv/config";
import express from "express";
import path from "path";
import { apiRouter } from "./src/server/routes.ts";

const PORT = Number(process.env.PORT) || 3000;

export function createApp() {
  const app = express();

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  // CORS for mobile clients & admin dashboard
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-cart-session,x-century-signature");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: "4mb" }));

  // Lightweight in-memory rate limiter per IP for API endpoints
  const hits = new Map<string, { count: number; resetAt: number }>();
  app.use("/api/v1", (req, res, next) => {
    const ip = req.ip || "unknown";
    const now = Date.now();
    const record = hits.get(ip);
    if (!record || record.resetAt < now) {
      hits.set(ip, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    record.count += 1;
    if (record.count > 240) {
      return res.status(429).json({ error: "Too many requests. Please try again shortly." });
    }
    next();
  });

  // Redacted API request logging
  app.use("/api/v1", (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      if (process.env.NODE_ENV !== "test") {
        console.log(`[API] ${req.method} ${req.originalUrl.split("?")[0]} -> ${res.statusCode} (${Date.now() - start}ms)`);
      }
    });
    next();
  });

  // Serve validated uploaded swap images
  app.use("/uploads", express.static(path.resolve(process.cwd(), "public", "uploads")));

  // Versioned REST API
  app.use("/api/v1", apiRouter);

  return app;
}

async function startServer() {
  const app = createApp();

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Century Gadgets server running on http://0.0.0.0:${PORT}`);
  });
}

// Start HTTP server unless imported directly by test suite
const isMainModule = process.argv[1] && (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));
if (isMainModule) {
  startServer().catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
}
