"use server";

import type { ActionResult } from "@/lib/action-result";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";
import {
  createIncome,
  deleteIncome,
  IncomeError,
  updateIncome,
} from "@/lib/server/incomes";

export async function createIncomeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runIncomeAction((userId) => createIncome(userId, input));
}

export async function updateIncomeAction(
  incomeId: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runIncomeAction((userId) => updateIncome(userId, incomeId, input));
}

export async function deleteIncomeAction(
  incomeId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runIncomeAction((userId) => deleteIncome(userId, incomeId));
}

async function runIncomeAction<T>(
  operation: (userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const userId = await getAuthenticatedUserId();
    return { success: true, data: await operation(userId) };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof IncomeError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "No se pudo completar la operación. Intentá nuevamente.",
    };
  }
}
