import { describe, expect, it } from "vitest";
import { personalMonthlyBalanceCents } from "./personal-monthly-balance";

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
});
