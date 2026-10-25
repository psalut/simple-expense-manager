export type CategoryDraft = {
  name: string;
  description: string;
  color: string;
};

export type CategoryDraftResult =
  | { success: true; data: CategoryDraft }
  | { success: false; error: string };

export type CategoryRecord = {
  id: string;
  name: string;
  description: string;
  color: string;
  isArchived: boolean;
};

export function normalizeCategoryName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeCategoryColor(value: string): string {
  return value.toUpperCase();
}

export function validateCategoryDraft(value: unknown): CategoryDraftResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { success: false, error: "Completá nombre, descripción y color." };
  }

  const input = value as Record<string, unknown>;
  const name =
    typeof input.name === "string" ? normalizeCategoryName(input.name) : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const rawColor = typeof input.color === "string" ? input.color.trim() : "";

  if (!name) {
    return { success: false, error: "El nombre es obligatorio." };
  }
  if (name.length > 60) {
    return { success: false, error: "El nombre no puede superar 60 caracteres." };
  }
  if (!description) {
    return { success: false, error: "La descripción es obligatoria." };
  }
  if (description.length > 500) {
    return {
      success: false,
      error: "La descripción no puede superar 500 caracteres.",
    };
  }
  if (!/^#[\da-f]{6}$/i.test(rawColor)) {
    return {
      success: false,
      error: "Elegí un color hexadecimal válido, por ejemplo #2F6F66.",
    };
  }

  return {
    success: true,
    data: {
      name,
      description,
      color: normalizeCategoryColor(rawColor),
    },
  };
}

export function canDeleteArchivedCategory(
  category: Pick<CategoryRecord, "isArchived">,
): boolean {
  return category.isArchived;
}

export function isCategoryAssignable(
  category: Pick<CategoryRecord, "id" | "isArchived">,
  currentCategoryId?: string,
): boolean {
  return !category.isArchived || category.id === currentCategoryId;
}
