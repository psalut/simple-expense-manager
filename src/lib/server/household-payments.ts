import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { expenses } from "@/db/expenses-schema";
import { householdPayments } from "@/db/household-payments-schema";
import { sharedSpaceMembers } from "@/db/shared-space-schema";
import { resolveHousehold } from "@/lib/server/household";
import { calculateGroupBalances } from "@/lib/expenses/policy";
import { currentDateInBuenosAires } from "@/lib/expenses/format";
import { validatePayment } from "@/lib/household-payments/policy";

export class PaymentError extends Error {}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockedHousehold(tx: Tx, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(732619041)`);
  const household = await resolveHousehold(tx);
  if (!household.id) throw new PaymentError("Casa no está disponible.");
  const members = await tx.select({ userId: sharedSpaceMembers.userId }).from(sharedSpaceMembers)
    .where(eq(sharedSpaceMembers.sharedSpaceId, household.id));
  if (members.length !== 2 || !members.some((m) => m.userId === userId)) throw new PaymentError("Necesitás pertenecer a Casa con dos integrantes.");
  return { id: household.id, members: members.map((m) => ({ ...m, name: "" })) };
}

export async function createHouseholdPayment(userId: string, input: unknown) {
  const draft = validatePayment(input, currentDateInBuenosAires());
  if (!draft) throw new PaymentError("Revisá el importe, la fecha y la nota del pago.");
  return db.transaction(async (tx) => {
    const space = await lockedHousehold(tx, userId);
    const [existing] = await tx.select().from(householdPayments).where(and(
      eq(householdPayments.sharedSpaceId, space.id), eq(householdPayments.createdByUserId, userId), eq(householdPayments.idempotencyKey, draft.key),
    )).limit(1);
    if (existing) {
      if (existing.amountCents !== draft.amountCents || existing.paymentDate !== draft.date || existing.note !== draft.note || existing.payerUserId !== draft.expectedPayer) throw new PaymentError("Este intento ya fue usado con otros datos.");
      return { id: existing.id };
    }
    const expenseRows = await tx.select({ payerUserId: expenses.userId, amountCents: expenses.amountCents }).from(expenses).where(eq(expenses.sharedSpaceId, space.id));
    const paymentRows = await tx.select().from(householdPayments).where(eq(householdPayments.sharedSpaceId, space.id));
    const balances = calculateGroupBalances(space.members, expenseRows, paymentRows);
    const payer = balances.find((b) => b.balanceCents < 0n);
    const receiver = balances.find((b) => b.balanceCents > 0n);
    if (!payer || !receiver || payer.userId !== draft.expectedPayer || draft.amountCents > -payer.balanceCents) throw new PaymentError("La deuda cambió. Revisá el saldo actualizado e intentá de nuevo.");
    const id = randomUUID();
    await tx.insert(householdPayments).values({ id, sharedSpaceId: space.id, payerUserId: payer.userId, receiverUserId: receiver.userId, createdByUserId: userId, amountCents: draft.amountCents, paymentDate: draft.date, note: draft.note, idempotencyKey: draft.key });
    return { id };
  });
}

export async function voidHouseholdPayment(userId: string, rawId: unknown) {
  if (typeof rawId !== "string" || !rawId || rawId.length > 100) throw new PaymentError("No se encontró el pago.");
  return db.transaction(async (tx) => {
    const space = await lockedHousehold(tx, userId);
    const [payment] = await tx.select().from(householdPayments).where(and(eq(householdPayments.id, rawId), eq(householdPayments.sharedSpaceId, space.id))).limit(1);
    if (!payment) throw new PaymentError("No se encontró el pago.");
    if (!payment.voidedAt) await tx.update(householdPayments).set({ voidedAt: new Date(), voidedByUserId: userId }).where(eq(householdPayments.id, payment.id));
    return { id: payment.id };
  });
}
