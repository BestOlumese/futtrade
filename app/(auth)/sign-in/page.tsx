"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Panel } from "@/components/ui/panel";
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
      // Voice: state what happened, no apology register.
      setError(
        signInError.message ?? "That email and password don't match.",
      );
      setPending(false);
      return;
    }

    router.push("/bootstrap");
  }

  return (
    <Panel>
      <div className="flex flex-col gap-6 px-7 pt-8 pb-7">
        <p className="font-display text-lg font-extrabold tracking-tight text-floodlight uppercase">
          Empire Live
        </p>

        <h1 className="font-display text-3xl leading-none font-extrabold tracking-tight text-floodlight">
          Sign in
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          {error ? (
            <p
              role="alert"
              className="border-l-2 border-tally pl-3 font-sans text-sm text-floodlight"
            >
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="flex flex-col gap-2 font-sans text-sm">
          <Link
            href="/sign-up"
            className="text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
          >
            Create an account
          </Link>
        </div>
      </div>
    </Panel>
  );
}
