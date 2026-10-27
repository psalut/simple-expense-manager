"use server";

import type { ActionResult } from "@/lib/action-result";
import {
  archiveCategory,
  CategoryError,
  createCategory,
  deleteArchivedCategory,
  restoreArchivedCategory,
  updateCategory,
} from "@/lib/server/categories";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await createCategory(input);
    return { id: category.id };
  });
}

export async function updateCategoryAction(
  categoryId: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await updateCategory(categoryId, input);
    return { id: category.id };
  });
}

export async function archiveCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await archiveCategory(categoryId);
    return category;
  });
}

export async function deleteArchivedCategoryAction(
  categoryId: unknown,
  replacementCategoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await deleteArchivedCategory(
      categoryId,
      replacementCategoryId,
    );
    return category;
  });
}

export async function restoreArchivedCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await restoreArchivedCategory(categoryId);
    return category;
  });
}

async function runAction<T>(
  operation: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    await getAuthenticatedUserId();
    return { success: true, data: await operation() };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof CategoryError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "No se pudo completar la operación. Intentá nuevamente.",
    };
  }
}
