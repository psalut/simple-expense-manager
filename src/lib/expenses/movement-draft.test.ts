import { describe, expect, it } from "vitest";
import { switchMovementDraft } from "./movement-draft";

describe("movement editor mode", () => {
  it("preserves common fields and clears expense-only values when switching to income", () => {
    expect(
      switchMovementDraft(
        {
          kind: "expense",
          amount: "1020.8",
          description: "Sueldo",
          date: "2026-10-24",
          categoryId: "food",
          shared: true,
          groupId: "casa",
        },
        "income",
      ),
    ).toEqual({
      kind: "income",
      amount: "1020.8",
      description: "Sueldo",
      date: "2026-10-24",
      categoryId: "",
      shared: false,
      groupId: "",
    });
  });
});
