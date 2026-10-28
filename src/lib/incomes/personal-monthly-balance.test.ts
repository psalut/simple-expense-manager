import { describe, expect, it } from "vitest";
import {
  hasPersonalMonthlyIncome,
  personalMonthlyBalanceCents,
} from "./personal-monthly-balance";

describe("personal monthly balance", () => {
  it("adds income and subtracts expenses using exact cents", () => {
    expect(
      personalMonthlyBalanceCents(
        [{ amountCents: "10201" }, { amountCents: 499n }],
        [{ amountCents: "20000" }],
      ),
    ).toBe(9300n);
  });

  it("can be negative and treats empty months as zero", () => {
    expect(personalMonthlyBalanceCents([{ amountCents: "100" }], [])).toBe(-100n);
    expect(personalMonthlyBalanceCents([], [])).toBe(0n);
  });

  it("shows the balance only when the selected month has at least one income", () => {
    expect(hasPersonalMonthlyIncome([])).toBe(false);
    expect(hasPersonalMonthlyIncome([{ amountCents: "0" }])).toBe(true);
    expect(
      personalMonthlyBalanceCents(
        [{ amountCents: "100" }],
        [{ amountCents: "100" }],
      ),
    ).toBe(0n);
    expect(hasPersonalMonthlyIncome([{ amountCents: "100" }])).toBe(true);
  });
});
