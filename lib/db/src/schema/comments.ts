import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const reportCommentsTable = pgTable("report_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull(),
  userId: text("user_id").notNull(),
  section: text("section"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ReportComment = typeof reportCommentsTable.$inferSelect;
