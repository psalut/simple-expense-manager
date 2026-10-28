import { amountInputToCents, isValidIsoDate } from "@/lib/expenses/policy";

export type IncomeDraft = {
  amountCents: bigint;
  description: string;
  incomeDate: string;
};

export type IncomeDraftResult =
  | { success: true; data: IncomeDraft }
  | { success: false; error: string };

export function validateIncomeDraft(value: unknown): IncomeDraftResult {
  if (!isRecord(value)) {
    return { success: false, error: "Revisá los datos del ingreso." };
  }

  if (value.sharedSpaceId !== undefined && value.sharedSpaceId !== null) {
    return {
      success: false,
      error: "Los ingresos son personales y no se pueden compartir.",
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
    return { success: false, error: "El detalle del ingreso es obligatorio." };
  }
  if (description.length > 200) {
    return { success: false, error: "El detalle no puede superar 200 caracteres." };
  }

  const incomeDate =
    typeof value.incomeDate === "string"
      ? value.incomeDate.trim()
      : typeof value.expenseDate === "string"
        ? value.expenseDate.trim()
        : "";
  if (!isValidIsoDate(incomeDate)) {
    return { success: false, error: "Elegí una fecha válida." };
  }

  return {
    success: true,
    data: { amountCents, description, incomeDate },
  };
}

export function canAccessIncome(
  viewerId: string,
  income: { userId: string },
): boolean {
  return income.userId === viewerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
