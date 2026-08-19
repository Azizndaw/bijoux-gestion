import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

export const appState = pgTable("app_state", {
  id: integer("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
