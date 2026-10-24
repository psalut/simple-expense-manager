import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { sharedSpaces } from "@/db/shared-space-schema";
import {
  canDeleteArchivedCategory,
  canManageCategory,
  isCategoryEligible,
  validateCategoryDraft,
  type CategoryEligibilityContext,
} from "@/lib/categories/policy";
import type { CategoryView } from "@/lib/categories/types";
import {
  getSharedSpaceIdsForUser,
  getSharedSpacesForUser,
  isUserMemberOfSharedSpace,
} from "@/lib/server/shared-spaces";

export type { CategoryView } from "@/lib/categories/types";

export async function listCategories(
  userId: string,
  includeArchived = false,
): Promise<CategoryView[]> {
  const spaces = await getSharedSpacesForUser(userId);
  const sharedSpaceIds = spaces.map((space) => space.id);
  const activeFilter = includeArchived ? undefined : eq(categories.isArchived, false);
  const personal = await db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        ...(activeFilter ? [activeFilter] : []),
      ),
    )
    .orderBy(asc(categories.name));

  const shared = sharedSpaceIds.length
    ? await db
        .select({
          id: categories.id,
          name: categories.name,
          description: categories.description,
          userId: categories.userId,
          sharedSpaceId: categories.sharedSpaceId,
          isArchived: categories.isArchived,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          sharedSpaceName: sharedSpaces.name,
        })
        .from(categories)
        .innerJoin(sharedSpaces, eq(categories.sharedSpaceId, sharedSpaces.id))
        .where(
          and(
            inArray(categories.sharedSpaceId, sharedSpaceIds),
            ...(activeFilter ? [activeFilter] : []),
          ),
        )
        .orderBy(asc(sharedSpaces.name), asc(categories.name))
    : [];

  return [
    ...personal.map((category) => toCategoryView(category, null)),
    ...shared.map((category) => toCategoryView(category, category.sharedSpaceName)),
  ];
}

export async function listEligibleCategories(
  userId: string,
  context: CategoryEligibilityContext,
): Promise<CategoryView[]> {
  const spaces = await getSharedSpacesForUser(userId);
  const memberSpaceIds = spaces.map((space) => space.id);
  if (context.shared && !memberSpaceIds.includes(context.sharedSpaceId)) {
    throw new CategoryError("No tenés acceso a ese grupo.");
  }

  const personal = context.shared
    ? []
    : await db
        .select()
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.isArchived, false),
          ),
        )
        .orderBy(asc(categories.name));

  const eligibleSpaceIds = context.shared
    ? [context.sharedSpaceId]
    : memberSpaceIds;
  const shared = eligibleSpaceIds.length
    ? await db
        .select({
          id: categories.id,
          name: categories.name,
          description: categories.description,
          userId: categories.userId,
          sharedSpaceId: categories.sharedSpaceId,
          isArchived: categories.isArchived,
          createdAt: categories.createdAt,
          updatedAt: categories.updatedAt,
          sharedSpaceName: sharedSpaces.name,
        })
        .from(categories)
        .innerJoin(sharedSpaces, eq(categories.sharedSpaceId, sharedSpaces.id))
        .where(
          and(
            inArray(categories.sharedSpaceId, eligibleSpaceIds),
            eq(categories.isArchived, false),
          ),
        )
        .orderBy(asc(sharedSpaces.name), asc(categories.name))
    : [];

  return [
    ...personal.map((category) => ({ category, sharedSpaceName: null })),
    ...shared.map((category) => ({
      category,
      sharedSpaceName: category.sharedSpaceName,
    })),
  ]
    .filter(({ category }) =>
      isCategoryEligible(category, userId, memberSpaceIds, context),
    )
    .map(({ category, sharedSpaceName }) =>
      toCategoryView(category, sharedSpaceName),
    );
}

export async function createCategory(userId: string, input: unknown) {
  const draft = validateCategoryDraft(input);
  if (!draft.success) throw new CategoryError(draft.error);

  const sharedSpaceId = draft.data.sharedSpaceId;
  if (
    draft.data.scope === "shared" &&
    (!sharedSpaceId || !(await isUserMemberOfSharedSpace(userId, sharedSpaceId)))
  ) {
    throw new CategoryError("No tenés acceso a ese grupo.");
  }

  try {
    const [category] = await db
      .insert(categories)
      .values({
        id: randomUUID(),
        name: draft.data.name,
        description: draft.data.description,
        userId: draft.data.scope === "personal" ? userId : null,
        sharedSpaceId,
      })
      .returning();
    return toCategoryView(category, null);
  } catch (error) {
    if (isCategoryNameConflict(error)) {
      throw new CategoryError("Ya existe una categoría activa con ese nombre.");
    }
    throw error;
  }
}

export async function updateCategory(
  userId: string,
  categoryId: unknown,
  input: unknown,
) {
  if (typeof categoryId !== "string" || categoryId.length > 100) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }
  const draft = validateCategoryDraft({
    ...asRecord(input),
    scope: "personal",
    sharedSpaceId: null,
  });
  if (!draft.success) throw new CategoryError(draft.error);

  const existing = await findManageableCategory(userId, categoryId);
  if (!existing) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }

  try {
    const [category] = await db
      .update(categories)
      .set({
        name: draft.data.name,
        description: draft.data.description,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, existing.id))
      .returning();
    return toCategoryView(category, null);
  } catch (error) {
    if (isCategoryNameConflict(error)) {
      throw new CategoryError("Ya existe una categoría activa con ese nombre.");
    }
    throw error;
  }
}

export async function archiveCategory(userId: string, categoryId: unknown) {
  if (typeof categoryId !== "string" || categoryId.length > 100) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }
  const existing = await findManageableCategory(userId, categoryId);
  if (!existing) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }

  const [category] = await db
    .update(categories)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(categories.id, existing.id))
    .returning();

  return toCategoryView(category, null);
}

export async function deleteArchivedCategory(
  userId: string,
  rawCategoryId: unknown,
): Promise<{ id: string }> {
  const categoryId =
    typeof rawCategoryId === "string" ? rawCategoryId.trim() : "";
  if (!categoryId || categoryId.length > 100) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }

  const memberSpaceIds = await getSharedSpaceIdsForUser(userId);
  const ownership = memberSpaceIds.length
    ? or(
        eq(categories.userId, userId),
        inArray(categories.sharedSpaceId, memberSpaceIds),
      )
    : eq(categories.userId, userId);
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), ownership))
    .limit(1);

  if (!category || !canManageCategory(category, userId, memberSpaceIds)) {
    throw new CategoryError("No se encontró la categoría o no tenés permiso.");
  }
  if (!canDeleteArchivedCategory(category, userId, memberSpaceIds)) {
    throw new CategoryError("Primero archivá la categoría para poder eliminarla.");
  }

  // Expenses are not implemented yet. When they exist, check/reassign references
  // in a transaction before this conditional delete; never cascade-delete them.
  const [deleted] = await db
    .delete(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.isArchived, true),
        ownership,
      ),
    )
    .returning({ id: categories.id });

  if (!deleted) {
    throw new CategoryError(
      "La categoría cambió mientras se procesaba. Actualizá la página e intentá de nuevo.",
    );
  }

  return deleted;
}

async function findManageableCategory(userId: string, categoryId: string) {
  const memberSpaceIds = await getSharedSpaceIdsForUser(userId);
  const ownership = memberSpaceIds.length
    ? or(
        eq(categories.userId, userId),
        inArray(categories.sharedSpaceId, memberSpaceIds),
      )
    : eq(categories.userId, userId);
  const [category] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, categoryId), ownership))
    .limit(1);

  if (!category || !canManageCategory(category, userId, memberSpaceIds)) {
    return null;
  }
  return category;
}

export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}

function toCategoryView(
  category: {
    id: string;
    name: string;
    description: string;
    userId: string | null;
    sharedSpaceId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  sharedSpaceName: string | null,
): CategoryView {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    scope: category.sharedSpaceId === null ? "personal" : "shared",
    sharedSpaceId: category.sharedSpaceId,
    sharedSpaceName,
    isArchived: category.isArchived,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function isCategoryNameConflict(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const record = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (
      record.code === "23505" &&
      (record.constraint === "categories_user_active_name_unique" ||
        record.constraint === "categories_shared_active_name_unique")
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}
