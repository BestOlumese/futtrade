"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RacePoint } from "@/lib/match/derive";

/**
 * Cumulative xG per side against the match clock.
 *
 * A STEP line, not a smooth one. xG only moves when a shot is taken, so a flat
 * stretch genuinely means a quiet spell — interpolating between shots would draw
 * a chance that never happened, which is the sort of small lie a chart makes
 * very persuasively.
 *
 * Goals are marked on the line, because the interesting thing about an xG race
 * is where it disagrees with the scoreline.
 *
 * A client component only because recharts measures the DOM. The data arrives
 * fully derived from the server; nothing is computed here.
 */
export function XgRace({
  data,
  homeName,
  awayName,
}: {
  data: RacePoint[];
  homeName: string;
  awayName: string;
}) {
  const goals = data.filter((p) => p.goal);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <Key colour="var(--color-lime)" name={homeName} />
        <Key colour="var(--color-floodlight)" name={awayName} />
        <span className="ml-auto font-sans text-xs text-mute">
          Cumulative xG · dots are goals
        </span>
      </div>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid
              stroke="var(--color-steel)"
              strokeOpacity={0.22}
              vertical={false}
            />
            <XAxis
              dataKey="minute"
              type="number"
              domain={[0, 90]}
              ticks={[0, 15, 30, 45, 60, 75, 90]}
              tickFormatter={(m) => `${m}′`}
              stroke="var(--color-mute)"
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--color-steel)", strokeOpacity: 0.4 }}
            />
            <YAxis
              stroke="var(--color-mute)"
              tick={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v: number) => v.toFixed(1)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface-2)",
                border: "1px solid color-mix(in srgb, var(--color-steel) 50%, transparent)",
                // No border-radius anywhere in this system, charts included.
                borderRadius: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
              labelStyle={{ color: "var(--color-mute)" }}
              labelFormatter={(m) => `${m}′`}
              formatter={(value, name) => [Number(value ?? 0).toFixed(2), String(name)]}
            />
            <Line
              type="stepAfter"
              dataKey="home"
              name={homeName}
              stroke="var(--color-lime)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="stepAfter"
              dataKey="away"
              name={awayName}
              stroke="var(--color-floodlight)"
              strokeWidth={2}
              strokeOpacity={0.8}
              dot={false}
              isAnimationActive={false}
            />
            {goals.map((p) => (
              <ReferenceDot
                key={`${p.minute}-${p.goal}`}
                x={p.minute}
                y={p.goal === "home" ? p.home : p.away}
                r={4}
                fill={p.goal === "home" ? "var(--color-lime)" : "var(--color-floodlight)"}
                stroke="var(--color-midnight)"
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Key({ colour, name }: { colour: string; name: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-0.5 w-4" style={{ background: colour }} aria-hidden />
      <span className="font-sans text-xs text-floodlight">{name}</span>
    </span>
  );
}
