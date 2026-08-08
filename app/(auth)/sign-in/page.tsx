"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { AuthPanel, AuthError } from "@/components/auth/auth-panel";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signInError } = await signIn.email({ email, password });

    if (signInError) {
      setError(signInError.message ?? "That email and password don't match.");
      setPending(false);
      return;
    }

    router.push("/bootstrap");
  }

  return (
    <AuthPanel
      title="Sign in"
      footer={
        <>
          <Link
            href="/forgot-password"
            className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
          >
            Forgot password?
          </Link>
          <Link
            href="/sign-up"
            className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
          >
            Create an account
          </Link>
        </>
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
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <AuthError>{error}</AuthError> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthPanel>
  );
}
