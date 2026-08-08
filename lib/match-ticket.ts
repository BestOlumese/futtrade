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
