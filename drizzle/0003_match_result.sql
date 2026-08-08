CREATE TABLE "match" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"home_user_id" text,
	"away_user_id" text,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"home_shots" integer NOT NULL,
	"away_shots" integer NOT NULL,
	"home_xg" real NOT NULL,
	"away_xg" real NOT NULL,
	"home_possession" integer NOT NULL,
	"home_mentality" text NOT NULL,
	"home_pressing" text NOT NULL,
	"away_mentality" text NOT NULL,
	"away_pressing" text NOT NULL,
	"finished_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_home_user_id_user_id_fk" FOREIGN KEY ("home_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_away_user_id_user_id_fk" FOREIGN KEY ("away_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;