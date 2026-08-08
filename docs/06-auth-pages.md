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

## Sign in

Email + password. Primary "Sign in". Secondary links to reset and to sign-up. No social proof, no marketing sidebar.

## Sign up

Username, email, password — the password with a plain-language strength hint, never a color-only meter. Primary "Create account". One small muted line beneath linking to terms.

## Reset password

Two steps, same panel: (1) email entry, with the confirmation shown in-panel ("Check your email…", stated plainly); (2) new password, reached via the emailed link. A missing or spent token states that plainly and offers to send a new link.

## Error states

Errors say what happened and what to do next, with no apology register. "That email and password don't match" beats "Oops, invalid credentials!". Rate limiting states the actual wait if known.

## What this surface deliberately does NOT do

- No live dot — nothing here is live
- No pitch grid or parallax; that's the landing page's budget, not this one's
- No split-screen or multi-panel layout — one centered panel
- No background imagery beyond the generated atmosphere
