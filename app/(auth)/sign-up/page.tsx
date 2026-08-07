"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { Panel } from "@/components/ui/panel";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Plain-language strength hint, not a color-only meter — per the accessibility
 * rule that color is never the only signal.
 */
function passwordHint(password: string): string {
  if (password.length === 0) return "At least 8 characters.";
  if (password.length < 8) return `${8 - password.length} more characters needed.`;
  if (password.length < 12) return "Long enough. Longer is stronger.";
  return "Strong length.";
}

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signUpError } = await signUp.email({ name, email, password });

    if (signUpError) {
      setError(signUpError.message ?? "That account couldn't be created.");
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
          Create account
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field
            id="name"
            label="Manager name"
            type="text"
            autoComplete="username"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={passwordHint(password)}
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
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="font-sans text-xs leading-relaxed text-floodlight/45">
          Creating an account means you accept the terms of play.
        </p>

        <Link
          href="/sign-in"
          className="font-sans text-sm text-floodlight/55 underline-offset-4 hover:text-signal hover:underline"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </Panel>
  );
}
