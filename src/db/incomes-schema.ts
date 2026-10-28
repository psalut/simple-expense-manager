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
import { user } from "./auth-schema";

export const incomes = pgTable(
  "incomes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
    currency: text("currency").default("ARS").notNull(),
    description: text("description").notNull(),
    incomeDate: date("income_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    check("incomes_amount_positive_check", sql`${table.amountCents} > 0`),
    check("incomes_currency_ars_check", sql`${table.currency} = 'ARS'`),
    check(
      "incomes_description_valid_check",
      sql`char_length(btrim(${table.description})) BETWEEN 1 AND 200`,
    ),
    index("incomes_user_date_idx").on(table.userId, table.incomeDate),
  ],
);
