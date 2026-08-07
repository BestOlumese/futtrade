# Feature: Scouting

**Phase:** 21

## Spec

- Scouted players show a fogged range (e.g. Finishing 68-79), not the true value
- Range narrows with invested scout time/budget, converging toward true CA-derived attributes
- Server-enforced: true values never transmit to a client that hasn't earned the reveal

## Acceptance

Two scouts investing different amounts of time on the same player see measurably different range widths.

## Related

`docs/concerns/01-fairness-anticheat.md` — the enforcement mechanism this feature depends on.
