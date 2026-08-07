# Phase 03 — Server Validation & Anti-Cheat Guardrails

**Depends on:** 02
**Complexity:** M

## Goal
Close the obvious cheating gaps before building anything else on top of the sim. See `docs/concerns/01-fairness-anticheat.md` for the underlying principles this phase implements.

## Tasks
- [ ] Rate-limit dial-change messages server-side (reject faster than intended cadence)
- [ ] Reject any client message attempting to set a score/event directly rather than an intent
- [ ] Structured logging of all accepted/rejected client messages for later audit
- [ ] Load-test with a scripted adversarial client sending malformed/rapid messages, confirm server stays authoritative

## Explicitly out of scope
- Full anti-cheat for later systems (market wash-trading, scouting-fog bypass) — those get their own phases (17, 21)

## Exit criteria
A scripted adversarial client cannot alter match outcome or bypass rate limits; all rejected attempts are logged.
