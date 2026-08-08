"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Client, type Room } from "colyseus.js";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { LiveBadge } from "@/components/ui/live-badge";
import { notify } from "@/components/ui/toaster";

/**
 * Phase 01 surface: the authoritative tick, made visible.
 *
 * The clock is server time. This component never advances `tick` itself — it
 * only displays what the room last confirmed. Per
 * docs/concerns/02-realtime-sync-reconnection.md, a client that runs its own
 * clock drifts, and drift is indistinguishable from desync.
 *
 * When the socket drops, the last-known state is frozen and clearly marked
 * stale rather than continuing to animate as though nothing happened.
 */

type Slot = { userId: string; username: string; connected: boolean; joinedAtTick: number };
type Status = "idle" | "connecting" | "live" | "reconnecting" | "closed" | "refused";

export function TickRoom() {
  const [status, setStatus] = useState<Status>("idle");
  const [tick, setTick] = useState(0);
  const [tickAt, setTickAt] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [detail, setDetail] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  /** Age of the newest confirmed tick, so staleness is visible, not implied. */
  const [age, setAge] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const clientRef = useRef<Client | null>(null);
  /**
   * Colyseus reserves the dropped player's seat and hands back this token. The
   * room locks at two managers, so a plain re-join is refused — reclaiming the
   * held seat is the only way back in, and it's what makes a rejoin a *resume*
   * rather than a new player taking the slot.
   */
  const reconnectTokenRef = useRef<string | null>(null);
  const deliberateRef = useRef(false);

  useEffect(() => {
    if (!tickAt) return;
    const id = setInterval(() => setAge(Date.now() - tickAt), 250);
    return () => clearInterval(id);
  }, [tickAt]);

  const readState = useCallback((state: Record<string, unknown>) => {
    setTick(Number(state.tick ?? 0));
    setTickAt(Number(state.tickAt ?? 0) || Date.now());

    const players = state.players as
      | { forEach: (fn: (v: Slot) => void) => void }
      | undefined;
    const next: Slot[] = [];
    players?.forEach((slot) => {
      next.push({
        userId: slot.userId,
        username: slot.username,
        connected: slot.connected,
        joinedAtTick: slot.joinedAtTick,
      });
    });
    setSlots(next);
  }, []);

  const attachRef = useRef<((room: Room) => void) | null>(null);

  /** Reclaims the held seat, retrying while the grace period lasts. */
  const recover = useCallback(async () => {
    const client = clientRef.current;
    const token = reconnectTokenRef.current;
    if (!client || !token) {
      setStatus("closed");
      return;
    }

    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const room = await client.reconnect(token);
        attachRef.current?.(room);
        notify.ok("Reconnected", "Resynced to the server tick.");
        return;
      } catch {
        // The seat is held for 60s; keep trying across that window rather than
        // giving up on the first failure.
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }

    setStatus("closed");
    setDetail("Couldn't get back in — the grace period expired.");
    notify.problem("Reconnection failed", "The slot was released.");
  }, []);

  const attach = useCallback(
    (room: Room) => {
      roomRef.current = room;
      reconnectTokenRef.current = room.reconnectionToken;
      setMe(room.sessionId);
      setStatus("live");
      setDetail(null);

      room.onStateChange((state) => readState(state as Record<string, unknown>));

      room.onLeave(() => {
        if (deliberateRef.current) {
          setStatus("closed");
          return;
        }
        // Anything that isn't a deliberate leave is a drop worth recovering.
        setStatus("reconnecting");
        void recover();
      });

      room.onError((code, message) => {
        setDetail(`${code}: ${message ?? "unknown error"}`);
      });
    },
    [readState, recover],
  );

  // Kept in a ref so `recover` can call the latest `attach` without the two
  // depending on each other. Assigned in an effect, never during render.
  useEffect(() => {
    attachRef.current = attach;
  }, [attach]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setDetail(null);

    try {
      // Identity first: the app mints a short-lived ticket from the real
      // session, which the room verifies. Nothing long-lived reaches the
      // browser.
      const res = await fetch("/api/match/ticket", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus("refused");
        setDetail(body.error ?? "Could not get a match ticket.");
        return;
      }
      const { ticket } = await res.json();

      const endpoint =
        process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";
      const client = new Client(endpoint);
      clientRef.current = client;
      deliberateRef.current = false;
      const room = await client.joinOrCreate("match", { ticket });
      attach(room);
      notify.ok("Joined the match room");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("refused");
      setDetail(message);
      notify.problem("Couldn't join", message);
    }
  }, [attach]);

  /**
   * Simulates losing the connection, as distinct from choosing to leave.
   *
   * `leave(false)` closes without sending the leave message, so the server sees
   * a non-consented disconnect and holds the slot for the grace period. Closing
   * the socket directly looks like a deliberate leave to Colyseus and releases
   * the slot immediately — which tests the opposite of what we want.
   */
  const simulateDrop = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;
    deliberateRef.current = false;
    setStatus("reconnecting");
    notify.info("Connection dropped", "Rejoin to resync to the server tick.");
    void room.leave(false);
  }, []);

  const leave = useCallback(async () => {
    deliberateRef.current = true;
    reconnectTokenRef.current = null;
    await roomRef.current?.leave(true);
    roomRef.current = null;
    setStatus("closed");
    setSlots([]);
  }, []);

  useEffect(
    () => () => {
      deliberateRef.current = true;
      roomRef.current?.leave(false);
    },
    [],
  );

  const stale = status === "reconnecting" || status === "closed";

  return (
    <Panel brackets bodyClassName="p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        {status === "live" ? (
          <LiveBadge />
        ) : (
          <span className="label text-mute">
            {status === "reconnecting"
              ? "Reconnecting…"
              : status === "connecting"
                ? "Connecting…"
                : status === "refused"
                  ? "Refused"
                  : status === "closed"
                    ? "Left"
                    : "Not connected"}
          </span>
        )}
        <span className="label text-mute">Phase 01 · tick loop</span>
      </div>

      {/* The tick itself. Frozen and marked when the connection is not live —
          never left animating as if it were still current. */}
      <div className="flex flex-col gap-2">
        <span className="label text-mute">
          Server tick {stale && tick > 0 ? "· last known" : ""}
        </span>
        <span
          className={`numeric text-6xl leading-none ${stale ? "text-mute" : "text-lime"}`}
        >
          {String(tick).padStart(4, "0")}
        </span>
        {tickAt > 0 && (
          <span className="numeric text-xs text-mute">
            {stale
              ? `frozen ${(age / 1000).toFixed(0)}s ago`
              : `updated ${(age / 1000).toFixed(1)}s ago`}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="label text-mute">Managers ({slots.length}/2)</span>
        <div className="flex flex-col">
          {slots.length === 0 && (
            <p className="font-sans text-sm text-floodlight/45">
              Nobody has joined yet.
            </p>
          )}
          {slots.map((slot) => (
            <div
              key={slot.userId}
              className="flex items-baseline justify-between gap-3 border-b border-steel/20 py-2 last:border-0"
            >
              <span className="font-sans text-sm text-floodlight">
                {slot.username}
                {me && slot.userId && status === "live" ? "" : ""}
              </span>
              <span className="flex items-baseline gap-3">
                <span className="numeric text-xs text-mute">
                  joined @ {slot.joinedAtTick}
                </span>
                <span
                  className={`label ${slot.connected ? "text-lime" : "text-live"}`}
                >
                  {slot.connected ? "Connected" : "Absent"}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {detail && (
        <p className="border-l-2 border-live pl-3 font-sans text-sm text-floodlight">
          {detail}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {status !== "live" ? (
          <Button onClick={connect} disabled={status === "connecting"}>
            {status === "connecting" ? "Connecting…" : "Join match room"}
          </Button>
        ) : (
          <>
            {/* Dev affordance. Goes when the real viewer lands in Phase 06. */}
            <Button variant="secondary" onClick={simulateDrop}>
              Simulate connection drop
            </Button>
            <Button variant="ghost" onClick={leave}>
              Leave room
            </Button>
          </>
        )}
      </div>

      <p className="font-sans text-xs leading-relaxed text-floodlight/45">
        The clock is the server&apos;s. This page only displays what the room
        last confirmed — it never advances the tick itself. A dropped manager
        has 60 seconds to rejoin; the match carries on without them.
      </p>
    </Panel>
  );
}
