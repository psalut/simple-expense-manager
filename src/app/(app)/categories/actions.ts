"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import {
  archiveCategory,
  CategoryError,
  createCategory,
  deleteArchivedCategory,
  listCategories,
  updateCategory,
} from "@/lib/server/categories";
import {
  acceptSharedSpaceInvitation,
  createSharedSpace,
  createSharedSpaceInvitation,
  SharedSpaceError,
} from "@/lib/server/shared-spaces";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const category = await createCategory(userId, input);
    revalidatePath("/categories");
    return { id: category.id };
  });
}

export async function updateCategoryAction(
  categoryId: unknown,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const category = await updateCategory(userId, categoryId, input);
    revalidatePath("/categories");
    return { id: category.id };
  });
}

export async function archiveCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const category = await archiveCategory(userId, categoryId);
    revalidatePath("/categories");
    return { id: category.id };
  });
}

export async function deleteArchivedCategoryAction(
  categoryId: unknown,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async (userId) => {
    const category = await deleteArchivedCategory(userId, categoryId);
    revalidatePath("/categories");
    return { id: category.id };
  });
}

export async function getArchivedCategoriesAction(): Promise<
  ActionResult<Awaited<ReturnType<typeof listCategories>>>
> {
  return runAction(async (userId) =>
    (await listCategories(userId, true)).filter((category) => category.isArchived),
  );
}

export async function createSharedSpaceAction(
  name: unknown,
): Promise<ActionResult<null>> {
  return runAction(async (userId) => {
    await createSharedSpace(userId, name);
    revalidatePath("/categories");
    return null;
  });
}

export async function createSharedSpaceInvitationAction(
  sharedSpaceId: unknown,
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  return runAction(async (userId) => {
    const invitation = await createSharedSpaceInvitation(userId, sharedSpaceId);
    revalidatePath("/categories");
    return invitation;
  });
}

export async function acceptSharedSpaceInvitationAction(
  code: unknown,
): Promise<ActionResult<null>> {
  return runAction(async (userId) => {
    await acceptSharedSpaceInvitation(userId, code);
    revalidatePath("/categories");
    return null;
  });
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
      error instanceof CategoryError ||
      error instanceof SharedSpaceError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "No se pudo completar la operación. Intentá nuevamente.",
    };
  }
}
