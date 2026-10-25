import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { expenses } from "@/db/expenses-schema";
import { sharedSpaceMembers, sharedSpaces } from "@/db/shared-space-schema";
import { user } from "@/db/auth-schema";
import {
  calculateGroupBalances,
  canEditExpense,
  validateExpenseDraft,
} from "@/lib/expenses/policy";
import {
  groupExpenseScope,
  ownedExpenseScope,
  personalExpenseScope,
} from "@/lib/expenses/query-scope";

export class ExpenseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpenseError";
  }
}

export type PersonalExpenseView = {
  id: string;
  amountCents: string;
  currency: "ARS";
  description: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIsArchived: boolean;
  expenseDate: string;
  sharedSpaceId: string | null;
  sharedSpaceName: string | null;
};

export type GroupExpenseView = PersonalExpenseView & {
  payerUserId: string;
  payerName: string;
};

export type GroupBalanceView = {
  userId: string;
  name: string;
  paidCents: string;
  assignedCents: string;
  balanceCents: string;
};

export async function listPersonalExpenses(
  userId: string,
  monthStart: string,
  nextMonthStart: string,
): Promise<PersonalExpenseView[]> {
  const rows = await db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      description: expenses.description,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIsArchived: categories.isArchived,
      expenseDate: expenses.expenseDate,
      sharedSpaceId: expenses.sharedSpaceId,
      sharedSpaceName: sharedSpaces.name,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .leftJoin(sharedSpaces, eq(expenses.sharedSpaceId, sharedSpaces.id))
    .where(personalExpenseScope(userId, monthStart, nextMonthStart))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt), desc(expenses.id));

  return rows.map((row) => ({
    ...row,
    amountCents: row.amountCents.toString(),
    currency: "ARS",
  }));
}

export async function getGroupExpenseOverview(
  userId: string,
  sharedSpaceId: string,
): Promise<{ expenses: GroupExpenseView[]; balances: GroupBalanceView[] }> {
  return db.transaction(
    async (tx) => {
      const [membership] = await tx
        .select({ userId: sharedSpaceMembers.userId })
        .from(sharedSpaceMembers)
        .where(
          and(
            eq(sharedSpaceMembers.userId, userId),
            eq(sharedSpaceMembers.sharedSpaceId, sharedSpaceId),
          ),
        )
        .limit(1);
      if (!membership) throw new ExpenseError("No tenés acceso a ese grupo.");

      const members = await tx
        .select({ userId: user.id, name: user.name })
        .from(sharedSpaceMembers)
        .innerJoin(user, eq(sharedSpaceMembers.userId, user.id))
        .where(eq(sharedSpaceMembers.sharedSpaceId, sharedSpaceId))
        .orderBy(asc(user.name), asc(user.id));

      const rows = await tx
        .select({
          id: expenses.id,
          amountCents: expenses.amountCents,
          description: expenses.description,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColor: categories.color,
          categoryIsArchived: categories.isArchived,
          expenseDate: expenses.expenseDate,
          sharedSpaceId: expenses.sharedSpaceId,
          sharedSpaceName: sharedSpaces.name,
          payerUserId: user.id,
          payerName: user.name,
        })
        .from(expenses)
        .innerJoin(user, eq(expenses.userId, user.id))
        .innerJoin(categories, eq(expenses.categoryId, categories.id))
        .innerJoin(sharedSpaces, eq(expenses.sharedSpaceId, sharedSpaces.id))
        .where(groupExpenseScope(sharedSpaceId))
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt), desc(expenses.id));

      const balances =
        members.length === 2
          ? calculateGroupBalances(
              members,
              rows.map((row) => ({
                payerUserId: row.payerUserId,
                amountCents: row.amountCents,
              })),
            ).map((balance) => ({
              userId: balance.userId,
              name: balance.name,
              paidCents: balance.paidCents.toString(),
              assignedCents: balance.assignedCents.toString(),
              balanceCents: balance.balanceCents.toString(),
            }))
          : [];

      return {
        expenses: rows.map((row) => ({
          ...row,
          amountCents: row.amountCents.toString(),
          currency: "ARS",
        })),
        balances,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function createExpense(userId: string, rawInput: unknown) {
  const validation = validateExpenseDraft(rawInput);
  if (!validation.success) throw new ExpenseError(validation.error);
  const draft = validation.data;

  return db.transaction(async (tx) => {
    if (draft.sharedSpaceId) {
      await lockSharedSpaceMembers(tx, userId, draft.sharedSpaceId);
    }

    const category = await lockCategory(tx, draft.categoryId);
    if (category.isArchived) {
      throw new ExpenseError("Esa categoría está archivada. Elegí una categoría activa.");
    }

    const id = randomUUID();
    await tx.insert(expenses).values({
      id,
      userId,
      amountCents: draft.amountCents,
      currency: "ARS",
      description: draft.description,
      categoryId: category.id,
      expenseDate: draft.expenseDate,
      sharedSpaceId: draft.sharedSpaceId,
    });

    return { id, sharedSpaceId: draft.sharedSpaceId };
  });
}

export async function updateExpense(
  userId: string,
  rawExpenseId: unknown,
  rawInput: unknown,
) {
  const expenseId = readExpenseId(rawExpenseId);
  const validation = validateExpenseDraft(rawInput);
  if (!validation.success) throw new ExpenseError(validation.error);
  const draft = validation.data;

  return db.transaction(async (tx) => {
    const [snapshot] = await tx
      .select()
      .from(expenses)
      .where(ownedExpenseScope(expenseId, userId))
      .limit(1);
    if (!snapshot || !canEditExpense(userId, snapshot)) {
      throw new ExpenseError("No se encontró el gasto o no tenés permiso.");
    }

    if (draft.sharedSpaceId) {
      await lockSharedSpaceMembers(tx, userId, draft.sharedSpaceId);
    }

    const categoryIds = [...new Set([snapshot.categoryId, draft.categoryId])].sort();
    const lockedCategories = await tx
      .select()
      .from(categories)
      .where(inArray(categories.id, categoryIds))
      .orderBy(asc(categories.id))
      .for("share");
    const targetCategory = lockedCategories.find(
      (category) => category.id === draft.categoryId,
    );

    const [current] = await tx
      .select()
      .from(expenses)
      .where(ownedExpenseScope(expenseId, userId))
      .for("update")
      .limit(1);

    if (
      !current ||
      current.categoryId !== snapshot.categoryId ||
      current.sharedSpaceId !== snapshot.sharedSpaceId
    ) {
      throw new ExpenseError(
        "El gasto cambió mientras lo editabas. Actualizá la página e intentá de nuevo.",
      );
    }
    if (!targetCategory) throw new ExpenseError("Elegí una categoría válida.");

    const keepArchivedCategory =
      targetCategory.id === current.categoryId && targetCategory.isArchived;
    if (targetCategory.isArchived && !keepArchivedCategory) {
      throw new ExpenseError("Esa categoría está archivada. Elegí una categoría activa.");
    }

    const [updated] = await tx
      .update(expenses)
      .set({
        amountCents: draft.amountCents,
        description: draft.description,
        categoryId: targetCategory.id,
        expenseDate: draft.expenseDate,
        sharedSpaceId: draft.sharedSpaceId,
        updatedAt: new Date(),
      })
      .where(ownedExpenseScope(expenseId, userId))
      .returning({ id: expenses.id });

    if (!updated) throw new ExpenseError("No se pudo guardar el gasto.");
    return {
      id: expenseId,
      oldSharedSpaceId: current.sharedSpaceId,
      sharedSpaceId: draft.sharedSpaceId,
    };
  });
}

export async function deleteExpense(userId: string, rawExpenseId: unknown) {
  const expenseId = readExpenseId(rawExpenseId);

  return db.transaction(async (tx) => {
    const [snapshot] = await tx
      .select()
      .from(expenses)
      .where(ownedExpenseScope(expenseId, userId))
      .limit(1);
    if (!snapshot || !canEditExpense(userId, snapshot)) {
      throw new ExpenseError("No se encontró el gasto o no tenés permiso.");
    }

    await lockCategory(tx, snapshot.categoryId);
    const [current] = await tx
      .select()
      .from(expenses)
      .where(ownedExpenseScope(expenseId, userId))
      .for("update")
      .limit(1);
    if (!current || current.categoryId !== snapshot.categoryId) {
      throw new ExpenseError(
        "El gasto cambió mientras lo procesabas. Actualizá la página e intentá de nuevo.",
      );
    }

    await tx.delete(expenses).where(ownedExpenseScope(expenseId, userId));
    return { id: expenseId, sharedSpaceId: current.sharedSpaceId };
  });
}

async function lockSharedSpaceMembers(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  sharedSpaceId: string,
) {
  const [space] = await tx
    .select({ id: sharedSpaces.id, memberCount: sharedSpaces.memberCount })
    .from(sharedSpaces)
    .where(eq(sharedSpaces.id, sharedSpaceId))
    .for("update")
    .limit(1);
  if (!space) throw new ExpenseError("Elegí un grupo válido.");

  const members = await tx
    .select({ userId: sharedSpaceMembers.userId })
    .from(sharedSpaceMembers)
    .where(eq(sharedSpaceMembers.sharedSpaceId, sharedSpaceId))
    .orderBy(asc(sharedSpaceMembers.userId));

  if (
    space.memberCount !== 2 ||
    members.length !== 2 ||
    !members.some((member) => member.userId === userId)
  ) {
    throw new ExpenseError(
      "Para compartir un gasto, el grupo necesita exactamente dos integrantes.",
    );
  }
}

async function lockCategory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  categoryId: string,
) {
  const [category] = await tx
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .for("share")
    .limit(1);
  if (!category) throw new ExpenseError("Elegí una categoría válida.");
  return category;
}

function readExpenseId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 100) {
    throw new ExpenseError("No se encontró el gasto o no tenés permiso.");
  }
  return id;
}
