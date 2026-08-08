"use client";

import { useId, useState, type InputHTMLAttributes } from "react";

/**
 * Form input. Plain rectangle — cuts are for containers and actions, not for
 * every element. `surface-2` fill, `steel` border, `lime` focus ring.
 */
export function Field({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="label text-mute">
        {label}
      </label>
      <input
        id={id}
        className="border border-steel/40 bg-surface-2 px-3.5 py-3 font-sans text-sm text-floodlight transition-colors duration-instant placeholder:text-floodlight/30 hover:border-steel/70"
        {...props}
      />
      {hint ? (
        <p className="font-sans text-xs leading-relaxed text-floodlight/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Password input with a show/hide toggle.
 *
 * The toggle is a real button carrying a label that changes with state, not an
 * icon alone — a screen reader has to be able to say which it does. It sits
 * inside the field's padding so revealing the password never shifts layout.
 */
export function PasswordField({
  label,
  hint,
  id,
  ...props
}: { label: string; hint?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
>) {
  const [shown, setShown] = useState(false);
  const fallbackId = useId();
  const inputId = id ?? fallbackId;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="label text-mute">
        {label}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={shown ? "text" : "password"}
          className="w-full border border-steel/40 bg-surface-2 py-3 pr-12 pl-3.5 font-sans text-sm text-floodlight transition-colors duration-instant placeholder:text-floodlight/30 hover:border-steel/70"
          {...props}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-mute transition-colors duration-instant hover:text-lime"
        >
          <EyeIcon open={shown} />
        </button>
      </div>

      {hint ? (
        <p className="font-sans text-xs leading-relaxed text-floodlight/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1.6 12S5.5 5 12 5s10.4 7 10.4 7-3.9 7-10.4 7S1.6 12 1.6 12Z" />
      <circle cx="12" cy="12" r="3" />
      {/* Struck through when the password is visible — the slash reads as
          "hide", matching what pressing it will do. */}
      {open ? <path d="M4 20 20 4" /> : null}
    </svg>
  );
}
