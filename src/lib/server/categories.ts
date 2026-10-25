import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { expenses } from "@/db/expenses-schema";
import {
  canDeleteArchivedCategory,
  validateCategoryDraft,
} from "@/lib/categories/policy";
import type { CategoryView } from "@/lib/categories/types";

export type { CategoryView } from "@/lib/categories/types";

export async function listCategories(
  includeArchived = false,
): Promise<CategoryView[]> {
  const rows = await db
    .select()
    .from(categories)
    .where(includeArchived ? undefined : eq(categories.isArchived, false))
    .orderBy(asc(categories.name), asc(categories.id));

  return rows.map(toCategoryView);
}

export async function listActiveCategoryOptions(): Promise<
  Pick<CategoryView, "id" | "name" | "description">[]
> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .where(eq(categories.isArchived, false))
    .orderBy(asc(categories.name), asc(categories.id));
}

export async function createCategory(input: unknown): Promise<CategoryView> {
  const draft = validateCategoryDraft(input);
  if (!draft.success) throw new CategoryError(draft.error);

  try {
    const [category] = await db
      .insert(categories)
      .values({ id: randomUUID(), ...draft.data })
      .returning();

    return toCategoryView(category);
  } catch (error) {
    if (isActiveNameConflict(error)) {
      throw new CategoryError("Ya existe una categoría activa con ese nombre.");
    }
    throw error;
  }
}

export async function updateCategory(
  categoryId: unknown,
  input: unknown,
): Promise<CategoryView> {
  const id = readCategoryId(categoryId);
  const draft = validateCategoryDraft(input);
  if (!draft.success) throw new CategoryError(draft.error);

  try {
    const [category] = await db
      .update(categories)
      .set({ ...draft.data, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();

    if (!category) throw new CategoryError("No se encontró la categoría.");
    return toCategoryView(category);
  } catch (error) {
    if (error instanceof CategoryError) throw error;
    if (isActiveNameConflict(error)) {
      throw new CategoryError("Ya existe una categoría activa con ese nombre.");
    }
    throw error;
  }
}

export async function archiveCategory(categoryId: unknown): Promise<{ id: string }> {
  const id = readCategoryId(categoryId);
  const [category] = await db
    .update(categories)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.isArchived, false)))
    .returning({ id: categories.id });

  if (!category) throw new CategoryError("No se encontró una categoría activa.");
  return category;
}

export async function restoreArchivedCategory(
  categoryId: unknown,
): Promise<{ id: string }> {
  const id = readCategoryId(categoryId);

  try {
    const [category] = await db
      .update(categories)
      .set({ isArchived: false, updatedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.isArchived, true)))
      .returning({ id: categories.id });

    if (!category) throw new CategoryError("No se encontró una categoría archivada.");
    return category;
  } catch (error) {
    if (error instanceof CategoryError) throw error;
    if (isActiveNameConflict(error)) {
      throw new CategoryError(
        "Ya existe una categoría activa con ese nombre. Cambiale el nombre antes de restaurarla.",
      );
    }
    throw error;
  }
}

/**
 * A replacement is always required, so callers cannot infer whether another
 * user's private expenses reference the archived category.
 */
export async function deleteArchivedCategory(
  categoryId: unknown,
  replacementCategoryId: unknown,
): Promise<{ id: string }> {
  const id = readCategoryId(categoryId);
  const replacementId = readCategoryId(replacementCategoryId);
  if (id === replacementId) {
    throw new CategoryError("Elegí otra categoría activa como reemplazo.");
  }

  return db.transaction(async (tx) => {
    const lockedCategories = await tx
      .select()
      .from(categories)
      .where(inArray(categories.id, [id, replacementId]))
      .orderBy(asc(categories.id))
      .for("update");
    const category = lockedCategories.find((item) => item.id === id);
    const replacement = lockedCategories.find(
      (item) => item.id === replacementId,
    );

    if (!category || !canDeleteArchivedCategory(category)) {
      throw new CategoryError("Primero archivá la categoría para poder eliminarla.");
    }
    if (!replacement || replacement.isArchived) {
      throw new CategoryError("Elegí una categoría activa de reemplazo.");
    }

    await tx
      .update(expenses)
      .set({ categoryId: replacement.id, updatedAt: new Date() })
      .where(eq(expenses.categoryId, category.id));

    const [deleted] = await tx
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.isArchived, true)))
      .returning({ id: categories.id });

    if (!deleted) {
      throw new CategoryError(
        "La categoría cambió mientras se procesaba. Actualizá la página e intentá de nuevo.",
      );
    }

    return deleted;
  });
}

export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}

function toCategoryView(
  category: typeof categories.$inferSelect,
): CategoryView {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    color: category.color,
    isArchived: category.isArchived,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function readCategoryId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id || id.length > 100) {
    throw new CategoryError("Elegí una categoría válida.");
  }
  return id;
}

function isActiveNameConflict(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const record = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (
      record.code === "23505" &&
      (record.constraint === "categories_active_name_unique" ||
        String(record.cause ?? "").includes("categories_active_name_unique"))
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}
