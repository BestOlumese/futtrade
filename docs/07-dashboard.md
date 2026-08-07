# Club Dashboard

Built on `04-design-system.md`. This is the manager's home screen — the async-management hub between live matches, so it needs to reward a quick daily check-in, not demand a long session every time.

## Layout — chamfered panel grid

A grid of independently-scannable chamfered panels, not one long scrolling page. Each panel answers one question at a glance.

1. **Next fixture panel** (top-left, largest) — opponent, kickoff countdown (`IBM Plex Mono`, tabular, ticking live), a "Queue for match" / "Match scheduled" state. `tally` edge-line if kickoff is imminent (within a defined threshold, e.g. 15 minutes), `signal` otherwise — this is one of the few dashboard panels allowed the `tally` treatment, since an imminent live match is a genuine urgency signal, not decoration.
2. **Squad snapshot** — starting XI as a compact formation diagram (not a full roster list), with any Form-flagged players (notably hot or cold, per `03-features.md`) visually marked with a small `signal`/`tally` indicator dot next to their name — distinct from the live tally dot in size/context so it doesn't read as "this player is live."
3. **Finances** — budget, wage bill, a single trend line (recharts, `signal`/`tally` for direction) rather than a dense table. Full ledger lives on a dedicated finances screen, not crammed in here.
4. **Development highlights** — a short feed pulled directly from `player_development_log`: "Adeyemi +3 Finishing this week," "Okoro's contract renewal due." This panel is what makes the dashboard feel alive between matches — real logged events, never invented copy.
5. **Market snapshot** — your squad's aggregate share value trend, one sparkline, link through to the full Market screen (`09-market.md`) rather than duplicating its detail here.

## Panel hierarchy

Next fixture is visually largest and top-left (reading-order priority) — everything else is secondary. Don't let finances or market compete with it for size; this is a club-management game whose spine is the live match, and the dashboard should say so through layout, not just copy.

## Empty/new-club states

Per the design system's voice guidance, treat emptiness as invitation: a new club with no fixture yet shows "Queue for your first match" in the fixture panel rather than a blank space; an empty development-highlights feed says "Set a training focus to start developing your squad," linking directly to the action.

## What this surface deliberately does NOT do

- No dense data-table-as-homepage — that's what dedicated screens (squad, finances, market) are for
- No decorative charts — every chart on this screen ties to a real number a manager needs today
- No "01/02/03" numbering on the panel grid — panels aren't a sequence, they're parallel information, so no earned numbering here
