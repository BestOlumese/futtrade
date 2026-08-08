# Auth Pages (sign in / sign up / reset password)

Built on `04-design-system.md`.

## Concept

Auth is a functional moment that should still feel like entering the game. Calmer than the landing page — no running clock, no live ticker, nothing pretending to be live — but unmistakably the same product: `midnight` field, angular panel, `lime` action, real atmosphere behind it.

The previous version of this spec called for a bare centered panel on a flat field. That read as unfinished. Auth gets **atmosphere layers 1, 2 and 5** — base wash, faint floodlight beams, grain — plus a single `lime` glow behind the panel. No pitch grid, no parallax.

## Layout

Single centered panel, max ~440px, on the atmospheric field.

- **Panel:** `surface` fill, cuts on top-left and bottom-right, `lime` edge-line on the cuts, corner bracket marks
- **Wordmark:** top-left inside the panel, small, uppercase, `lime`
- **Heading:** display face, sentence case
- **Fields:** plain rectangles, `surface-2` fill, `steel` border, `lime` focus ring, uppercase `steel` labels
- **Primary button:** full-width, `lime` fill, `midnight` text, bottom-right cut
- **Secondary links:** below the primary action, muted, never competing

## Feedback: toasts, not inline panels

All auth feedback is a toast (Sonner), styled to the system: `surface` fill, angular cut, `lime` edge for success and `live` for failure. No inline error panels on these screens — one feedback mechanism, consistently placed, so the eye learns where to look.

Toasts still follow the voice rules: they say what happened and what to do, with no apology register. "That email and password don't match" beats "Oops, invalid credentials!".

## Password fields

Every password input carries a show/hide toggle on the right. It is a button with an accessible label that changes with state ("Show password" / "Hide password"), never an icon alone — and it must not shift the field's layout when toggled.

## Sign in

One identifier field accepting **either** username or email, plus password. Primary "Sign in". Secondary links to reset and to sign-up. No social proof, no marketing sidebar.

**Unverified accounts cannot sign in.** The attempt is refused, a toast explains why, and the panel offers "Resend verification email" with a 60-second cooldown — nobody is left with no way forward.

## Sign up

Username, email, password.

- **Username:** 3–20 characters, letters/numbers/underscore. Compared case-insensitively so `Delane` and `delane` cannot both exist, but stored as typed for display. A short reserved list (admin, root, support, futtrade and similar) is refused, so nobody can impersonate the platform.
- **Password:** plain-language strength hint, never a color-only meter.

On success the panel becomes a **confirmation state** naming the address, with a resend button. The user is deliberately not signed in — they cannot sign in until verified, so signing them in and then immediately blocking them would be incoherent.

## Verify email

A verification link is sent on sign-up and is good for **24 hours**. Following it verifies the account and lands the user on sign-in with a success toast — exactly where they now need to be, with an explanation of what just happened.

An expired or already-used link says so plainly and offers to send another.

## Reset password

Two steps, same panel: (1) email entry, with the confirmation shown in-panel ("Check your email…", stated plainly); (2) new password, reached via the emailed link. A missing or spent token states that plainly and offers to send a new link.

## Email

Sent over Gmail SMTP via nodemailer. Messages are short and plain, in the same voice as the UI, and always include the raw URL as text beneath the button — many clients strip or rewrite links, and a user who cannot click must still be able to copy.

Gmail's ~500/day cap and its weak deliverability for transactional mail are a bootstrap compromise, not a destination. See `DEPLOY.md`.

## What this surface deliberately does NOT do

- No live dot — nothing here is live
- No pitch grid or parallax; that's the landing page's budget, not this one's
- No split-screen or multi-panel layout — one centered panel
- No background imagery beyond the generated atmosphere
