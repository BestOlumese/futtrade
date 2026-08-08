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
      setDetail(reply.roomId);
      setStatus("ok");
      await room.leave();
    } catch (error) {
      setDetail(error instanceof Error ? error.message : String(error));
      setStatus("failed");
    }
  }, [endpoint]);

  return (
    <Panel bodyClassName="p-5 flex flex-col gap-3">
      <h2 className="display-md text-floodlight">Colyseus</h2>
      <p className="numeric text-xs break-all text-mute">{endpoint}</p>

      <p className="font-sans text-sm leading-relaxed">
        {status === "idle" && (
          <span className="text-floodlight/60">Not yet checked.</span>
        )}
        {status === "connecting" && (
          <span className="text-floodlight/60">
            Connecting… first attempt can take ~50s if the server is waking.
          </span>
        )}
        {status === "ok" && (
          <span className="text-lime">Connected and message round-tripped.</span>
        )}
        {status === "failed" && (
          <span className="text-live">Failed. {detail}</span>
        )}
      </p>

      {status === "ok" && (
        <div className="flex flex-col">
          <div className="flex items-baseline justify-between border-b border-steel/20 py-2">
            <span className="label text-mute">Round trip</span>
            <span className="numeric text-xs text-floodlight">
              {roundTrip} ms
            </span>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <span className="label text-mute">Room</span>
            <span className="numeric text-xs text-floodlight">{detail}</span>
          </div>
        </div>
      )}

      <div className="mt-auto pt-1">
        <Button
          onClick={runCheck}
          disabled={status === "connecting"}
          className="w-full"
        >
          {status === "connecting" ? "Connecting…" : "Run handshake check"}
        </Button>
      </div>
    </Panel>
  );
}
