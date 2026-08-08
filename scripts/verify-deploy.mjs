/**
 * Phase 00 exit-criteria check, run against the DEPLOYED stack.
 *
 * Usage:
 *   node scripts/verify-deploy.mjs <vercel-url> <render-url>
 *
 * Checks the four things docs/phases/00-bootstrap.md actually requires, in the
 * order they're most likely to fail:
 *
 *   1. Colyseus health          — is the container up at all
 *   2. WebSocket round trip     — the piece that works on localhost and breaks
 *                                 in production, because Colyseus reserves a
 *                                 seat over HTTP first and the browser enforces
 *                                 CORS on it (ALLOWED_ORIGINS)
 *   3. App + Neon + timescaledb — /bootstrap renders the live status
 *   4. Inngest endpoint         — registered, in cloud mode, with a signing key
 *
 * The Inngest CRON RUN cannot be checked from here; that one is confirmed in
 * the Inngest dashboard.
 */

import dns from "node:dns";
import net from "node:net";

/* Same guard as lib/force-ipv4.ts. On a host with no IPv6 route, Node races an
   AAAA address that fails with ENETUNREACH and the whole fetch reports a bare
   "fetch failed" — which looks exactly like a dead server. Ordering alone isn't
   enough; auto-select has to be off too. */
if (process.env.FORCE_IPV4 !== "0") {
  dns.setDefaultResultOrder("ipv4first");
  net.setDefaultAutoSelectFamily(false);
}

const [, , appUrlRaw, serverUrlRaw] = process.argv;

if (!appUrlRaw || !serverUrlRaw) {
  console.error(
    "usage: node scripts/verify-deploy.mjs <vercel-url> <render-url>",
  );
  process.exit(1);
}

const app = appUrlRaw.replace(/\/$/, "");
const server = serverUrlRaw.replace(/\/$/, "");
const ws = server.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\nApp    ${app}\nServer ${server}\n`);

/* 1 — Colyseus health. First hit may pay a ~50s cold start on Render's free
       tier, so this is given a long budget. */
console.log("Colyseus");
let healthOk = false;
try {
  const started = Date.now();
  const res = await withTimeout(fetch(`${server}/healthz`), 90_000, "healthz");
  const body = await res.json();
  healthOk = res.ok && body.status === "ok";
  record(
    "health endpoint",
    healthOk,
    `${res.status} in ${Date.now() - started}ms, uptime ${Math.round(body.uptime ?? 0)}s`,
  );
} catch (error) {
  record("health endpoint", false, error.message);
}

/* 2 — The real handshake. */
if (healthOk) {
  try {
    const { Client } = await import("colyseus.js");
    const client = new Client(ws);
    const started = Date.now();
    const room = await withTimeout(client.joinOrCreate("bootstrap"), 60_000, "join");

    const reply = await withTimeout(
      new Promise((resolve) => {
        room.onMessage("pong", resolve);
        room.send("ping", { from: "verify-deploy" });
      }),
      30_000,
      "pong",
    );

    record(
      "websocket round trip",
      Boolean(reply?.roomId),
      `room ${reply.roomId}, ${Date.now() - started}ms`,
    );
    await room.leave();
  } catch (error) {
    record("websocket round trip", false, error.message);
  }
} else {
  record("websocket round trip", false, "skipped — server not healthy");
}

/* 3 — App, Neon and the timescaledb extension, as rendered by /bootstrap. */
console.log("\nApp");
try {
  const res = await withTimeout(fetch(`${app}/bootstrap`), 60_000, "bootstrap");
  const html = await res.text();
  record("app responds", res.ok, `${res.status}`);
  record("neon connected", html.includes("Connected"), null);
  record(
    "timescaledb enabled",
    html.includes("enabled") && !html.includes("missing"),
    null,
  );
} catch (error) {
  record("app responds", false, error.message);
}

/* 4 — Inngest endpoint state. */
try {
  const res = await withTimeout(fetch(`${app}/api/inngest`), 30_000, "inngest");

  /* A 401 here is the healthy production answer: once a signing key is set the
     SDK refuses unsigned introspection. An open endpoint returning JSON means
     no signing key is configured, which is the actual failure. */
  if (res.status === 401) {
    record("inngest endpoint", true, "401 — signing key set and enforced");
  } else {
    const body = await res.json().catch(() => ({}));
    record(
      "inngest endpoint",
      body.function_count > 0 && body.has_signing_key === true,
      `${body.function_count ?? "?"} function(s), mode ${body.mode ?? "?"}, signing key ${body.has_signing_key ? "present" : "MISSING"}`,
    );
  }
} catch (error) {
  record("inngest endpoint", false, error.message);
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} passed.` +
    (failed.length ? ` Failing: ${failed.map((f) => f.name).join(", ")}` : ""),
);
console.log(
  "\nStill to confirm by hand: one real bootstrap-heartbeat run in the Inngest dashboard.\n",
);

process.exit(failed.length ? 1 : 0);
