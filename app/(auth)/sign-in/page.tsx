"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ResendVerification } from "@/components/auth/resend-button";
import { Field, PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  /** Set when sign-in was refused for want of verification. */
  const [unverified, setUnverified] = useState<string | null>(null);

  // Arriving from a verification link.
  useEffect(() => {
    if (params.get("verified") === "1") {
      notify.ok("Email verified", "You can sign in now.");
      router.replace("/sign-in");
    }
  }, [params, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setUnverified(null);

    // One field, either kind of identifier. An "@" is the only thing that
    // reliably distinguishes them, and usernames can't contain one.
    const isEmail = identifier.includes("@");
    const { error } = isEmail
      ? await signIn.email({ email: identifier, password })
      : await signIn.username({ username: identifier, password });

    setPending(false);

    if (error) {
      const message = error.message ?? "";
      if (error.status === 403 || /verif/i.test(message)) {
        // Only offer a resend when we know where to send it.
        setUnverified(isEmail ? identifier : "");
        notify.problem(
          "Verify your email first",
          "We sent you a link when you signed up.",
        );
        return;
      }
      notify.problem(
        "That didn't work",
        message || "Those details don't match an account.",
      );
      return;
    }

    notify.ok("Signed in");
    router.push("/bootstrap");
  }

  return (
    <AuthPanel
      title="Sign in"
      footer={
        <>
          <Link
            href="/forgot-password"
            className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
          >
            Forgot password?
          </Link>
          <Link
            href="/sign-up"
            className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="identifier"
          label="Username or email"
          type="text"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <PasswordField
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {unverified !== null && (
        <div className="flex flex-col gap-3 border-t border-steel/25 pt-5">
          <p className="font-sans text-sm leading-relaxed text-floodlight/60">
            This account isn&apos;t verified yet.
            {unverified === ""
              ? " Sign in with your email address to have the link resent."
              : " Send yourself another link:"}
          </p>
          {unverified !== "" && <ResendVerification email={unverified} />}
        </div>
      )}
    </AuthPanel>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <AuthPanel title="Sign in">
          <p className="font-sans text-sm text-floodlight/55">Loading…</p>
        </AuthPanel>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
