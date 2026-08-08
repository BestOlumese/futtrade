import { createServer } from "node:http";
import express from "express";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { BootstrapRoom } from "./rooms/BootstrapRoom.js";
import { MatchRoom } from "./rooms/MatchRoom.js";
import { secretFingerprint } from "./match-ticket.js";

const port = Number(process.env.PORT) || 2567;

// Render injects PORT and requires binding 0.0.0.0, not localhost.
const host = "0.0.0.0";

const app = express();

/**
 * CORS for the Colyseus HTTP endpoints (matchmaking seat reservation runs over
 * HTTP before the socket upgrade, so the browser enforces CORS on it).
 *
 * ALLOWED_ORIGINS is a comma-separated list. Unset means allow any origin,
 * which is fine for local dev but should always be set in production.
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
  o.trim(),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!allowedOrigins) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Render's health check hits this. Keep it dependency-free and instant — it
// must not touch the database, or a slow Neon wake would fail the deploy.
app.get("/healthz", (_req, res) => {
  // `ticketSecret` lets the app and this server be compared without either
  // exposing the secret. Same fingerprint = same value; different = the join
  // will fail no matter how correct everything else looks.
  const fingerprint = secretFingerprint();
  res.json({
    status: "ok",
    uptime: process.uptime(),
    ticketSecret: fingerprint ? { configured: true, fingerprint } : { configured: false },
  });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("bootstrap", BootstrapRoom);
gameServer.define("match", MatchRoom);

gameServer
  .listen(port, host)
  .then(() => {
    console.log(`[colyseus] listening on ${host}:${port}`);
  })
  .catch((error: unknown) => {
    console.error("[colyseus] failed to start:", error);
    process.exit(1);
  });

// Render sends SIGTERM on deploy and on idle spin-down. Shutting down
// gracefully lets Colyseus notify connected clients instead of dropping them.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[colyseus] ${signal} received, shutting down`);
    void gameServer.gracefullyShutdown().then(() => process.exit(0));
  });
}
