import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived tickets that let the Colyseus server trust a Better Auth session
 * without sharing a cookie, a database or a network round trip.
 *
 * The match server runs on Render, separate from the app on Vercel, so it can't
 * read the session cookie — which is httpOnly and deliberately unreadable by
 * client JavaScript. The alternatives were worse: a bearer token in
 * localStorage is exposed to any XSS, and letting the match server query Neon
 * couples the live engine to the database for something it only needs to check
 * once per join.
 *
 * So the app mints a signed ticket from the real session, the client passes it
 * when joining, and the room verifies it with a shared secret. Nothing
 * long-lived ever reaches the browser.
 *
 * The ticket asserts identity ONLY. It carries no match state and confers no
 * authority — per docs/concerns/01-fairness-anticheat.md the room remains the
 * single source of truth, and a client that forged one would still only be
 * claiming *who it is*, never what happened.
 */

export const TICKET_TTL_SECONDS = 60;

const ISSUER = "futtrade-app";
const AUDIENCE = "futtrade-match";

export type TicketClaims = {
  userId: string;
  username: string;
};

/**
 * A short, non-reversible fingerprint of the shared secret. The match server
 * publishes the same value on /healthz, so a mismatch between the two
 * deployments can be SEEN rather than inferred from a failed join. Eight hex
 * characters of a SHA-256 over a 256-bit random secret reveals nothing usable.
 */
export function secretFingerprint(): string | null {
  const value = process.env.MATCH_TICKET_SECRET;
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function secret(): Uint8Array {
  const value = process.env.MATCH_TICKET_SECRET;
  if (!value) {
    throw new Error(
      "MATCH_TICKET_SECRET is not set. It must be identical in the Next.js app and the Colyseus server.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function signTicket(claims: TicketClaims): Promise<string> {
  return new SignJWT({ username: claims.username })
    .setProtectedHeader({ alg: "HS256" })
    // A unique id so the match server can spend the ticket on first use and
    // refuse a replay. Without it, a captured ticket is usable repeatedly for
    // its whole lifetime.
    .setJti(randomUUID())
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    // Deliberately brief: a ticket is spent immediately on joining, so a long
    // window would only widen the replay opportunity for no benefit.
    .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifyTicket(token: string): Promise<TicketClaims> {
  const { payload } = await jwtVerify(token, secret(), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (!payload.sub) throw new Error("ticket has no subject");

  return {
    userId: payload.sub,
    username: typeof payload.username === "string" ? payload.username : "",
  };
}
