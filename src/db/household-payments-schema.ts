import { sql } from "drizzle-orm";
import { bigint, check, date, foreignKey, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sharedSpaceMembers, sharedSpaces } from "./shared-space-schema";
import { user } from "./auth-schema";

export const householdPayments = pgTable("household_payments", {
  id: text("id").primaryKey(),
  sharedSpaceId: text("shared_space_id").notNull().references(() => sharedSpaces.id, { onDelete: "restrict" }),
  payerUserId: text("payer_user_id").notNull(),
  receiverUserId: text("receiver_user_id").notNull(),
  createdByUserId: text("created_by_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  amountCents: bigint("amount_cents", { mode: "bigint" }).notNull(),
  currency: text("currency").notNull().default("ARS"),
  paymentDate: date("payment_date", { mode: "string" }).notNull(),
  // Nullable legacy field: retained to preserve historical notes; new reembolsos do not write it.
  note: text("note"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  voidedAt: timestamp("voided_at"),
  voidedByUserId: text("voided_by_user_id").references(() => user.id, { onDelete: "restrict" }),
}, (t) => [
  foreignKey({ columns: [t.sharedSpaceId, t.payerUserId], foreignColumns: [sharedSpaceMembers.sharedSpaceId, sharedSpaceMembers.userId] }).onDelete("restrict"),
  foreignKey({ columns: [t.sharedSpaceId, t.receiverUserId], foreignColumns: [sharedSpaceMembers.sharedSpaceId, sharedSpaceMembers.userId] }).onDelete("restrict"),
  check("household_payments_amount_check", sql`${t.amountCents} > 0`),
  check("household_payments_currency_check", sql`${t.currency} = 'ARS'`),
  check("household_payments_participants_check", sql`${t.payerUserId} <> ${t.receiverUserId}`),
  check("household_payments_note_check", sql`${t.note} IS NULL OR char_length(${t.note}) <= 200`),
  check("household_payments_void_check", sql`(${t.voidedAt} IS NULL) = (${t.voidedByUserId} IS NULL)`),
  uniqueIndex("household_payments_idempotency_idx").on(t.sharedSpaceId, t.createdByUserId, t.idempotencyKey),
  index("household_payments_space_date_idx").on(t.sharedSpaceId, t.paymentDate),
]);
