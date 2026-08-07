import { Inngest } from "inngest";

/**
 * Inngest is the project's only scheduler.
 *
 * Not `pg_cron`: Neon's compute suspends when idle, and pg_cron jobs silently
 * skip during a suspension. Training/CA growth, Form decay and market
 * settlement cannot tolerate silent skips, so scheduling is triggered
 * externally instead. See docs/concerns/07-cost-infra.md.
 */
export const inngest = new Inngest({ id: "empire-live" });
