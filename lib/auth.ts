import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { getDb, schema } from "./db";
import { mailConfigured, sendResetPasswordEmail, sendVerificationEmail } from "./mail";
import { isReservedUsername, USERNAME_MAX, USERNAME_MIN, isValidUsername } from "./username";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * When mail isn't configured the link is logged instead of sent, so local
 * development still works end to end without credentials. It is never a silent
 * no-op: a link that goes nowhere and says nothing is how you end up believing
 * verification works when it doesn't.
 */
async function deliver(
  kind: "verification" | "reset",
  email: string,
  url: string,
  send: (to: string, url: string) => Promise<string>,
) {
  if (!mailConfigured()) {
    console.warn(
      `[auth] GMAIL_USER/GMAIL_APP_PASSWORD not set — ${kind} link for ${email} not sent:\n${url}`,
    );
    return;
  }
  try {
    await send(email, url);
  } catch (error) {
    // Surface the reason; Gmail auth failures are otherwise invisible to the
    // caller, which just sees a successful sign-up and an inbox that stays empty.
    console.error(`[auth] failed to send ${kind} email to ${email}:`, error);
    throw error;
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema,
  }),

  emailAndPassword: {
    enabled: true,
    // Nobody signs in until they've proved they own the address.
    requireEmailVerification: true,
    // No auto sign-in: they can't sign in yet anyway, and signing them in only
    // to block them immediately would be incoherent.
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await deliver("reset", user.email, url, sendResetPasswordEmail);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    expiresIn: ONE_DAY_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await deliver("verification", user.email, url, sendVerificationEmail);
    },
  },

  plugins: [
    username({
      minUsernameLength: USERNAME_MIN,
      maxUsernameLength: USERNAME_MAX,
      // Uniqueness itself is enforced by the plugin against a unique column —
      // checking before insert would race under concurrent signups.
      usernameValidator: (value) =>
        isValidUsername(value) && !isReservedUsername(value),
    }),
  ],

  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});

export type Session = typeof auth.$Infer.Session;
