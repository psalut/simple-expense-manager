export const MAX_EXPENSE_AMOUNT_CENTS = 9_223_372_036_854_775_807n;

export type ExpenseDraft = {
  amountCents: bigint;
  description: string;
  categoryId: string;
  expenseDate: string;
  sharedSpaceId: string | null;
};

export type ExpenseDraftResult =
  | { success: true; data: ExpenseDraft }
  | { success: false; error: string };

export type GroupBalance = {
  userId: string;
  name: string;
  paidCents: bigint;
  assignedCents: bigint;
  balanceCents: bigint;
};

export type ExpenseForAccess = {
  userId: string;
  sharedSpaceId: string | null;
};

export type ExpenseReadContext =
  | { scope: "personal" }
  | { scope: "group"; sharedSpaceId: string; isMember: boolean };

export function amountInputToCents(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fractional = ""] = normalized.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fractional.padEnd(2, "0"));
  if (cents <= 0n || cents > MAX_EXPENSE_AMOUNT_CENTS) return null;
  return cents;
}

export function validateExpenseDraft(value: unknown): ExpenseDraftResult {
  if (!isRecord(value)) {
    return { success: false, error: "Revisá los datos del gasto." };
  }
  if ("participantIds" in value || "participants" in value) {
    return {
      success: false,
      error: "Los gastos compartidos se reparten por mitades entre el grupo.",
    };
  }

  const amountCents = amountInputToCents(value.amount);
  if (amountCents === null) {
    return {
      success: false,
      error: "Ingresá un importe mayor a cero, con hasta dos decimales.",
    };
  }

  const description =
    typeof value.description === "string" ? value.description.trim() : "";
  if (!description) {
    return { success: false, error: "El detalle del gasto es obligatorio." };
  }
  if (description.length > 200) {
    return { success: false, error: "El detalle no puede superar 200 caracteres." };
  }

  const categoryId =
    typeof value.categoryId === "string" ? value.categoryId.trim() : "";
  if (!categoryId || categoryId.length > 100) {
    return { success: false, error: "Elegí una categoría válida." };
  }

  const expenseDate =
    typeof value.expenseDate === "string" ? value.expenseDate.trim() : "";
  if (!isValidIsoDate(expenseDate)) {
    return { success: false, error: "Elegí una fecha válida." };
  }

  let sharedSpaceId: string | null;
  if (value.sharedSpaceId === null || value.sharedSpaceId === undefined) {
    sharedSpaceId = null;
  } else if (typeof value.sharedSpaceId === "string") {
    sharedSpaceId = value.sharedSpaceId.trim();
    if (!sharedSpaceId || sharedSpaceId.length > 100) {
      return { success: false, error: "Elegí un grupo válido." };
    }
  } else {
    return { success: false, error: "Elegí un grupo válido." };
  }

  return {
    success: true,
    data: { amountCents, description, categoryId, expenseDate, sharedSpaceId },
  };
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function splitAmountCents(amountCents: bigint): {
  payerShareCents: bigint;
  otherShareCents: bigint;
} {
  if (amountCents <= 0n) {
    throw new Error("El importe compartido debe ser positivo.");
  }

  const otherShareCents = amountCents / 2n;
  return {
    payerShareCents: amountCents - otherShareCents,
    otherShareCents,
  };
}

export function calculateGroupBalances(
  members: readonly { userId: string; name: string }[],
  groupExpenses: readonly {
    payerUserId: string;
    amountCents: bigint;
  }[],
): GroupBalance[] {
  if (members.length !== 2 || members[0].userId === members[1].userId) {
    throw new Error("Un balance compartido requiere exactamente dos integrantes.");
  }

  const balances = new Map<string, GroupBalance>(
    members.map((member) => [
      member.userId,
      {
        userId: member.userId,
        name: member.name,
        paidCents: 0n,
        assignedCents: 0n,
        balanceCents: 0n,
      },
    ]),
  );

  for (const expense of groupExpenses) {
    const payer = balances.get(expense.payerUserId);
    if (!payer || expense.amountCents <= 0n) {
      throw new Error("El gasto compartido no coincide con los integrantes.");
    }
    const other = members.find((member) => member.userId !== expense.payerUserId);
    if (!other) throw new Error("No se encontró el otro integrante del grupo.");
    const split = splitAmountCents(expense.amountCents);

    payer.paidCents += expense.amountCents;
    payer.assignedCents += split.payerShareCents;
    balances.get(other.userId)!.assignedCents += split.otherShareCents;
  }

  return [...balances.values()]
    .map((balance) => ({
      ...balance,
      balanceCents: balance.paidCents - balance.assignedCents,
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) ||
        left.userId.localeCompare(right.userId),
    );
}

export function canReadExpense(
  viewerId: string,
  expense: ExpenseForAccess,
  context: ExpenseReadContext,
): boolean {
  if (context.scope === "personal") return expense.userId === viewerId;
  return context.isMember && expense.sharedSpaceId === context.sharedSpaceId;
}

export function canEditExpense(
  viewerId: string,
  expense: ExpenseForAccess,
): boolean {
  return expense.userId === viewerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
