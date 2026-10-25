import { describe, expect, it } from "vitest";
import { canDeleteArchivedCategory, isCategoryAssignable, validateCategoryDraft } from "./policy";

describe("global category policy", () => {
  it("normalizes whitespace and uppercase hex colors", () => {
    expect(validateCategoryDraft({
      name: "  Super   mercado  ",
      description: "  Compras de alimentos ",
      color: "#2f6f66",
    })).toEqual({
      success: true,
      data: {
        name: "Super mercado",
        description: "Compras de alimentos",
        color: "#2F6F66",
      },
    });
  });

  it("requires a name, description, and valid color within limits", () => {
    expect(validateCategoryDraft({ name: " ", description: "desc", color: "#FFFFFF" })).toMatchObject({ success: false });
    expect(validateCategoryDraft({ name: "Comida", description: " ", color: "#FFFFFF" })).toMatchObject({ success: false });
    expect(validateCategoryDraft({ name: "n".repeat(61), description: "desc", color: "#FFFFFF" })).toMatchObject({ success: false });
    expect(validateCategoryDraft({ name: "Comida", description: "d".repeat(501), color: "#FFFFFF" })).toMatchObject({ success: false });
    expect(validateCategoryDraft({ name: "Comida", description: "desc", color: "red" })).toMatchObject({ success: false });
  });

  it("allows active categories for new expenses and preserves an archived historical category", () => {
    expect(isCategoryAssignable({ id: "a", isArchived: false })).toBe(true);
    expect(isCategoryAssignable({ id: "a", isArchived: true }, "a")).toBe(true);
    expect(isCategoryAssignable({ id: "a", isArchived: true }, "b")).toBe(false);
  });

  it("only permanently deletes archived categories", () => {
    expect(canDeleteArchivedCategory({ isArchived: true })).toBe(true);
    expect(canDeleteArchivedCategory({ isArchived: false })).toBe(false);
  });
});
