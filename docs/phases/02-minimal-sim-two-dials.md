# Phase 02 — Minimal Sim + Two Tactical Dials

**Depends on:** 01
**Complexity:** L

## Goal
The first real gameplay — a match resolves to a plausible score, and a live tactical input visibly changes the outcome.

## Tasks — COMPLETE
- [x] Flat per-player rating (no attributes yet) — both sides equal by default
- [x] Probability-tree sim per tick: possession → shots → chance quality → goal, weighted by both dials
- [x] Client UI: two dial controls, sends intent to server
- [x] Server applies dial state to the next tick's probability weights
- [x] Match ends at 90 simulated minutes, final score broadcast and persisted

Closed 2026-08-08. 30 ticks × 3 sim-minutes at 3s each — a match takes 90
seconds.

### Exit criterion, measured

The criterion is a claim about a distribution, so it was answered with one:
20,000 simulated matches per condition, and 95% confidence intervals on the
difference rather than a glance at a table.

| Effect | Difference vs balanced/medium | 95% CI |
|---|---|---|
| attacking scores more | +0.441 goals | [0.416, 0.465] |
| defensive scores less | −0.338 goals | [−0.359, −0.317] |
| high press holds more ball | +3.73 pp | [3.55, 3.91] |
| low press holds less ball | −3.22 pp | [−3.39, −3.04] |

Every interval excludes zero by a wide margin. The baseline is plausible
football — 2.63 goals a match, 7.0% 0-0, 1.9% seven-plus, and symmetric between
the sides. No setting runs away with it: the spread across all nine dial
combinations is 5.1 percentage points and the best wins 38.9%, so there is a
decision to make rather than an obvious answer.

Re-run any time with `npm --prefix server run sim:tune`.

### Decisions

- **Both dials are genuine two-sided trades.** Attacking raises your shot
  volume and possession but makes the chances you concede far better; high
  pressing wins the ball back more but opens space behind. Without a real cost
  a dial just means "be better" and stops being a choice.
- **3 tactical changes per half, counted server-side**, plus a rate limit that
  rejects bursts independently of the budget. Per
  `docs/concerns/01-fairness-anticheat.md` a client-side counter is display
  only, never the enforcement.
- **An unfilled slot plays fixed balanced/medium and never adapts.** That is not
  an AI opponent — Phase 08 owns that — it just lets one manager test alone.
- **Only the result is persisted.** The event stream is Phase 04, and AGENTS.md
  calls that schema the spine of the system; inventing it early, one column at a
  time, is how it ends up wrong.

## Explicitly out of scope
- Substitutions
- Formations beyond a fixed default
- Playstyles, attributes

## Exit criteria
Repeated simulated matches with identical starting ratings, run under different dial settings, show a measurable and sensible difference in average score/possession — not just noise.
