# Concern: Real-Time Sync & Reconnection

**Applies to phases:** 01, 06, 11

## Disconnection mid-match — DECIDED

Settled before Phase 01 shipped, as this doc required.

**The match continues on the disconnected manager's last-known instructions.**
The tick keeps advancing and their last tactics stand. There is a **60-second
grace period** in which they can rejoin and resync to the current tick; after
that their slot is released.

Why not the alternatives:

- **Pausing until reconnection** hands a losing manager a freeze button. Anyone
  behind can stall their opponent's match at will by pulling the plug, and
  closing that later needs something like a pause budget. A player should never
  be held hostage by the other's connection.
- **AI takeover** is Phase 08. Choosing it here would pull that phase's scope
  backward, which the phase ordering exists to prevent — and there is no
  simulation yet for an AI to drive. It slots in on top of this decision later:
  the room already carries on without the absent manager, so Phase 08 only has
  to change *what* drives their instructions, not *whether* play continues.

**The room also survives being briefly empty.** It keeps ticking for the same
60 seconds when nobody is connected, so both managers reloading at once doesn't
destroy the match. Only after that does it dispose.

Whichever the state, the UI must show a real, decided one (see below) — never a
spinner that could mean anything.

## Client-side interpolation

For smooth 2D dot movement between server ticks, the client interpolates *toward* the last confirmed tick — it must never extrapolate *past* confirmed state to guess where a player will be next. Getting ahead of the server is how desync and rubber-banding happen.

## Clock authority

The match clock is server time, always. The client displays it; it never owns or independently advances it, even for smoothness — display-side smoothing should visually tween toward server-reported time, not run its own independent clock that could drift.

## Reconnection UI state

Per the live-match-viewer design: show "Reconnecting…" with the last-known score frozen and clearly marked as last-known, never silently continuing to animate as if nothing happened. A user should always be able to tell, at a glance, whether what they're looking at is live or stale.
