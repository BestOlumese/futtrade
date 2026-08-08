"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { AuthPanel } from "@/components/auth/auth-panel";
import { notify } from "@/components/ui/toaster";
import { PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Step 2 of 2 — reached from the emailed link, which carries the token.
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirm) {
      notify.problem("Those two passwords don't match");
      return;
    }

    setPending(true);

    const { error: resetError } = await authClient.resetPassword({
      newPassword: password,
      token: token ?? undefined,
    });

    if (resetError) {
      notify.problem(
        "That password couldn't be set",
        resetError.message ?? "The link may have expired.",
      );
      setPending(false);
      return;
    }

    notify.ok("Password updated", "Sign in with your new password.");
    router.push("/sign-in");
  }

  // A missing or already-used token states the actual situation and the next
  // step, rather than failing vaguely on submit.
  if (!token) {
    return (
      <AuthPanel
        title="Link expired"
        intro="That reset link is missing its token, or it has already been used. Reset links are good for one hour and work once."
        footer={
          <Link
            href="/sign-in"
            className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <Link href="/forgot-password" className="block">
          <Button type="button">Send a new link</Button>
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      title="Set a new password"
      footer={
        <Link
          href="/sign-in"
          className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="At least 8 characters."
        />
        <PasswordField
          id="confirm"
          label="Confirm new password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "Setting password…" : "Set password"}
        </Button>
      </form>
    </AuthPanel>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel title="Set a new password">
          <p className="font-sans text-sm text-floodlight/55">Loading…</p>
        </AuthPanel>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
