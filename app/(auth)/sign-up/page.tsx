"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { AuthPanel, AuthError } from "@/components/auth/auth-panel";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * Plain-language strength hint, not a color-only meter — per the accessibility
 * rule that color is never the only signal.
 */
function passwordHint(password: string): string {
  if (password.length === 0) return "At least 8 characters.";
  if (password.length < 8)
    return `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} needed.`;
  if (password.length < 12) return "Long enough. Longer is stronger.";
  return "Strong length.";
}

export default function SignUpPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const { error: signUpError } = await signUp.email({
      name: username,
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message ?? "That account couldn't be created.");
      setPending(false);
      return;
    }

    router.push("/bootstrap");
  }

  return (
    <AuthPanel
      title="Create account"
      footer={
        <Link
          href="/sign-in"
          className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
        >
          Already have an account? Sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Field
          id="username"
          label="Username"
          type="text"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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

        {error ? <AuthError>{error}</AuthError> : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>

        <p className="font-sans text-xs leading-relaxed text-floodlight/45">
          Creating an account means you accept the{" "}
          <Link
            href="/terms"
            className="text-floodlight/70 underline underline-offset-4 hover:text-lime"
          >
            terms of play
          </Link>
          .
        </p>
      </form>
    </AuthPanel>
  );
}
