# Phase 03 — Server Validation & Anti-Cheat Guardrails

**Depends on:** 02
**Complexity:** M

## Goal
Close the obvious cheating gaps before building anything else on top of the sim. See `docs/concerns/01-fairness-anticheat.md` for the underlying principles this phase implements.

## Tasks — COMPLETE
- [x] Rate-limit dial-change messages server-side (landed in Phase 02)
- [x] Reject any client message attempting to set a score/event directly rather than an intent
- [x] Structured logging of all accepted/rejected client messages for later audit
- [x] Load-test with a scripted adversarial client, confirm server stays authoritative

Closed 2026-08-09. Run the suite with
`npm --prefix server run attack -- <cookieFile>`.

### The vulnerability this phase existed to find

Colyseus 0.16 stores message handlers in a **plain object**, so a message whose
type is `__proto__` resolves to `Object.prototype` — truthy, so the `"*"`
catch-all is skipped — and dispatch then calls `.callback(...)` on it, which is
undefined. The TypeError is uncaught inside the websocket receiver and **takes
the whole process down**, ending every live match on the server.
`constructor`, `toString`, `valueOf` and `hasOwnProperty` do the same.

Any authenticated client could do it with a single message. It is fixed by
giving the handler registry a null prototype, so those keys resolve to
`undefined` and fall through to the catch-all like any other unknown type.
Worth reporting upstream.

Nothing in a code review would have caught this. The adversarial client found it
on its first run, which is the entire argument for the task.

### Exit criterion — 16/16 guarantees held

| Attack | Result |
|---|---|
| `setScore`, `goal`, `tick`, `setPhase`, `state` | score, tick and phase unchanged |
| `__proto__`, `constructor`, `toString`, `valueOf`, `hasOwnProperty` | server survived, prototype unpolluted |
| null, wrong types, 50k-char strings, nested objects | server still accepting connections |
| 40-message dial burst | budget untouched |
| changes at a legal cadence | exactly 3 accepted: 1 → 2 → 3 → 3 → 3 |
| ticket replay, forgery, ticketless join | all refused |
| sustained abuse | disconnected, code 4001 |

50 refusals in that run, every one written to `match_audit` with its payload.

### Decisions

- **Audit goes to two places.** Every message, accepted or rejected, is one line
  of JSON on stdout for live tailing; rejections *also* go to `match_audit`,
  because Render's free tier retains logs for days and a slow-burn pattern needs
  months. Accepted messages stay out of the table — one row per dial change is
  fine, one per tick is not.
- **Abuse escalates rather than kicking on the first bad message.** Refuse with
  a reason, warn at 6 in 10s, disconnect at 16. A version-skewed client should
  bounce, not be ejected mid-match. Escalation never touches the match: a kicked
  manager's last dials stand, exactly as for an ordinary disconnect.
- **Match tickets are single-use.** A captured ticket was otherwise replayable
  for its full 60-second life, letting someone take a seat beside the manager
  whose session minted it. Spent ids are held in memory — revisit if the match
  server is ever run as more than one instance.

## Explicitly out of scope
- Full anti-cheat for later systems (market wash-trading, scouting-fog bypass) — those get their own phases (17, 21)

## Exit criteria
A scripted adversarial client cannot alter match outcome or bypass rate limits; all rejected attempts are logged.
