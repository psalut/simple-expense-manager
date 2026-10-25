"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  archiveCategory,
  CategoryError,
  createCategory,
  deleteArchivedCategory,
  listCategories,
  restoreArchivedCategory,
  updateCategory,
} from "@/lib/server/categories";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";
import type { CategoryView } from "@/lib/categories/types";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await createCategory(input);
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function updateCategoryAction(
  categoryId: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await updateCategory(categoryId, input);
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function archiveCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await archiveCategory(categoryId);
    revalidateCategoryViews();
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
    revalidateCategoryViews();
    return category;
  });
}

export async function restoreArchivedCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const category = await restoreArchivedCategory(categoryId);
    revalidateCategoryViews();
    return category;
  });
}

export async function getArchivedCategoriesAction(): Promise<
  ActionResult<CategoryView[]>
> {
  return runAction(async () =>
    (await listCategories(true)).filter((category) => category.isArchived),
  );
}

function revalidateCategoryViews() {
  revalidatePath("/categories");
  revalidatePath("/");
  revalidatePath("/groups/[id]", "page");
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
