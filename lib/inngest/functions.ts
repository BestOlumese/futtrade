import { inngest } from "./client";

/**
 * Phase 00 no-op. Its only job is to prove that a scheduled function actually
 * fires on schedule in production — the failure mode this whole scheduler
 * choice exists to avoid is a job that silently never runs.
 *
 * Cron expressions in Inngest are UTC unless prefixed with a TZ. Being explicit
 * about that matters here: every real job that follows (Form decay, market
 * settlement) is date-boundary sensitive, and a job that runs "at midnight" in
 * an ambiguous zone is a data-consistency bug waiting to happen.
 * See docs/concerns/03-matchmaking-latency-timezone.md.
 *
 * Delete this once a real scheduled job (Phase 13) is running.
 */
export const heartbeat = inngest.createFunction(
  {
    id: "bootstrap-heartbeat",
    name: "Bootstrap heartbeat (Phase 00 no-op)",
    triggers: [{ cron: "TZ=UTC */15 * * * *" }],
  },
  async ({ step }) => {
    const firedAt = await step.run("record-fired-at", async () =>
      new Date().toISOString(),
    );

    console.log(`[inngest] heartbeat fired at ${firedAt}`);
    return { firedAt };
  },
);

export const functions = [heartbeat];
