import { describe, expect, it } from "vitest";
import {
  canDeleteArchivedCategory,
  canManageCategory,
  categoryBelongsToScope,
  isCategoryEligible,
  validateCategoryDraft,
} from "./policy";

describe("category draft validation", () => {
  it("trims fields, defaults new categories to personal, and stores no group", () => {
    expect(
      validateCategoryDraft({
        name: "  Supermercado  ",
        description: "  Compras de alimentos  ",
      }),
    ).toEqual({
      success: true,
      data: {
        name: "Supermercado",
        description: "Compras de alimentos",
        scope: "personal",
        sharedSpaceId: null,
      },
    });
  });

  it("requires a selected group for shared categories and forbids one for personal", () => {
    expect(
      validateCategoryDraft({
        name: "Comida",
        description: "Detalle",
        scope: "shared",
      }),
    ).toMatchObject({ success: false, error: "Elegí el grupo de esta categoría." });
    expect(
      validateCategoryDraft({
        name: "Comida",
        description: "Detalle",
        scope: "shared",
        sharedSpaceId: "space-casa",
      }),
    ).toMatchObject({
      success: true,
      data: { scope: "shared", sharedSpaceId: "space-casa" },
    });
    expect(
      validateCategoryDraft({
        name: "Comida",
        description: "Detalle",
        scope: "personal",
        sharedSpaceId: "space-casa",
      }),
    ).toMatchObject({ success: false });
  });

  it("requires a nonblank name and description and enforces length limits", () => {
    expect(validateCategoryDraft({ name: "   ", description: "texto" })).toMatchObject({
      success: false,
      error: "El nombre es obligatorio.",
    });
    expect(validateCategoryDraft({ name: "Comida", description: "  " })).toMatchObject({
      success: false,
      error: "La descripción es obligatoria.",
    });
    expect(validateCategoryDraft({ name: "n".repeat(81), description: "detalle" })).toMatchObject({
      success: false,
    });
    expect(validateCategoryDraft({ name: "Comida", description: "d".repeat(501) })).toMatchObject({
      success: false,
    });
    expect(
      validateCategoryDraft({ name: "Comida", description: "detalle", scope: "other" }),
    ).toMatchObject({ success: false });
  });
});

describe("category catalog scope", () => {
  const personal = { userId: "user-a", sharedSpaceId: null };
  const casa = { userId: null, sharedSpaceId: "space-casa" };
  const viaje = { userId: null, sharedSpaceId: "space-viaje" };

  it("keeps personal categories in the personal catalog", () => {
    expect(categoryBelongsToScope(personal, null)).toBe(true);
    expect(categoryBelongsToScope(casa, null)).toBe(false);
  });

  it("matches shared categories to the exact group identifier", () => {
    expect(categoryBelongsToScope(casa, "space-casa")).toBe(true);
    expect(categoryBelongsToScope(viaje, "space-casa")).toBe(false);
    expect(categoryBelongsToScope(personal, "space-casa")).toBe(false);
  });
});

describe("category management permissions", () => {
  const casa = { userId: null, sharedSpaceId: "space-casa" };
  const viaje = { userId: null, sharedSpaceId: "space-viaje" };

  it("allows a user in Casa and Viaje to manage both catalogs, scoped per group", () => {
    expect(canManageCategory(casa, "user-a", ["space-casa", "space-viaje"])).toBe(true);
    expect(canManageCategory(viaje, "user-a", ["space-casa", "space-viaje"])).toBe(true);
  });

  it("allows B only in Casa, C only in Viaje, and denies cross-group access", () => {
    expect(canManageCategory(casa, "user-b", ["space-casa"])).toBe(true);
    expect(canManageCategory(viaje, "user-b", ["space-casa"])).toBe(false);
    expect(canManageCategory(viaje, "user-c", ["space-viaje"])).toBe(true);
    expect(canManageCategory(casa, "user-c", ["space-viaje"])).toBe(false);
  });

  it("allows only the owner to manage personal categories", () => {
    const personal = { userId: "user-a", sharedSpaceId: null };
    expect(canManageCategory(personal, "user-a", [])).toBe(true);
    expect(canManageCategory(personal, "user-b", ["space-casa"])).toBe(false);
  });

  it("rejects rows that violate exclusive ownership", () => {
    expect(
      canManageCategory(
        { userId: "user-a", sharedSpaceId: "space-casa" },
        "user-a",
        ["space-casa"],
      ),
    ).toBe(false);
    expect(canManageCategory({ userId: null, sharedSpaceId: null }, "user-a", [])).toBe(false);
  });
});

describe("permanent category deletion policy", () => {
  it("allows only the owner to delete an archived personal category", () => {
    const archivedPersonal = {
      userId: "user-a",
      sharedSpaceId: null,
      isArchived: true,
    };
    expect(canDeleteArchivedCategory(archivedPersonal, "user-a", [])).toBe(true);
    expect(canDeleteArchivedCategory(archivedPersonal, "user-b", [])).toBe(false);
  });

  it("requires archiving first and checks membership in the exact group", () => {
    const active = {
      userId: null,
      sharedSpaceId: "space-casa",
      isArchived: false,
    };
    const archived = { ...active, isArchived: true };
    expect(canDeleteArchivedCategory(active, "user-a", ["space-casa"])).toBe(false);
    expect(canDeleteArchivedCategory(archived, "user-a", ["space-casa"])).toBe(true);
    expect(canDeleteArchivedCategory(archived, "user-b", ["space-viaje"])).toBe(false);
  });
});

describe("eligible categories for future expense forms and AI", () => {
  const personalA = { userId: "user-a", sharedSpaceId: null, isArchived: false };
  const personalB = { userId: "user-b", sharedSpaceId: null, isArchived: false };
  const casa = { userId: null, sharedSpaceId: "space-casa", isArchived: false };
  const viaje = { userId: null, sharedSpaceId: "space-viaje", isArchived: false };
  const tercero = { userId: null, sharedSpaceId: "space-tercero", isArchived: false };
  const archivedCasa = { userId: null, sharedSpaceId: "space-casa", isArchived: true };
  const memberships = ["space-casa", "space-viaje"];

  it("offers A's personal categories and both member-group catalogs for private expenses", () => {
    const context = { shared: false } as const;
    expect(isCategoryEligible(personalA, "user-a", memberships, context)).toBe(true);
    expect(isCategoryEligible(personalB, "user-a", memberships, context)).toBe(false);
    expect(isCategoryEligible(casa, "user-a", memberships, context)).toBe(true);
    expect(isCategoryEligible(viaje, "user-a", memberships, context)).toBe(true);
    expect(isCategoryEligible(tercero, "user-a", memberships, context)).toBe(false);
  });

  it("offers only the exact selected group for shared expenses", () => {
    const context = { shared: true, sharedSpaceId: "space-casa" } as const;
    expect(isCategoryEligible(personalA, "user-a", memberships, context)).toBe(false);
    expect(isCategoryEligible(casa, "user-a", memberships, context)).toBe(true);
    expect(isCategoryEligible(viaje, "user-a", memberships, context)).toBe(false);
    expect(isCategoryEligible(casa, "user-b", ["space-casa"], context)).toBe(true);
    expect(isCategoryEligible(casa, "user-c", ["space-viaje"], context)).toBe(false);
  });

  it("excludes archived categories and a foreign selected group", () => {
    expect(isCategoryEligible(archivedCasa, "user-a", memberships, { shared: false })).toBe(false);
    expect(
      isCategoryEligible(
        casa,
        "user-a",
        memberships,
        { shared: true, sharedSpaceId: "space-tercero" },
      ),
    ).toBe(false);
  });

  it("keeps same-named categories distinguishable by group identity", () => {
    const casaCategory = { ...casa, id: "category-casa", name: "Supermercado" };
    const viajeCategory = { ...viaje, id: "category-viaje", name: "Supermercado" };
    expect(casaCategory.name).toBe(viajeCategory.name);
    expect(casaCategory.id).not.toBe(viajeCategory.id);
    expect(isCategoryEligible(casaCategory, "user-a", memberships, { shared: true, sharedSpaceId: "space-casa" })).toBe(true);
    expect(isCategoryEligible(viajeCategory, "user-a", memberships, { shared: true, sharedSpaceId: "space-casa" })).toBe(false);
  });
});
