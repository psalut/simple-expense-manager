"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  archiveCategory,
  CategoryError,
  createCategory,
  deleteArchivedCategory,
  listCategoriesForSharedSpace,
  listPersonalCategories,
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
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const draft = asRecord(input);
    const category = await createCategory(userId, {
      name: draft.name,
      description: draft.description,
      scope: sharedSpaceId === null ? "personal" : "shared",
      sharedSpaceId,
    });
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function updateCategoryAction(
  categoryId: unknown,
  input: unknown,
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const category = await updateCategory(
      userId,
      categoryId,
      input,
      sharedSpaceId,
    );
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function archiveCategoryAction(
  categoryId: unknown,
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const category = await archiveCategory(
      userId,
      categoryId,
      sharedSpaceId,
    );
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function deleteArchivedCategoryAction(
  categoryId: unknown,
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const category = await deleteArchivedCategory(
      userId,
      categoryId,
      sharedSpaceId,
    );
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function restoreArchivedCategoryAction(
  categoryId: unknown,
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const category = await restoreArchivedCategory(
      userId,
      categoryId,
      sharedSpaceId,
    );
    revalidateCategoryViews();
    return { id: category.id };
  });
}

export async function getArchivedCategoriesAction(
  rawExpectedSharedSpaceId: unknown,
): Promise<ActionResult<CategoryView[]>> {
  return runAction(async (userId) => {
    const sharedSpaceId = readExpectedSharedSpaceId(rawExpectedSharedSpaceId);
    const categories =
      sharedSpaceId === null
        ? await listPersonalCategories(userId, true)
        : await listCategoriesForSharedSpace(userId, sharedSpaceId, true);
    return categories.filter((category) => category.isArchived);
  });
}

function readExpectedSharedSpaceId(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string" && value.trim() && value.length <= 100) {
    return value.trim();
  }
  throw new CategoryError("Elegí un catálogo válido.");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function revalidateCategoryViews() {
  revalidatePath("/categories");
  revalidatePath("/groups/[id]/categories", "page");
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
