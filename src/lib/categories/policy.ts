export type CategoryScope = "personal" | "shared";

export type CategoryDraft = {
  name: string;
  description: string;
  scope: CategoryScope;
  sharedSpaceId: string | null;
};

export type CategoryDraftResult =
  | { success: true; data: CategoryDraft }
  | { success: false; error: string };

export type CategoryOwnership = {
  userId: string | null;
  sharedSpaceId: string | null;
};

export type CategoryEligibility = CategoryOwnership & {
  isArchived: boolean;
};

export type CategoryEligibilityContext =
  | { shared: false }
  | { shared: true; sharedSpaceId: string };

export function validateCategoryDraft(value: unknown): CategoryDraftResult {
  if (typeof value !== "object" || value === null) {
    return { success: false, error: "Completá el nombre y la descripción." };
  }

  const input = value as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const scope = input.scope === undefined ? "personal" : input.scope;
  const sharedSpaceId =
    typeof input.sharedSpaceId === "string" ? input.sharedSpaceId.trim() : null;

  if (!name) {
    return { success: false, error: "El nombre es obligatorio." };
  }
  if (name.length > 80) {
    return { success: false, error: "El nombre no puede superar 80 caracteres." };
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
  if (scope !== "personal" && scope !== "shared") {
    return { success: false, error: "Elegí un ámbito válido." };
  }
  if (scope === "shared" && (!sharedSpaceId || sharedSpaceId.length > 100)) {
    return { success: false, error: "Elegí el grupo de esta categoría." };
  }
  if (scope === "personal" && sharedSpaceId !== null) {
    return {
      success: false,
      error: "Las categorías personales no pertenecen a un grupo.",
    };
  }

  return {
    success: true,
    data: {
      name,
      description,
      scope,
      sharedSpaceId: scope === "shared" ? sharedSpaceId : null,
    },
  };
}

export function canManageCategory(
  category: CategoryOwnership,
  userId: string,
  memberSpaceIds: readonly string[],
): boolean {
  const hasUserOwner = category.userId !== null;
  const hasSharedSpace = category.sharedSpaceId !== null;

  if (hasUserOwner === hasSharedSpace) return false;
  if (category.userId === userId) return true;

  return (
    category.sharedSpaceId !== null &&
    memberSpaceIds.includes(category.sharedSpaceId)
  );
}

export function canDeleteArchivedCategory(
  category: CategoryOwnership & { isArchived: boolean },
  userId: string,
  memberSpaceIds: readonly string[],
): boolean {
  return (
    category.isArchived &&
    canManageCategory(category, userId, memberSpaceIds)
  );
}

export function isCategoryEligible(
  category: CategoryEligibility,
  userId: string,
  memberSpaceIds: readonly string[],
  context: CategoryEligibilityContext,
): boolean {
  if (category.isArchived) return false;

  const hasUserOwner = category.userId !== null;
  const hasSharedSpace = category.sharedSpaceId !== null;
  if (hasUserOwner === hasSharedSpace) return false;

  if (context.shared) {
    return (
      memberSpaceIds.includes(context.sharedSpaceId) &&
      category.sharedSpaceId === context.sharedSpaceId
    );
  }

  return (
    category.userId === userId ||
    (category.sharedSpaceId !== null &&
      memberSpaceIds.includes(category.sharedSpaceId))
  );
}
