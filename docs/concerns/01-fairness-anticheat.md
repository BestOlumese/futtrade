# Concern: Fairness & Anti-Cheat

**Applies to phases:** 03, 10, 11, 12, 18, 21

## The core rule

Server authority is the whole defense. The Colyseus room is the single source of truth for match state; clients send *intent* (a sub request, a tactical change), never outcomes. Never trust a client-reported score, event, or stat — if a value matters, it's computed and validated server-side, full stop.

## Specific risks

- **Delayed-application windows** (sub "getting into position," tactical-change cooldowns) must be enforced server-side, not just visually simulated client-side — a modified client could otherwise skip the delay entirely.
- **Action limits** (5 subs, N tactical changes per half) are server-counted. A client-side counter is a display convenience, never the enforcement mechanism.
- **Hidden values never leave the server in full.** True Current Ability, potential ceiling, and fogged scouting ranges must only ever be sent to the client as the derived/fogged view that specific user is entitled to see. A client that can read another club's true CA has broken the entire scouting and market information-asymmetry design — this isn't a minor leak, it undermines two whole systems at once.
- **Rate limiting on all live-input messages** (dial changes, sub queues) — reject anything faster than the intended cadence, and log rejections for review.

## Design rule going forward

Any new live-input feature gets asked the same question before it ships: what happens if a malicious client sends this message as fast as possible, or sends a fabricated version of it? If the answer relies on client-side good behavior, it's not done yet.
