import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb, schema } from "./db";

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    // Phase 00 proves the pipeline; email delivery is not wired yet, so
    // verification stays off until there's a mail provider to verify against.
    requireEmailVerification: false,

    /**
     * No mail provider exists yet, so the reset link is logged server-side.
     * The flow is genuinely complete end to end — the token is real and
     * /reset-password consumes it — but the link has to be copied from the
     * server console rather than an inbox.
     *
     * Swap this for a real sender (Resend/Postmark) before any real user
     * touches it: today a reset link is only visible to whoever can read the
     * logs, which is fine for one developer and wrong for anyone else.
     */
    sendResetPassword: async ({ user, url }) => {
      console.log(`[auth] password reset for ${user.email}: ${url}`);
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

export type Session = typeof auth.$Infer.Session;
