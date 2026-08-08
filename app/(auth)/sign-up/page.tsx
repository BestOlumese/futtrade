"use client";

import { useState } from "react";
import Link from "next/link";
import { signUp, VERIFY_CALLBACK } from "@/lib/auth-client";
import { AuthPanel } from "@/components/auth/auth-panel";
import { ResendVerification } from "@/components/auth/resend-button";
import { Field, PasswordField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { notify } from "@/components/ui/toaster";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  usernameProblem,
} from "@/lib/username";

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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const nameProblem = usernameProblem(username);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // Caught here for a faster answer; the server validates independently.
    if (nameProblem) {
      notify.problem("Check that username", nameProblem);
      return;
    }

    setPending(true);

    const { error } = await signUp.email({
      username,
      name: username,
      email,
      password,
      callbackURL: VERIFY_CALLBACK,
    });

    setPending(false);

    if (error) {
      const message = error.message ?? "";
      // Uniqueness is enforced by the database, so this is where a taken
      // username actually surfaces — not in the check above.
      const taken =
        /username/i.test(message) &&
        /(taken|exist|unique|already)/i.test(message);
      const emailTaken = /email/i.test(message) && /(exist|already)/i.test(message);

      if (taken) {
        notify.problem("That username is taken", "Try another one.");
      } else if (emailTaken) {
        notify.problem(
          "That email already has an account",
          "Sign in instead, or reset the password.",
        );
      } else {
        notify.problem("That account couldn't be created", message || undefined);
      }
      return;
    }

    setSentTo(email);
    notify.ok("Account created", `We sent a verification link to ${email}.`);
  }

  if (sentTo) {
    return (
      <AuthPanel
        title="Check your email"
        intro={`We sent a verification link to ${sentTo}. Follow it to finish setting up your account — it's good for 24 hours.`}
        footer={
          <Link
            href="/sign-in"
            className="text-floodlight/55 underline-offset-4 hover:text-lime hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          <ResendVerification email={sentTo} />
          <p className="font-sans text-xs leading-relaxed text-floodlight/45">
            Nothing arrived? Check spam — mail from a Gmail address often lands
            there.
          </p>
        </div>
      </AuthPanel>
    );
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
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint={
            nameProblem ??
            `${USERNAME_MIN}–${USERNAME_MAX} characters. Letters, numbers and underscore.`
          }
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
        <PasswordField
          id="password"
          label="Password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={passwordHint(password)}
        />

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
