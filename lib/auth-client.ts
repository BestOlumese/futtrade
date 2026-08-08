"use client";

import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

// No baseURL: the auth routes are same-origin with the app, so the client
// resolves them relative to wherever it's served from. That keeps localhost,
// Vercel previews, and production working without a per-environment variable.
export const authClient = createAuthClient({
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;

/** Where a verification link should land: signed out, on sign-in, explained. */
export const VERIFY_CALLBACK = "/sign-in?verified=1";
