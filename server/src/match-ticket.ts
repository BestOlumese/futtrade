import { createHash } from "node:crypto";
import { jwtVerify } from "jose";

/**
 * Verification half of the app's match ticket. Mirrors lib/match-ticket.ts in
 * the Next.js package — the two are separate deployments and share no code, so
 * the issuer, audience and secret must stay in step. They are asserted here
 * rather than assumed.
 *
 * The ticket asserts identity ONLY. It carries no match state and confers no
 * authority: per docs/concerns/01-fairness-anticheat.md this room is the single
 * source of truth, and a forged ticket would still only be a claim about who
 * the client is, never about what happened in the match.
 */

const ISSUER = "futtrade-app";
const AUDIENCE = "futtrade-match";

export type TicketClaims = {
  userId: string;
  username: string;
};

/**
 * A short, non-reversible fingerprint of the shared secret.
 *
 * The app publishes the same fingerprint, so a mismatch between the two
 * deployments can be SEEN rather than inferred from a failed join. Eight hex
 * characters of a SHA-256 over a 256-bit random secret reveals nothing usable —
 * and the alternative, guessing whether two invisible env vars are equal, is
 * how an afternoon disappears.
 */
export function secretFingerprint(): string | null {
  const value = process.env.MATCH_TICKET_SECRET;
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex").slice(0, 8);
}

export async function verifyTicket(token: string): Promise<TicketClaims> {
  const value = process.env.MATCH_TICKET_SECRET;
  if (!value) {
    // Deliberately distinguished from a bad signature: this is a deployment
    // fault, not a suspicious client, and the two need different fixes.
    throw new Error(
      "NOT_CONFIGURED: MATCH_TICKET_SECRET is not set on the match server. It must be identical to the value in the Next.js app.",
    );
  }

  const { payload } = await jwtVerify(token, new TextEncoder().encode(value), {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (!payload.sub) throw new Error("ticket has no subject");

  return {
    userId: payload.sub,
    username: typeof payload.username === "string" ? payload.username : "",
  };
}
