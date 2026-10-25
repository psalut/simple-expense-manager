import { describe, expect, it } from "vitest";
import {
  amountInputToCents,
  calculateGroupBalances,
  canEditExpense,
  canReadExpense,
  splitAmountCents,
  validateExpenseDraft,
} from "./policy";

describe("expense amount validation", () => {
  it("parses decimal strings into exact cents", () => {
    expect(amountInputToCents("1234,56")).toBe(BigInt(123456));
    expect(amountInputToCents("0.01")).toBe(BigInt(1));
    expect(amountInputToCents("1.001")).toBeNull();
    expect(amountInputToCents("0")).toBeNull();
    expect(amountInputToCents("1.2.3")).toBeNull();
    expect(amountInputToCents(2.5)).toBeNull();
  });

  it("validates the simplified draft and rejects legacy participant input", () => {
    const base = {
      amount: "10,25",
      description: "  Café  ",
      categoryId: "category-1",
      expenseDate: "2026-10-24",
      sharedSpaceId: "space-casa",
    };
    expect(validateExpenseDraft(base)).toMatchObject({
      success: true,
      data: { amountCents: BigInt(1025), description: "Café", sharedSpaceId: "space-casa" },
    });
    expect(validateExpenseDraft({ ...base, participantIds: ["a", "b"] })).toMatchObject({ success: false });
    expect(validateExpenseDraft({ ...base, expenseDate: "2026-02-30" })).toMatchObject({ success: false });
  });
});

describe("equal two-person split", () => {
  it("divides cents exactly and assigns an odd remainder to the payer", () => {
    expect(splitAmountCents(BigInt(100))).toEqual({
      payerShareCents: BigInt(50),
      otherShareCents: BigInt(50),
    });
    expect(splitAmountCents(BigInt(101))).toEqual({
      payerShareCents: BigInt(51),
      otherShareCents: BigInt(50),
    });
  });

  it("derives two member balances from shared expenses and stays zero-sum", () => {
    const balances = calculateGroupBalances(
      [{ userId: "a", name: "Ana" }, { userId: "b", name: "Beto" }],
      [
        { payerUserId: "a", amountCents: BigInt(101) },
        { payerUserId: "b", amountCents: BigInt(200) },
      ],
    );
    expect(balances.reduce((sum, member) => sum + member.balanceCents, BigInt(0))).toBe(BigInt(0));
    expect(balances.find((member) => member.userId === "a")?.balanceCents).toBe(BigInt(-50));
    expect(balances.find((member) => member.userId === "b")?.balanceCents).toBe(BigInt(50));
  });

  it("rejects non-two-person or unknown payer input", () => {
    expect(() => calculateGroupBalances([{ userId: "a", name: "Ana" }], [])).toThrow(/exactamente dos/);
    expect(() =>
      calculateGroupBalances(
        [{ userId: "a", name: "Ana" }, { userId: "b", name: "Beto" }],
        [{ payerUserId: "c", amountCents: BigInt(100) }],
      ),
    ).toThrow(/no coincide/);
  });
});

describe("expense authorization", () => {
  const own = { userId: "user-a", sharedSpaceId: null };
  const sharedByOther = { userId: "user-b", sharedSpaceId: "space-casa" };

  it("limits personal results to their author", () => {
    expect(canReadExpense("user-a", sharedByOther, { scope: "personal" })).toBe(false);
    expect(canReadExpense("user-a", own, { scope: "personal" })).toBe(true);
  });

  it("allows exact group members to read and only the author to edit", () => {
    expect(canReadExpense("user-a", sharedByOther, { scope: "group", sharedSpaceId: "space-casa", isMember: true })).toBe(true);
    expect(canReadExpense("user-a", sharedByOther, { scope: "group", sharedSpaceId: "space-viaje", isMember: true })).toBe(false);
    expect(canReadExpense("user-a", sharedByOther, { scope: "group", sharedSpaceId: "space-casa", isMember: false })).toBe(false);
    expect(canEditExpense("user-a", sharedByOther)).toBe(false);
    expect(canEditExpense("user-b", sharedByOther)).toBe(true);
  });
});
