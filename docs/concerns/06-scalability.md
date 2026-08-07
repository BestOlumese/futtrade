# Concern: Scalability

**Applies to phases:** 01, 07, 16

## Don't pre-optimize

Colyseus scales horizontally with Redis and load balancers when needed. This is a real, known upgrade path — but investing in it before Phases 00-06 prove the core loop is actually fun is the wrong order of operations for a project this size. Build for correctness and clarity first; scale the specific piece that needs it once there's real load data showing where the bottleneck actually is.

## Where scale pressure will show up first

Realistically, in order: the live match engine under concurrent-room load, then the matchmaking queue under high concurrent-queue volume, then market settlement job throughput if the playerbase and match volume both grow. Don't guess which one matters — instrument each of these from early phases so there's real data when the question comes up.

## Timescale on Neon

`timescaledb` on Neon is the Apache-2 edition only — no compression, no tiered storage. This is fine at MVP scale. If price-tick volume grows large enough to matter, the upgrade path is self-hosted Timescale or Timescale Cloud, not a Neon setting to flip — plan for a possible migration, don't expect Neon to just handle it at arbitrary scale.
