"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL: the auth routes are same-origin with the app, so the client
// resolves them relative to wherever it's served from. That keeps localhost,
// Vercel previews, and production working without a per-environment variable.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
