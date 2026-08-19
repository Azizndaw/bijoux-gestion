CREATE TABLE "app_state" (
	"id" integer PRIMARY KEY,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
