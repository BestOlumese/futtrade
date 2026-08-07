# Concern: Real-Time Sync & Reconnection

**Applies to phases:** 01, 06, 11

## Disconnection mid-match

This needs a defined grace period and a defined consequence, decided explicitly before Phase 01 ships — not discovered in production. Options to choose between:
- The match pauses until reconnection (bounded by a timeout)
- An AI takes over the disconnected manager's tactics for the remainder
- The match continues on the disconnected manager's last-known instructions

Whichever is chosen, the UI must show a real, decided state (see below) — never a spinner that could mean anything.

## Client-side interpolation

For smooth 2D dot movement between server ticks, the client interpolates *toward* the last confirmed tick — it must never extrapolate *past* confirmed state to guess where a player will be next. Getting ahead of the server is how desync and rubber-banding happen.

## Clock authority

The match clock is server time, always. The client displays it; it never owns or independently advances it, even for smoothness — display-side smoothing should visually tween toward server-reported time, not run its own independent clock that could drift.

## Reconnection UI state

Per the live-match-viewer design: show "Reconnecting…" with the last-known score frozen and clearly marked as last-known, never silently continuing to animate as if nothing happened. A user should always be able to tell, at a glance, whether what they're looking at is live or stale.
