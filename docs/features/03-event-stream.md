# Feature: Event Stream

**Phase:** 04

## Spec

- Every shot/pass/tackle/card/sub emits a structured event: `{ type, tick, location: {x,y}, players: [...], xg?, outcome }`
- Stored in `match_events`, keyed by `match_id`
- This is the single source for: shot map, heatmap, momentum graph, live ticker, `match_performance_log` ratings, and Form nudges

## Acceptance

The shot map, event ticker, and momentum graph for a completed match are all derivable from `match_events` alone with no separate data path.

## Design rule

Before building any new stat, chart, or price mechanic anywhere in the product, check whether it can be derived from this existing event stream before adding a new data path. This is the spine of the whole system — treat it accordingly.
