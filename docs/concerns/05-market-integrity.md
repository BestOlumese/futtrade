# Concern: Market Integrity

**Applies to phases:** 16, 17, 23, 26

## Wash trading

A user should not be able to pump their own player's price by trading against a second account they control. At minimum, flag same-IP or same-payment-method trading pairs for review. Don't treat this as a v1-only concern to defer — design the trade-recording schema from Phase 16 onward so this kind of pattern is queryable later, even if active enforcement comes in a later pass.

## Insider timing

Manager-only information (a confirmed lineup, a live in-match substitution) must not reach the market before it's public to traders. **Define the exact moment information becomes "public"** — the current rule is: a lineup is public at kickoff — and enforce it server-side, not by convention or UI-only hiding. This directly gates the rumor market (Phase 23): the rumor feed must never leak confirmed information early just because it's framed as "unconfirmed."

## Settlement correctness

Every price movement must be traceable to a specific logged event (see `04-data-consistency.md`). A market where prices can move for unexplained reasons — even due to an innocent bug — undermines the entire "the market reacts to what happened" design thesis. Treat any unexplained price delta found in testing as a release blocker, not a cosmetic bug.

## Trader/manager parity

Once the trader role exists (Phase 26), the market surface must behave identically for both roles — no manager-only information advantage baked into the UI by accident (e.g. a manager's own dashboard accidentally surfacing a stat before it's in the public event stream).
