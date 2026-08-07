# Auth Pages (sign in / sign up / reset password)

Built on `04-design-system.md`.

## Concept

Auth is a functional moment, not a branding opportunity — but it shouldn't feel like it fell out of a different product either. Calmer than the landing page (no running clock, no live ticker), while staying visibly the same system: `void` background, one chamfered panel, `IBM Plex Sans`/`Big Shoulders` pairing intact.

## Layout

Single centered chamfered panel (`pitch-shadow` background, `signal` edge-line on the chamfer) on a plain `void` field — no split-screen marketing imagery, no background match footage. The restraint here is deliberate: this screen's only job is completing the form correctly and quickly.

- Panel width: narrow (max ~420px) — auth forms should never feel like they're competing for a wide canvas
- Wordmark/logo top-left of the panel, small, `floodlight`
- Form fields: sharp corners (no chamfer on inputs, per the design system rule — chamfer is reserved for panels), `steel`-bordered, `signal`-colored focus ring
- Primary action button: full-width within the panel, `signal` fill, `void` text
- Secondary links ("Forgot password?", "Create an account") in `steel` or `floodlight` at reduced opacity, positioned below the primary action, not competing with it visually

## Sign in

Email/username + password fields, primary button "Sign in," secondary link to reset and to sign-up. No social-proof copy, no marketing sidebar — get out of the way.

## Sign up

Same panel treatment. Fields: email, username, password (with a plain-language strength hint, not a color-only meter — ties to the accessibility rule that color is never the only signal). Primary button "Create account." One line beneath the button, small and muted, linking to terms — not a wall of legal copy on this screen.

## Reset password

Two-step, both using the same panel: (1) email entry, confirmation message in-panel ("Check your email for a reset link" — stated plainly, not "Oops!" register); (2) new-password entry reached via the emailed link.

## Error and empty states

Per the design system's voice guidance: errors state what happened and what to do next, no apology register. "That email and password don't match" beats "Oops, invalid credentials!" A locked/rate-limited state states the actual wait time if known, not a vague "try again later."

## What this surface deliberately does NOT do

- No background video/imagery of matches — that's the landing page's job, not this one's
- No decorative use of the tally dot — nothing here is "live"
- No multi-panel or split-screen layout — one centered panel, full stop
