import {
  integer,
  sqliteTable,
  text,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const dailyEvents = sqliteTable(
  "daily_events",
  {
    day: text("day").notNull(),
    session: text("session").notNull(),
    event: text("event").notNull(),
    source: text("source").notNull(),
    device: text("device").notNull(),
    count: integer("count").notNull().default(1),
  },
  (table) => [
    primaryKey({ columns: [table.day, table.session, table.event] }),
    index("events_day").on(table.day),
  ],
);
