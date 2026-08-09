CREATE TABLE "match_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text,
	"message_type" text NOT NULL,
	"reason" text NOT NULL,
	"payload" text,
	"at" timestamp NOT NULL
);
