import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { categories } from "./categories-schema";
import { user } from "./auth-schema";
import { sharedSpaces } from "./shared-space-schema";

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").default("ARS").notNull(),
    description: text("description").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    sharedSpaceId: text("shared_space_id").references(
      () => sharedSpaces.id,
      { onDelete: "restrict" },
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("expenses_amount_positive_check", sql`${table.amountCents} > 0`),
    check("expenses_currency_ars_check", sql`${table.currency} = 'ARS'`),
    check(
      "expenses_description_valid_check",
      sql`char_length(btrim(${table.description})) BETWEEN 1 AND 200`,
    ),
    index("expenses_user_date_idx").on(table.userId, table.expenseDate),
    index("expenses_shared_space_date_idx").on(
      table.sharedSpaceId,
      table.expenseDate,
    ),
    index("expenses_category_id_idx").on(table.categoryId),
  ],
);
