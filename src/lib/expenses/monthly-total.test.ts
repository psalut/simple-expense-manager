import { describe, expect, it } from "vitest";
import { monthlyTotalCents } from "./monthly-total";
import { formatArs } from "./format";

const expense = (id: string, expenseDate: string, amountCents: string, userId = "a", sharedSpaceId: string | null = null) => ({ id, expenseDate, amountCents, userId, sharedSpaceId });

describe("personal monthly total", () => {
  it("includes the full own private and shared amounts, excluding the other payer", () => {
    expect(monthlyTotalCents([
      expense("private", "2026-10-01", "10001"),
      expense("shared", "2026-10-31", "20002", "a", "casa"),
      expense("other", "2026-10-10", "99999", "b", "casa"),
    ], "a", "2026-10")).toBe(30003n);
  });
  it("separates months and years by expense_date, including December/January", () => {
    const rows = [expense("1", "2025-10-01", "10"), expense("2", "2026-09-30", "20"), expense("3", "2026-10-31", "31"), expense("4", "2026-11-01", "40"), expense("5", "2026-12-31", "50"), expense("6", "2027-01-01", "60")];
    expect(monthlyTotalCents(rows, "a", "2026-10")).toBe(31n);
    expect(monthlyTotalCents(rows, "a", "2026-12")).toBe(50n);
    expect(monthlyTotalCents(rows, "a", "2027-01")).toBe(60n);
  });
  it("does not duplicate records and retains precision beyond Number.MAX_SAFE_INTEGER", () => {
    const row = expense("1", "2026-10-10", "9223372036854775807");
    expect(monthlyTotalCents([row, row, expense("2", "2026-10-11", "1")], "a", "2026-10")).toBe(9223372036854775808n);
  });
  it("formats an empty month and exact cents consistently in ARS", () => {
    expect(formatArs(monthlyTotalCents([], "a", "2026-10"))).toBe("$ 0,00");
    expect(formatArs(30003n)).toBe("$ 300,03");
  });
});
