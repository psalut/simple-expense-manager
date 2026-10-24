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
import { user } from "./auth-schema";
import { sharedSpaces } from "./shared-space-schema";

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    sharedSpaceId: text("shared_space_id").references(() => sharedSpaces.id, {
      onDelete: "cascade",
    }),
    isArchived: boolean("is_archived").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check(
      "categories_owner_xor_shared_space_check",
      sql`(${table.userId} IS NOT NULL AND ${table.sharedSpaceId} IS NULL) OR (${table.userId} IS NULL AND ${table.sharedSpaceId} IS NOT NULL)`,
    ),
    check(
      "categories_name_valid_check",
      sql`char_length(btrim(${table.name})) BETWEEN 1 AND 80`,
    ),
    check(
      "categories_description_valid_check",
      sql`char_length(btrim(${table.description})) BETWEEN 1 AND 500`,
    ),
    uniqueIndex("categories_user_active_name_unique")
      .on(sql`lower(btrim(${table.name}))`, table.userId)
      .where(sql`${table.isArchived} = false AND ${table.userId} IS NOT NULL`),
    uniqueIndex("categories_shared_active_name_unique")
      .on(sql`lower(btrim(${table.name}))`, table.sharedSpaceId)
      .where(
        sql`${table.isArchived} = false AND ${table.sharedSpaceId} IS NOT NULL`,
      ),
    index("categories_user_archived_idx").on(table.userId, table.isArchived),
    index("categories_shared_space_archived_idx").on(
      table.sharedSpaceId,
      table.isArchived,
    ),
  ],
);
