"use client";

import { useEffect, useState } from "react";
import { authClient, VERIFY_CALLBACK } from "@/lib/auth-client";
import { notify } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";

const COOLDOWN_SECONDS = 60;

/**
 * Resends a verification email, with a cooldown.
 *
 * The cooldown isn't decoration: Gmail's sending cap is roughly 500 a day, and
 * an un-throttled resend button is the fastest way to spend it. The remaining
 * seconds are shown rather than the button simply going dead.
 */
export function ResendVerification({ email }: { email: string }) {
  const [left, setLeft] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function resend() {
    if (left > 0 || sending) return;
    setSending(true);

    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: VERIFY_CALLBACK,
    });

    setSending(false);

    if (error) {
      notify.problem(
        "Couldn't send that email",
        error.message ?? "Try again in a moment.",
      );
      return;
    }

    setLeft(COOLDOWN_SECONDS);
    notify.ok("Verification email sent", `Check ${email}.`);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={resend}
      disabled={left > 0 || sending}
      className="w-full"
    >
      {sending
        ? "Sending…"
        : left > 0
          ? `Resend in ${left}s`
          : "Resend verification email"}
    </Button>
  );
}
