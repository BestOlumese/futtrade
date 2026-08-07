-- Enable TimescaleDB.
--
-- Nothing uses it yet. It is enabled in Phase 00 deliberately, because the
-- Global Bourse's price history (Phase 16/17) is a hypertable, and finding out
-- at that point that the extension is unavailable on this Neon project would
-- be an expensive surprise. Enabling it now makes it a bootstrap check rather
-- than a late blocker.
--
-- Neon ships the Apache-2 licensed subset of TimescaleDB: hypertables,
-- continuous aggregates and compression are available; multi-node is not.
-- That covers everything docs/features/08-market.md needs.

CREATE EXTENSION IF NOT EXISTS timescaledb;
