# Phases — Index

27 phases (00-26), each independently scoped with its own goal, tasks, and exit criteria. Don't let scope from a later phase leak backward — the ordering exists to de-risk the hardest system (the live sim) before investing in anything that depends on it.

## Foundation
- [00 — Bootstrap](00-bootstrap.md)

## Core live match engine (the highest-risk system — build and validate first)
- [01 — Tick Loop Skeleton](01-tick-loop-skeleton.md)
- [02 — Minimal Sim + Two Tactical Dials](02-minimal-sim-two-dials.md)
- [03 — Server Validation & Anti-Cheat Guardrails](03-server-validation-guardrails.md)
- [04 — Event Schema & Persistence](04-event-schema-persistence.md)
- [05 — Basic 2D Viewer (Post-Match)](05-basic-2d-viewer-postmatch.md)
- [06 — Live 2D Dot Replay](06-live-2d-dot-replay.md)

## Matchmaking
- [07 — Matchmaking Queue](07-matchmaking-queue.md)
- [08 — AI-Ghost Fallback](08-ai-ghost-fallback.md)

## Player database & in-match management
- [09 — Player Database v1](09-player-database-v1.md)
- [10 — Squad Fielding Integration](10-squad-fielding-integration.md)
- [11 — Substitutions with Delay](11-substitutions-delay.md)
- [12 — Full Tactics & Action Limits](12-full-tactics-action-limits.md)

## Development system
- [13 — CA Growth & Training Focus](13-ca-growth-training.md)
- [14 — Form Calculation & Decay](14-form-calculation-decay.md)
- [15 — Development Log & Audit UI](15-development-log-audit-ui.md)

## Market v1
- [16 — Market v1: Buy/Sell](16-market-v1-buy-sell.md)
- [17 — Market Settlement Job](17-market-settlement-job.md)

## Depth pass (each independently shippable, roughly in this order)
- [18 — Playstyles](18-playstyles.md)
- [19 — Personality Traits](19-personality-traits.md)
- [20 — Injuries](20-injuries.md)
- [21 — Scouting Fog](21-scouting-fog.md)
- [22 — Full Heatmap & Timeline Treatment](22-full-heatmap-timeline.md)
- [23 — Rumor Market](23-rumor-market.md)
- [24 — Dividends & Finance Integration](24-dividends-finance.md)
- [25 — Leaderboards](25-leaderboards.md)
- [26 — Trader Role](26-trader-role.md)
