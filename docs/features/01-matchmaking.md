# Feature: Matchmaking

**Phases:** 07, 08

## Spec

- `POST /queue/join` — enters rating-based queue
- Queue-widening curve: start ±50 rating, widen ±25 every 10s, cap at ±300 (starting hypothesis — see `docs/concerns/03-matchmaking-latency-timezone.md` for tuning guidance)
- Timeout (default 45s): offer an AI-ghost match using a saved real club's last-used tactics as the opponent, clearly labeled as such in the UI
- On match found: both clients receive a Colyseus room token, connect via WebSocket

## Acceptance

Two accounts at similar rating are paired within one widening step in normal testing; a lone account reliably gets an AI-ghost match after timeout.

## Related

- `docs/concerns/03-matchmaking-latency-timezone.md` — why the fallback isn't optional
- `docs/concerns/01-fairness-anticheat.md` — queue/room token validation
