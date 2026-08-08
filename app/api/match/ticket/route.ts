import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { signTicket, TICKET_TTL_SECONDS } from "@/lib/match-ticket";

export const dynamic = "force-dynamic";

/**
 * Mints a short-lived ticket the client hands to the Colyseus room.
 *
 * The session is read server-side from the cookie; the browser never sees
 * anything it could reuse beyond this ticket's 60 seconds.
 */
export async function POST() {
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Sign in to join a match." },
      { status: 401 },
    );
  }

  try {
    const ticket = await signTicket({
      userId: session.user.id,
      username:
        (session.user as { displayUsername?: string }).displayUsername ||
        session.user.name ||
        "Manager",
    });

    // userId is returned so the client can tell which slot is its own. It is
    // not a credential — the ticket is.
    return NextResponse.json({
      ticket,
      userId: session.user.id,
      expiresIn: TICKET_TTL_SECONDS,
    });
  } catch (error) {
    // A missing shared secret is a deployment fault, not a user error — say so
    // rather than returning a confusing 401.
    console.error("[match] could not mint ticket:", error);
    return NextResponse.json(
      { error: "Match tickets are not configured on this deployment." },
      { status: 500 },
    );
  }
}
