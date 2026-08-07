"use client";

import { useCallback, useState } from "react";
import { Client } from "colyseus.js";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "ok" | "failed";

/**
 * Phase 00 task: confirm the client can open a WebSocket to the deployed
 * Colyseus room and exchange a message.
 *
 * Deliberately manual rather than on-mount: on Render's free tier the first
 * connection after an idle period pays a ~50s cold start, and a page that
 * silently hangs for a minute on load is a worse diagnostic than a button that
 * says what it's waiting for.
 */
export function ColyseusCheck({ endpoint }: { endpoint: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [roundTrip, setRoundTrip] = useState<number | null>(null);

  const runCheck = useCallback(async () => {
    setStatus("connecting");
    setDetail(null);
    setRoundTrip(null);

    try {
      const client = new Client(endpoint);
      const room = await client.joinOrCreate("bootstrap");

      const sentAt = performance.now();

      const reply = await new Promise<{ serverTime: number; roomId: string }>(
        (resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("No reply within 60s.")),
            60_000,
          );
          room.onMessage(
            "pong",
            (message: { serverTime: number; roomId: string }) => {
              clearTimeout(timeout);
              resolve(message);
            },
          );
          room.send("ping", { sentAt: Date.now() });
        },
      );

      setRoundTrip(Math.round(performance.now() - sentAt));
      setDetail(`Room ${reply.roomId}`);
      setStatus("ok");
      await room.leave();
    } catch (error) {
      setDetail(error instanceof Error ? error.message : String(error));
      setStatus("failed");
    }
  }, [endpoint]);

  return (
    <Panel>
      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-extrabold tracking-tight text-floodlight uppercase">
            Colyseus
          </h2>
          <p className="font-mono text-xs break-all text-floodlight/45 tabular-nums">
            {endpoint}
          </p>
        </div>

        <p className="font-sans text-sm text-floodlight/70">
          {status === "idle" && "Not yet checked."}
          {status === "connecting" &&
            "Connecting… first attempt can take ~50s if the server is waking."}
          {status === "ok" && (
            <span className="text-signal">
              Connected and message round-tripped.
            </span>
          )}
          {status === "failed" && (
            <span className="text-tally">Failed. {detail}</span>
          )}
        </p>

        {status === "ok" && (
          <dl className="flex flex-col gap-1 font-mono text-sm tabular-nums">
            <div className="flex justify-between">
              <dt className="text-floodlight/45">Round trip</dt>
              <dd className="text-floodlight">{roundTrip} ms</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-floodlight/45">Room</dt>
              <dd className="text-floodlight">{detail}</dd>
            </div>
          </dl>
        )}

        <Button onClick={runCheck} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting…" : "Run handshake check"}
        </Button>
      </div>
    </Panel>
  );
}
