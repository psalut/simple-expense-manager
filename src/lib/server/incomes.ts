import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { incomes } from "@/db/incomes-schema";
import { canAccessIncome, validateIncomeDraft } from "@/lib/incomes/policy";

export class IncomeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IncomeError";
  }
}

export type PersonalIncomeView = {
  kind: "income";
  id: string;
  amountCents: string;
  currency: "ARS";
  description: string;
  incomeDate: string;
};

export async function getPersonalIncomeMonth(
  userId: string,
  monthStart: string,
  nextMonthStart: string,
): Promise<PersonalIncomeView[]> {
  const rows = await db
    .select({
      id: incomes.id,
      amountCents: incomes.amountCents,
      description: incomes.description,
      incomeDate: incomes.incomeDate,
    })
    .from(incomes)
    .where(
      and(
        eq(incomes.userId, userId),
        gte(incomes.incomeDate, monthStart),
        lt(incomes.incomeDate, nextMonthStart),
      ),
    )
    .orderBy(desc(incomes.incomeDate), desc(incomes.createdAt), desc(incomes.id));

  return rows.map((row) => ({
    ...row,
    kind: "income",
    amountCents: row.amountCents.toString(),
    currency: "ARS",
  }));
}

export async function createIncome(userId: string, rawInput: unknown) {
  const validation = validateIncomeDraft(rawInput);
  if (!validation.success) throw new IncomeError(validation.error);

  const id = randomUUID();
  await db.insert(incomes).values({
    id,
    userId,
    amountCents: validation.data.amountCents,
    currency: "ARS",
    description: validation.data.description,
    incomeDate: validation.data.incomeDate,
  });
  return { id };
}

export async function updateIncome(
  userId: string,
  rawIncomeId: unknown,
  rawInput: unknown,
) {
  const incomeId = readIncomeId(rawIncomeId);
  const validation = validateIncomeDraft(rawInput);
  if (!validation.success) throw new IncomeError(validation.error);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(incomes)
      .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)))
      .for("update")
      .limit(1);
    if (!current || !canAccessIncome(userId, current)) {
      throw new IncomeError("No se encontró el ingreso o no tenés permiso.");
    }

    await tx
      .update(incomes)
      .set({
        amountCents: validation.data.amountCents,
        description: validation.data.description,
        incomeDate: validation.data.incomeDate,
      })
      .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)));

    return { id: incomeId };
  });
}

export async function deleteIncome(userId: string, rawIncomeId: unknown) {
  const incomeId = readIncomeId(rawIncomeId);

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ id: incomes.id, userId: incomes.userId })
      .from(incomes)
      .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)))
      .for("update")
      .limit(1);
    if (!current || !canAccessIncome(userId, current)) {
      throw new IncomeError("No se encontró el ingreso o no tenés permiso.");
    }

    await tx
      .delete(incomes)
      .where(and(eq(incomes.id, incomeId), eq(incomes.userId, userId)));
    return { id: incomeId };
  });
}

function readIncomeId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 100) {
    throw new IncomeError("No se encontró el ingreso o no tenés permiso.");
  }
  return id;
}
