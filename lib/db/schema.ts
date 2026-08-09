import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Phase 00 schema — auth only.
 *
 * These four tables are Better Auth's required core schema; the column names
 * are dictated by the Better Auth Drizzle adapter and must not be renamed.
 *
 * Nothing game-related belongs here yet. The player/match/event tables arrive
 * in their own phases (09, 04) — and per AGENTS.md the match-event stream is
 * the spine of the system, so it gets designed deliberately in Phase 04 rather
 * than sketched early here.
 */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  /**
   * Added by the Better Auth username plugin. `username` is the normalised
   * (lower-cased) form and carries the unique constraint, so `Delane` and
   * `delane` cannot both exist; `display_username` preserves the casing the
   * player typed. Uniqueness lives in the database rather than in a check
   * before insert, which would race under concurrent signups.
   */
  username: text("username").unique(),
  displayUsername: text("display_username"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [uniqueIndex("session_token_idx").on(table.token)],
);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()),
});

/**
 * The match record. Phase 02 wrote the result; Phase 04 gave it a lifecycle.
 *
 * The row is inserted AT KICKOFF with `status = 'live'`, not at full time. That
 * is what lets match_event carry a real foreign key from the first mid-match
 * flush onward — and it means a match that crashed in the 60th minute is a row
 * you can find and investigate rather than silence.
 *
 * The aggregate columns below are all derivable from match_event now. They are
 * kept anyway, as a denormalised summary so a match-history list is one cheap
 * query — and the duplication is made safe by being asserted: `events:verify`
 * sums the event log and requires it to equal these exactly. See
 * docs/features/03-event-stream.md.
 *
 * User ids are nullable because a slot can be unfilled: a manager may play a
 * match alone against fixed default dials.
 */
export const match = pgTable("match", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),

  homeUserId: text("home_user_id").references(() => user.id, { onDelete: "set null" }),
  awayUserId: text("away_user_id").references(() => user.id, { onDelete: "set null" }),

  /** `live` at kickoff → `finished` at full time, or `abandoned` if the room died. */
  status: text("status").notNull().default("live"),

  // Zero at kickoff and rewritten at full time, so they need defaults: the
  // insert happens before a ball has been kicked.
  homeScore: integer("home_score").notNull().default(0),
  awayScore: integer("away_score").notNull().default(0),
  homeShots: integer("home_shots").notNull().default(0),
  awayShots: integer("away_shots").notNull().default(0),
  homeXg: real("home_xg").notNull().default(0),
  awayXg: real("away_xg").notNull().default(0),
  homePossession: integer("home_possession").notNull().default(50),

  // The dials each side finished on. Enough to analyse the exit criterion
  // against real played matches, not only simulated ones.
  homeMentality: text("home_mentality").notNull(),
  homePressing: text("home_pressing").notNull(),
  awayMentality: text("away_mentality").notNull(),
  awayPressing: text("away_pressing").notNull(),

  startedAt: timestamp("started_at")
    .$defaultFn(() => new Date())
    .notNull(),
  /** Null while the match is live — full time is not known at kickoff. */
  finishedAt: timestamp("finished_at"),
});

/**
 * Phase 04 — the match event stream. Per AGENTS.md this is the spine of the
 * whole system: the shot map, heatmap, momentum graph, live ticker, player
 * ratings and market price movement are all derived from these rows and from no
 * other data path. Read docs/features/03-event-stream.md before changing it.
 *
 * `seq` runs 1..N per match with no gaps, and the unique index below makes that
 * a property the DATABASE enforces rather than one a test hopes to notice. A
 * retried flush violates the index; a lost batch shows up as
 * `max(seq) != count(*)`. Both are checked by `events:verify`.
 *
 * `x` is always measured toward the goal the ACTING side is attacking, for both
 * sides and in both halves — so x = 95 is near the opponent's goal whichever
 * team took the shot. Absolute coordinates plus a direction flag would mean
 * every consumer has to remember to flip, and the one that forgets draws half
 * the shots in its own box.
 */
export const matchEvent = pgTable(
  "match_event",
  {
    id: text("id").primaryKey(),
    matchId: text("match_id")
      .notNull()
      .references(() => match.id, { onDelete: "cascade" }),

    /** 1..N within the match, contiguous. The integrity guarantee. */
    seq: integer("seq").notNull(),
    tick: integer("tick").notNull(),
    /**
     * Display clock. Spread WITHIN the tick rather than equal to `tick × 3`, so
     * a ticker doesn't stack five events on the same minute — which is why this
     * is stored rather than derived.
     */
    minute: integer("minute").notNull(),

    /** The side of the primary actor: `home` or `away`. */
    side: text("side").notNull(),
    /** `shot` | `pass` | `tackle` | `card` | `sub`. */
    type: text("type").notNull(),
    /** Per type — see the table in docs/features/03-event-stream.md. */
    outcome: text("outcome").notNull(),

    x: real("x").notNull(),
    y: real("y").notNull(),
    /** Shots only. The chance quality the sim actually rolled against. */
    xg: real("xg"),

    /** 1–11. Meaningful today, and unchanged by the arrival of real players. */
    shirt: integer("shirt").notNull(),
    /**
     * The assister, receiver, dispossessed player or player going off. Same side
     * as `shirt` for every type EXCEPT `tackle`, where it is the opponent.
     */
    secondaryShirt: integer("secondary_shirt"),

    /**
     * Null on every row written today. Phase 10 backfills real player ids
     * alongside the shirt number rather than replacing it, so the column exists
     * now to spare that phase a migration.
     */
    playerId: text("player_id"),
    secondaryPlayerId: text("secondary_player_id"),
  },
  (table) => [
    uniqueIndex("match_event_match_seq_idx").on(table.matchId, table.seq),
    index("match_event_match_idx").on(table.matchId),
  ],
);

/**
 * Phase 03 — the audit trail for rejected client messages.
 *
 * Only rejections land here. Accepted messages are logged as structured JSON to
 * stdout instead: one row per dial change per match is reasonable, one per tick
 * is not, and a table nobody can afford to read is not an audit trail.
 *
 * The payload is stored as text rather than jsonb deliberately — it is hostile
 * input by definition, and the point is to preserve exactly what arrived, not
 * to make it queryable as structured data.
 */
export const matchAudit = pgTable("match_audit", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  userId: text("user_id"),
  messageType: text("message_type").notNull(),
  reason: text("reason").notNull(),
  /** Truncated — an attacker controls the length. */
  payload: text("payload"),
  at: timestamp("at")
    .$defaultFn(() => new Date())
    .notNull(),
});

export const schema = {
  user,
  session,
  account,
  verification,
  match,
  matchEvent,
  matchAudit,
};
