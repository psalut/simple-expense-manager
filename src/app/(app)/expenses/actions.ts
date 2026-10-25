"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";
import {
  createExpense,
  deleteExpense,
  ExpenseError,
  updateExpense,
} from "@/lib/server/expenses";

export async function createExpenseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; sharedSpaceId: string | null }>> {
  return runAction(async (userId) => {
    const result = await createExpense(userId, input);
    revalidateExpenseViews(result.sharedSpaceId);
    return result;
  });
}

export async function updateExpenseAction(
  expenseId: unknown,
  input: unknown,
): Promise<
  ActionResult<{
    id: string;
    oldSharedSpaceId: string | null;
    sharedSpaceId: string | null;
  }>
> {
  return runAction(async (userId) => {
    const result = await updateExpense(userId, expenseId, input);
    revalidateExpenseViews(result.oldSharedSpaceId);
    revalidateExpenseViews(result.sharedSpaceId);
    return result;
  });
}

export async function deleteExpenseAction(
  expenseId: unknown,
): Promise<ActionResult<{ id: string; sharedSpaceId: string | null }>> {
  return runAction(async (userId) => {
    const result = await deleteExpense(userId, expenseId);
    revalidateExpenseViews(result.sharedSpaceId);
    return result;
  });
}

function revalidateExpenseViews(sharedSpaceId: string | null) {
  revalidatePath("/");
  if (sharedSpaceId) revalidatePath("/groups/" + sharedSpaceId);
}

async function runAction<T>(
  operation: (userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const userId = await getAuthenticatedUserId();
    return { success: true, data: await operation(userId) };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof ExpenseError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "No se pudo completar la operación. Intentá nuevamente.",
    };
  }
}
