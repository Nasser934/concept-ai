import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const reportStatusHistoryTable = pgTable("report_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull(),
  changedBy: text("changed_by").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ReportStatusHistory = typeof reportStatusHistoryTable.$inferSelect;
