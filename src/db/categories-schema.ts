import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    color: text("color").notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "categories_name_valid_check",
      sql`char_length(trim(regexp_replace(${table.name}, '[[:space:]]+', ' ', 'g'))) BETWEEN 1 AND 60`,
    ),
    check(
      "categories_description_valid_check",
      sql`char_length(trim(regexp_replace(${table.description}, '[[:space:]]+', ' ', 'g'))) BETWEEN 1 AND 500`,
    ),
    check(
      "categories_color_valid_check",
      sql`${table.color} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    uniqueIndex("categories_active_name_unique")
      .on(
        sql`lower(trim(regexp_replace(${table.name}, '[[:space:]]+', ' ', 'g')))`
      )
      .where(sql`${table.isArchived} = false`),
    index("categories_archived_idx").on(table.isArchived, table.name),
  ],
);
