"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthPanel, AuthError } from "@/components/auth/auth-panel";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Step 1 of 2 — email entry, with the confirmation shown in-panel rather than
 * as a redirect. See docs/06-auth-pages.md § Reset password.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: resetError } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/reset-password",
    });

    if (resetError) {
      setError(resetError.message ?? "That reset link couldn't be sent.");
      setPending(false);
      return;
    }

    setSent(true);
    setPending(false);
  }

  if (sent) {
    return (
      <AuthPanel
        title="Check your email"
        intro={`If an account exists for ${email}, a reset link is on its way. The link is good for one hour.`}
        footer={
          <Link
            href="/sign-in"
            className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <button
          type="button"
          onClick={() => setSent(false)}
          className="self-start font-sans text-sm text-signal underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Reset password"
      intro="Enter the email on your account and we'll send a link to set a new password."
      footer={
        <Link
          href="/sign-in"
          className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {error ? <AuthError>{error}</AuthError> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Sending link…" : "Send reset link"}
        </Button>
      </form>
    </AuthPanel>
  );
}
