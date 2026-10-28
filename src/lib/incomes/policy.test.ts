import { describe, expect, it } from "vitest";
import { canAccessIncome, validateIncomeDraft } from "./policy";

describe("income validation", () => {
  const validDraft = {
    amount: "1020,8",
    description: "  Sueldo  ",
    incomeDate: "2026-10-24",
  };

  it("parses a personal income with exact cents and a valid date", () => {
    expect(validateIncomeDraft(validDraft)).toEqual({
      success: true,
      data: {
        amountCents: 102080n,
        description: "Sueldo",
        incomeDate: "2026-10-24",
      },
    });
  });

  it("rejects invalid amounts, empty details and impossible dates", () => {
    expect(validateIncomeDraft({ ...validDraft, amount: "0" })).toMatchObject({ success: false });
    expect(validateIncomeDraft({ ...validDraft, description: "  " })).toMatchObject({ success: false });
    expect(validateIncomeDraft({ ...validDraft, incomeDate: "2026-02-30" })).toMatchObject({ success: false });
  });

  it("rejects attempts to associate an income with a shared space", () => {
    expect(
      validateIncomeDraft({ ...validDraft, sharedSpaceId: "casa-id" }),
    ).toMatchObject({
      success: false,
      error: "Los ingresos son personales y no se pueden compartir.",
    });
  });
});

describe("income ownership", () => {
  it("limits access to the owning user", () => {
    expect(canAccessIncome("user-a", { userId: "user-a" })).toBe(true);
    expect(canAccessIncome("user-b", { userId: "user-a" })).toBe(false);
  });
});
