"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Client, type Room } from "colyseus.js";
import { Panel } from "@/components/ui/panel";
import { Button, ButtonLink } from "@/components/ui/button";
import { LiveBadge } from "@/components/ui/live-badge";
import { notify } from "@/components/ui/toaster";
import { DialControl } from "./dial-control";

/**
 * Phase 02 match surface.
 *
 * Every number here is read from the room, never computed locally. The client
 * sends INTENT — "I want attacking" — and the server decides whether that is
 * allowed, spends the change budget, and reports the result. A rejected change
 * comes back as a message rather than being silently swallowed, so a manager
 * always knows why nothing happened.
 */

const MENTALITIES = ["defensive", "balanced", "attacking"] as const;
const PRESSING = ["low", "medium", "high"] as const;
type Mentality = (typeof MENTALITIES)[number];
type Pressing = (typeof PRESSING)[number];

const MENTALITY_CAPTION: Record<Mentality, string> = {
  defensive: "Fewer shots, less of the ball — but what they get is poor.",
  balanced: "No lean either way.",
  attacking: "More shots and more of the ball — their chances get much better.",
};

const PRESSING_CAPTION: Record<Pressing, string> = {
  low: "Sit off. You see less of the ball, they get little in behind.",
  medium: "No lean either way.",
  high: "Win it back higher — at the cost of space behind you.",
};

type Slot = {
  userId: string; username: string; connected: boolean; side: string;
  mentality: Mentality; pressing: Pressing; changesUsed: number;
};
type Score = { goals: number; shots: number; xg: number; possession: number };
type Status = "idle" | "connecting" | "in" | "reconnecting" | "closed" | "refused";

const CHANGES_PER_HALF = 3;

export function MatchRoomPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [phase, setPhase] = useState("lobby");
  const [minute, setMinute] = useState(0);
  const [half, setHalf] = useState(1);
  const [home, setHome] = useState<Score>({ goals: 0, shots: 0, xg: 0, possession: 50 });
  const [away, setAway] = useState<Score>({ goals: 0, shots: 0, xg: 0, possession: 50 });
  const [slots, setSlots] = useState<Slot[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  // Published by the room at kickoff so full time can link straight to the
  // summary, rather than making a manager go hunting for the match they just
  // played.
  const [matchId, setMatchId] = useState("");
  const [detail, setDetail] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const clientRef = useRef<Client | null>(null);
  const tokenRef = useRef<string | null>(null);
  const deliberateRef = useRef(false);
  const attachRef = useRef<((room: Room) => void) | null>(null);

  const me = slots.find((s) => s.userId === meId) ?? null;
  const mySide = me?.side ?? "home";
  const myScore = mySide === "home" ? home : away;
  const theirScore = mySide === "home" ? away : home;
  const opponent = slots.find((s) => s.userId !== meId) ?? null;

  const readState = useCallback((state: Record<string, unknown>) => {
    setPhase(String(state.phase ?? "lobby"));
    setMatchId(String(state.matchId ?? ""));
    setMinute(Number(state.minute ?? 0));
    setHalf(Number(state.half ?? 1));
    const asScore = (v: unknown): Score => {
      const s = v as Score | undefined;
      return {
        goals: Number(s?.goals ?? 0), shots: Number(s?.shots ?? 0),
        xg: Number(s?.xg ?? 0), possession: Number(s?.possession ?? 50),
      };
    };
    setHome(asScore(state.home));
    setAway(asScore(state.away));

    const players = state.players as { forEach: (fn: (v: Slot) => void) => void } | undefined;
    const next: Slot[] = [];
    players?.forEach((s) =>
      next.push({
        userId: s.userId, username: s.username, connected: s.connected,
        side: s.side, mentality: s.mentality, pressing: s.pressing,
        changesUsed: s.changesUsed,
      }),
    );
    setSlots(next);
  }, []);

  const recover = useCallback(async () => {
    const client = clientRef.current;
    const token = tokenRef.current;
    if (!client || !token) { setStatus("closed"); return; }
    for (let attempt = 1; attempt <= 6; attempt++) {
      try {
        const room = await client.reconnect(token);
        attachRef.current?.(room);
        notify.ok("Reconnected", "Resynced to the match.");
        return;
      } catch {
        await new Promise((r) => setTimeout(r, attempt * 1500));
      }
    }
    setStatus("closed");
    notify.problem("Reconnection failed", "The slot was released.");
  }, []);

  const attach = useCallback((room: Room) => {
    roomRef.current = room;
    tokenRef.current = room.reconnectionToken;
    setStatus("in");
    setDetail(null);

    // The room reports our own id back so the UI can tell which side is ours.
    const state = room.state as unknown as Record<string, unknown>;
    readState(state);

    room.onStateChange((s) => readState(s as unknown as Record<string, unknown>));
    room.onMessage("rejected", (m: { reason?: string }) => {
      notify.problem("Change refused", m.reason ?? "The server rejected it.");
    });
    room.onLeave(() => {
      if (deliberateRef.current) { setStatus("closed"); return; }
      setStatus("reconnecting");
      void recover();
    });
    room.onError((code, message) => setDetail(`${code}: ${message ?? "error"}`));
  }, [readState, recover]);

  useEffect(() => { attachRef.current = attach; }, [attach]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setDetail(null);
    try {
      const res = await fetch("/api/match/ticket", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus("refused");
        setDetail(body.error ?? "Could not get a match ticket.");
        return;
      }
      const { ticket, userId } = await res.json();
      setMeId(userId ?? null);

      const endpoint = process.env.NEXT_PUBLIC_COLYSEUS_URL ?? "ws://localhost:2567";
      const client = new Client(endpoint);
      clientRef.current = client;
      deliberateRef.current = false;
      attach(await client.joinOrCreate("match", { ticket }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus("refused");
      setDetail(message);
      notify.problem("Couldn't join", message);
    }
  }, [attach]);

  const setDials = useCallback((mentality: Mentality, pressing: Pressing) => {
    roomRef.current?.send("dials", { mentality, pressing });
  }, []);

  const leave = useCallback(async () => {
    deliberateRef.current = true;
    tokenRef.current = null;
    await roomRef.current?.leave(true);
    roomRef.current = null;
    setStatus("closed");
    setSlots([]);
  }, []);

  useEffect(() => () => { deliberateRef.current = true; roomRef.current?.leave(false); }, []);

  if (status !== "in" && status !== "reconnecting") {
    return (
      <Panel brackets bodyClassName="p-6 flex flex-col gap-4">
        <h2 className="display-md text-floodlight">Match room</h2>
        <p className="font-sans text-sm leading-relaxed text-floodlight/55">
          Pick your approach, kick off, and watch 90 minutes resolve in 90
          seconds. Your dials are applied by the server on the next tick.
        </p>
        {detail && (
          <p className="border-l-2 border-live pl-3 font-sans text-sm text-floodlight">
            {detail}
          </p>
        )}
        <Button onClick={connect} disabled={status === "connecting"}>
          {status === "connecting" ? "Joining…" : "Join match room"}
        </Button>
      </Panel>
    );
  }

  const stale = status === "reconnecting";
  const live = phase === "live";
  const changesLeft = CHANGES_PER_HALF - (me?.changesUsed ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <Panel live={live} brackets bodyClassName="p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          {live && !stale ? (
            <LiveBadge />
          ) : (
            <span className="label text-mute">
              {stale ? "Reconnecting…" : phase === "fulltime" ? "Full time" : "Lobby"}
            </span>
          )}
          <span className="numeric text-sm text-floodlight/70">
            {stale ? "last known · " : ""}
            {phase === "lobby" ? "not started" : `${minute}′ · H${half}`}
          </span>
        </div>

        {/* Scoreline, from the room */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="label text-lime">You</span>
            <span className="truncate font-sans text-sm text-floodlight">
              {me?.username ?? "—"}
            </span>
          </div>
          <div className={`numeric shrink-0 text-5xl leading-none ${stale ? "text-mute" : "text-floodlight"}`}>
            {myScore.goals}
            <span className="px-1 text-mute">:</span>
            {theirScore.goals}
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end gap-1">
            <span className="label text-mute">Opponent</span>
            <span className="truncate text-right font-sans text-sm text-floodlight">
              {opponent?.username ?? "Default dials"}
            </span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-px bg-steel/20">
          {[
            { k: "Possession", v: `${myScore.possession}% · ${theirScore.possession}%` },
            { k: "Shots", v: `${myScore.shots} · ${theirScore.shots}` },
            { k: "xG", v: `${myScore.xg.toFixed(2)} · ${theirScore.xg.toFixed(2)}` },
          ].map((s) => (
            <div key={s.k} className="flex flex-col gap-1 bg-surface px-3 py-2.5">
              <dt className="label text-mute">{s.k}</dt>
              <dd className="numeric text-sm text-floodlight">{s.v}</dd>
            </div>
          ))}
        </dl>

        {phase === "lobby" && (
          <Button onClick={() => roomRef.current?.send("kickoff")}>Kick off</Button>
        )}
        {phase === "fulltime" && (
          <div className="flex flex-col gap-3">
            <p className="font-sans text-sm leading-relaxed text-floodlight/60">
              Full time. You played{" "}
              <span className="text-lime">{me?.mentality} / {me?.pressing}</span>;
              they played{" "}
              <span className="text-floodlight">
                {opponent?.mentality ?? "balanced"} / {opponent?.pressing ?? "medium"}
              </span>.
            </p>
            <div className="flex flex-wrap gap-3">
              {matchId && (
                <ButtonLink href={`/match/${matchId}`}>Match summary</ButtonLink>
              )}
              <Button
                variant={matchId ? "secondary" : "primary"}
                onClick={() => roomRef.current?.send("rematch")}
              >
                Rematch
              </Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel bodyClassName="p-6 flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="display-md text-floodlight">Tactics</h3>
          <span className="label text-mute">
            {phase === "lobby"
              ? "free before kickoff"
              : `${Math.max(0, changesLeft)} of ${CHANGES_PER_HALF} left this half`}
          </span>
        </div>

        <DialControl
          label="Mentality"
          options={MENTALITIES}
          value={(me?.mentality ?? "balanced") as Mentality}
          captions={MENTALITY_CAPTION}
          disabled={phase === "fulltime"}
          onChange={(m) => setDials(m, (me?.pressing ?? "medium") as Pressing)}
        />
        <DialControl
          label="Pressing"
          options={PRESSING}
          value={(me?.pressing ?? "medium") as Pressing}
          captions={PRESSING_CAPTION}
          disabled={phase === "fulltime"}
          onChange={(p) => setDials((me?.mentality ?? "balanced") as Mentality, p)}
        />

        <div className="flex flex-col gap-2 border-t border-steel/25 pt-5">
          {slots.map((s) => (
            <div key={s.userId} className="flex items-baseline justify-between gap-3">
              <span className="font-sans text-xs text-floodlight">
                {s.username} <span className="text-mute">({s.side})</span>
              </span>
              <span className="flex items-baseline gap-3">
                <span className="numeric text-xs text-mute capitalize">
                  {s.mentality} / {s.pressing}
                </span>
                <span className={`label ${s.connected ? "text-lime" : "text-live"}`}>
                  {s.connected ? "on" : "absent"}
                </span>
              </span>
            </div>
          ))}
          {slots.length < 2 && (
            <p className="font-sans text-xs leading-relaxed text-floodlight/45">
              The empty side plays balanced / medium and never changes. Not an
              opponent — just something to test against.
            </p>
          )}
        </div>

        <Button variant="ghost" onClick={leave}>Leave room</Button>
      </Panel>
    </div>
  );
}
