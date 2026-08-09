CREATE TABLE "match_event" (
	"id" text PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"seq" integer NOT NULL,
	"tick" integer NOT NULL,
	"minute" integer NOT NULL,
	"side" text NOT NULL,
	"type" text NOT NULL,
	"outcome" text NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"xg" real,
	"shirt" integer NOT NULL,
	"secondary_shirt" integer,
	"player_id" text,
	"secondary_player_id" text
);
--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "home_score" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "away_score" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "home_shots" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "away_shots" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "home_xg" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "away_xg" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "home_possession" SET DEFAULT 50;--> statement-breakpoint
ALTER TABLE "match" ALTER COLUMN "finished_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "match" ADD COLUMN "status" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
-- Hand-edited: drizzle-kit generated this column as NOT NULL with no default,
-- which fails outright on a table that already has rows. Every existing match
-- was written at full time, so its start is best known as its finish.
ALTER TABLE "match" ADD COLUMN "started_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "match" SET "started_at" = "finished_at" WHERE "finished_at" IS NOT NULL;--> statement-breakpoint
-- Hand-edited: the ADD COLUMN default marks every pre-existing row 'live'. They
-- are all finished matches from Phase 02 — leaving them 'live' would strand them
-- forever in a state the abandoned-match sweep would later mislabel.
UPDATE "match" SET "status" = 'finished' WHERE "finished_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "match_event" ADD CONSTRAINT "match_event_match_id_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_event_match_seq_idx" ON "match_event" USING btree ("match_id","seq");--> statement-breakpoint
CREATE INDEX "match_event_match_idx" ON "match_event" USING btree ("match_id");