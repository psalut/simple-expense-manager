import { inSelectedMonth } from "./activity";
import { describe, expect, it } from "vitest";
import { calculateGroupBalances } from "@/lib/expenses/policy";
import { validatePayment } from "./policy";
const members = [{ userId: "a", name: "Ana" }, { userId: "b", name: "Bruno" }];
const payment = { payerUserId: "b", receiverUserId: "a", amountCents: 3000n, voidedAt: null };
const draft = { amount: "30.00", date: "2026-11-06", note: "", key: "12345678-1234-1234", expectedPayer: "b" };
describe("household payments", () => {
  it("applies partial and exact payments without changing odd-cent splits", () => {
    const expenses = [{ payerUserId: "a", amountCents: 10001n }];
    expect(calculateGroupBalances(members, expenses, [payment]).map(x => x.balanceCents)).toEqual([2000n, -2000n]);
    expect(calculateGroupBalances(members, expenses, [{ ...payment, amountCents: 5000n }]).map(x => x.balanceCents)).toEqual([0n, 0n]);
  });
  it("handles the opposite direction and ignores a voided payment", () => {
    const expenses = [{ payerUserId: "b", amountCents: 10000n }];
    const reverse = { ...payment, payerUserId: "a", receiverUserId: "b" };
    expect(calculateGroupBalances(members, expenses, [reverse]).map(x => x.balanceCents)).toEqual([-2000n, 2000n]);
    expect(calculateGroupBalances(members, expenses, [{ ...reverse, voidedAt: new Date() }]).map(x => x.balanceCents)).toEqual([-5000n, 5000n]);
  });
  it("filters activity by selected month without changing balances", () => {
    expect(inSelectedMonth("2026-10-31", "2026-10")).toBe(true);
    expect(inSelectedMonth("2026-11-01", "2026-10")).toBe(false);
    expect(inSelectedMonth("2026-11-01")).toBe(true);
  });
  it("validates exact amounts and date boundaries", () => {
    expect(validatePayment(draft, "2026-11-06")?.amountCents).toBe(3000n);
    for (const patch of [{ amount: "0" }, { amount: "-1" }, { amount: "1.001" }, { amount: "92233720368547758.08" }, { date: "2026-11-07" }, { date: "2026-02-30" }, { note: "a".repeat(201) }]) expect(validatePayment({ ...draft, ...patch }, "2026-11-06")).toBeNull();
    expect(validatePayment({ ...draft, date: "2020-01-01" }, "2026-11-06")).not.toBeNull();
  });
});
