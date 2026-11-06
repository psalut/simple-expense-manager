import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
const ctx = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(ctx.cookie ? { cookie: ctx.cookie } : {}) }));
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { expenses } from "@/db/expenses-schema";
import { householdPayments } from "@/db/household-payments-schema";
import { sharedSpaceMembers, sharedSpaces } from "@/db/shared-space-schema";
import { auth } from "@/lib/auth";
import { createSharedSpace, createSharedSpaceInvitation, acceptSharedSpaceInvitation } from "./shared-spaces";
import { createExpense, deleteExpense, getGroupExpenseOverview, getPersonalMonthlyTotal, updateExpense } from "./expenses";
import { createHouseholdPayment, voidHouseholdPayment } from "./household-payments";
import { createPaymentAction, voidPaymentAction } from "@/app/(app)/household/payments/actions";

let a: { id: string; cookie: string }, b: { id: string; cookie: string }, outsider: { id: string; cookie: string }, space: string;
const categoryId = randomUUID();
const draft = { amount: "100.01", description: "Fixture", categoryId, expenseDate: "2026-10-01" };
const input = (payer: string, amount = "30.00") => ({ amount, date: "2020-01-01", note: "test", key: randomUUID(), expectedPayer: payer });
async function account(name: string) {
  const result = await auth.api.signUpEmail({ body: { name, email: `${randomUUID()}@example.test`, password: randomUUID() }, returnHeaders: true });
  return { id: result.response.user.id, cookie: result.headers.getSetCookie().map(x => x.split(";", 1)[0]).join("; ") };
}
async function balance(id: string) { return (await getGroupExpenseOverview(a.id, space)).balances.find(x => x.userId === id)!.balanceCents; }

describe("household payment integration", () => {
  beforeAll(async () => {
    a = await account("Ana"); b = await account("Bruno"); outsider = await account("Outsider");
    await db.insert(categories).values({ id: categoryId, name: "Fixture", description: "Test", color: "#336699" });
    await createSharedSpace(a.id, "Casa"); space = (await db.select().from(sharedSpaces))[0].id;
    await expect(createHouseholdPayment(a.id, input(b.id))).rejects.toThrow();
    const invitation = await createSharedSpaceInvitation(a.id, space); await acceptSharedSpaceInvitation(b.id, invitation.code);
  });
  beforeEach(async () => { await db.delete(householdPayments); await db.delete(expenses); ctx.cookie = ""; });
  it("supports partial, exact, odd cents, voids and both directions", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space });
    expect(await balance(a.id)).toBe("5000");
    const p = await createHouseholdPayment(b.id, input(b.id));
    expect(await balance(a.id)).toBe("2000");
    await createHouseholdPayment(a.id, input(b.id, "20"));
    expect(await balance(a.id)).toBe("0");
    await expect(createHouseholdPayment(a.id, input(b.id, "1"))).rejects.toThrow();
    await voidHouseholdPayment(a.id, p.id); expect(await balance(a.id)).toBe("3000");
    await db.delete(householdPayments); await db.delete(expenses);
    await createExpense(b.id, { ...draft, sharedSpaceId: space });
    await createHouseholdPayment(b.id, input(a.id, "50")); expect(await balance(a.id)).toBe("0");
  });
  it("rejects overpayment, wrong direction, bad data and outsiders without mutation", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space });
    for (const invalid of [input(b.id, "50.01"), input(a.id, "1"), input(b.id, "0"), { ...input(b.id), date: "9999-01-01" }]) await expect(createHouseholdPayment(a.id, invalid)).rejects.toThrow();
    await expect(createHouseholdPayment(outsider.id, input(b.id))).rejects.toThrow();
    expect(await db.select().from(householdPayments)).toHaveLength(0); expect(await balance(a.id)).toBe("5000");
  });
  it("requires real sessions and ignores supplied identity", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space });
    const payload = { ...input(b.id, "5"), userId: a.id, payerUserId: a.id, receiverUserId: outsider.id };
    expect((await createPaymentAction(payload)).success).toBe(false);
    ctx.cookie = outsider.cookie; expect((await createPaymentAction(payload)).success).toBe(false);
    ctx.cookie = b.cookie; const result = await createPaymentAction(payload); expect(result.success).toBe(true);
    const rows = await db.select().from(householdPayments); expect(rows[0]).toMatchObject({ payerUserId: b.id, receiverUserId: a.id, createdByUserId: b.id });
    ctx.cookie = outsider.cookie; expect((await voidPaymentAction(rows[0].id)).success).toBe(false);
  });
  it("makes retries idempotent and leaves personal totals unchanged", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space });
    const total = await getPersonalMonthlyTotal(a.id, "2026-10-01", "2026-11-01"); const p = input(b.id);
    const first = await createHouseholdPayment(a.id, p); expect(await createHouseholdPayment(a.id, p)).toEqual(first);
    await expect(createHouseholdPayment(a.id, { ...p, amount: "20" })).rejects.toThrow();
    expect(await getPersonalMonthlyTotal(a.id, "2026-10-01", "2026-11-01")).toBe(total); expect(await db.select().from(householdPayments)).toHaveLength(1);
  });
  it("prevents deleting memberships with payment history including voided payments", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space }); const p = await createHouseholdPayment(a.id, input(b.id)); await voidHouseholdPayment(a.id, p.id);
    await expect(db.delete(sharedSpaceMembers).where(eq(sharedSpaceMembers.userId, b.id))).rejects.toThrow();
  });
  it("serializes competing payments on independent connections", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space });
    const results = await Promise.allSettled([createHouseholdPayment(a.id, input(b.id, "50")), createHouseholdPayment(b.id, input(b.id, "50"))]);
    expect(results.filter(x => x.status === "fulfilled")).toHaveLength(1); expect(await balance(a.id)).toBe("0");
  });
  for (const operation of ["create", "edit", "delete", "to-private", "to-shared"] as const) {
    it(`serializes payment against expense ${operation}`, async () => {
      const fixture = await createExpense(a.id, { ...draft, sharedSpaceId: space });
      const privateFixture = operation === "to-shared" ? await createExpense(b.id, { ...draft, amount: "80", sharedSpaceId: null }) : null;
      const mutation = () => operation === "create" ? createExpense(b.id, { ...draft, amount: "80", sharedSpaceId: space }) : operation === "edit" ? updateExpense(a.id, fixture.id, { ...draft, amount: "20", sharedSpaceId: space }) : operation === "delete" ? deleteExpense(a.id, fixture.id) : operation === "to-private" ? updateExpense(a.id, fixture.id, { ...draft, sharedSpaceId: null }) : updateExpense(b.id, privateFixture!.id, { ...draft, amount: "80", sharedSpaceId: space });
      const results = await Promise.allSettled([createHouseholdPayment(a.id, input(b.id, "40")), mutation()]);
      expect(results[1].status).toBe("fulfilled");
      const rows = await db.select().from(householdPayments); expect(rows.length).toBe(results[0].status === "fulfilled" ? 1 : 0);
      const overview = await getGroupExpenseOverview(a.id, space); expect(overview.balances.reduce((sum, x) => sum + BigInt(x.balanceCents), 0n)).toBe(0n);
    });
  }
  it("serializes an annulment against a new payment", async () => {
    await createExpense(a.id, { ...draft, sharedSpaceId: space }); const p = await createHouseholdPayment(a.id, input(b.id, "30"));
    const results = await Promise.allSettled([voidHouseholdPayment(b.id, p.id), createHouseholdPayment(a.id, input(b.id, "40"))]);
    expect(results[0].status).toBe("fulfilled"); expect(await balance(a.id)).toBe(results[1].status === "fulfilled" ? "1000" : "5000");
  });
});
