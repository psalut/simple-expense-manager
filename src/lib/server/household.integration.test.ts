import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const context = vi.hoisted(() => ({ cookie: "" }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(context.cookie ? { cookie: context.cookie } : {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { integrationSql } from "../../../tests/integration-database";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { sharedSpaceMembers, sharedSpaces, sharedSpaceInvitations } from "@/db/shared-space-schema";
import { createSharedSpace, createSharedSpaceInvitation, acceptSharedSpaceInvitation } from "./shared-spaces";
import { createExpense, getGroupExpenseOverview, getPersonalMonthlyTotal, updateExpense } from "./expenses";
import { getAuthenticatedUserId } from "./authenticated-user";
import { getHouseholdForUser } from "./household";
import { updateExpenseAction } from "@/app/(app)/expenses/actions";

type TestAccount = { id: string; cookie: string; email: string; password: string };
let a: TestAccount;
let b: TestAccount;
let c: TestAccount;
let householdId: string;
const categoryId = randomUUID();
const draft = { amount: "100.01", description: "Shared fixture", categoryId, expenseDate: "2026-10-27" };

async function account(name: string) {
  const email = `${randomUUID()}@example.test`;
  const password = randomUUID();
  const result = await auth.api.signUpEmail({ body: { name, email, password }, returnHeaders: true });
  return { id: result.response.user.id, cookie: result.headers.getSetCookie().map((line) => line.split(";", 1)[0]).join("; "), email, password };
}

describe("single household database and authorization", () => {
  beforeAll(async () => {
    const migration = await readFile("drizzle/0001_single_household.sql", "utf8");
    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) await integrationSql.unsafe(statement);
    }
    a = await account("A"); b = await account("B"); c = await account("C");
    await db.insert(categories).values({ id: categoryId, name: "Test", description: "Fixture", color: "#336699" });
  });

  it("permits exactly one concurrent Casa creation and rejects direct SQL duplicates", async () => {
    const results = await Promise.allSettled([createSharedSpace(a.id, "Casa"), createSharedSpace(a.id, "Casa")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const spaces = await db.select().from(sharedSpaces);
    expect(spaces).toHaveLength(1); householdId = spaces[0].id;
    await expect(db.insert(sharedSpaces).values({ id: randomUUID(), name: "Casa", createdBy: a.id })).rejects.toThrow();
  });

  it("blocks sharing before the second person, browser group IDs and outsider invitations", async () => {
    await expect(createExpense(a.id, { ...draft, sharedSpaceId: householdId })).rejects.toThrow(/dos integrantes/);
    await expect(createExpense(a.id, { ...draft, sharedSpaceId: "forged" })).rejects.toThrow(/Casa/);
    await expect(createSharedSpaceInvitation(c.id, householdId)).rejects.toThrow(/acceso/);
    expect(await getHouseholdForUser(b.id)).toMatchObject({ space: null, canJoin: true });
  });

  it("replaces previous codes and rejects expired codes without consuming a seat", async () => {
    const old = await createSharedSpaceInvitation(a.id, householdId);
    const expiring = await createSharedSpaceInvitation(a.id, householdId);
    await expect(acceptSharedSpaceInvitation(b.id, old.code)).rejects.toThrow(/utilizada/);
    await db.update(sharedSpaceInvitations).set({ expiresAt: new Date(0) });
    const expired = await db.select().from(sharedSpaceInvitations);
    expect(expired.every((invitation) => invitation.expiresAt.getTime() === 0)).toBe(true);
    await expect(acceptSharedSpaceInvitation(b.id, expiring.code)).rejects.toThrow(/venció/);
    const current = await createSharedSpaceInvitation(a.id, householdId);
    // A single valid code races across two distinct accounts.
    const results = await Promise.allSettled([acceptSharedSpaceInvitation(b.id, current.code), acceptSharedSpaceInvitation(c.id, current.code)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const members = await db.select().from(sharedSpaceMembers);
    expect(members).toHaveLength(2);
    if (members.some((member) => member.userId === c.id)) [b, c] = [c, b];
    await expect(acceptSharedSpaceInvitation(c.id, current.code)).rejects.toThrow(/utilizada/);
    await expect(createSharedSpaceInvitation(a.id, householdId)).rejects.toThrow(/dos integrantes/);
    await expect(db.insert(sharedSpaceMembers).values({ sharedSpaceId: householdId, userId: c.id })).rejects.toThrow();
    expect(await getHouseholdForUser(c.id)).toMatchObject({ space: null, canJoin: false });
  });

  it("derives balances across sharing changes; own totals include full amounts and exclude the other payer", async () => {
    const own = await createExpense(a.id, { ...draft, sharedSpaceId: null });
    const other = await createExpense(b.id, { ...draft, amount: "40.00", sharedSpaceId: householdId });
    expect(await getPersonalMonthlyTotal(a.id, "2026-10-01", "2026-11-01")).toBe("10001");
    await updateExpense(a.id, own.id, { ...draft, sharedSpaceId: householdId });
    const overview = await getGroupExpenseOverview(a.id, householdId);
    expect(overview.expenses).toHaveLength(2);
    expect(overview.balances.find((member) => member.userId === a.id)?.balanceCents).toBe("3000");
    expect(await getPersonalMonthlyTotal(a.id, "2026-10-01", "2026-11-01")).toBe("10001");
    context.cookie = a.cookie;
    expect(await updateExpenseAction(other.id, { ...draft, sharedSpaceId: null })).toMatchObject({ success: false });
    context.cookie = "";
    expect(await updateExpenseAction(own.id, { ...draft, sharedSpaceId: null })).toMatchObject({ success: false });
    await expect(getGroupExpenseOverview(c.id, householdId)).rejects.toThrow(/acceso/);
    await updateExpense(a.id, own.id, { ...draft, sharedSpaceId: null });
    expect((await getGroupExpenseOverview(a.id, householdId)).expenses).toHaveLength(1);
  });

  it("closes server signup and denies existing outsider sessions while keeping both members", async () => {
    process.env.AUTH_REGISTRATION_CLOSED = "true";
    context.cookie = c.cookie;
    await expect(getAuthenticatedUserId()).rejects.toThrow(/sesión/);
    context.cookie = a.cookie;
    expect(await getAuthenticatedUserId()).toBe(a.id);
    context.cookie = b.cookie;
    expect(await getAuthenticatedUserId()).toBe(b.id);
    context.cookie = "";
    vi.resetModules();
    const closedAuth = (await import("@/lib/auth")).auth;
    await expect(closedAuth.api.signUpEmail({ body: { name: "D", email: `${randomUUID()}@example.test`, password: randomUUID() } })).rejects.toThrow();
    await expect(closedAuth.api.signInEmail({ body: { email: c.email, password: c.password } })).rejects.toThrow();
    expect((await closedAuth.api.signInEmail({ body: { email: a.email, password: a.password } })).user.id).toBe(a.id);
    expect((await db.select().from(sharedSpaceMembers).where(eq(sharedSpaceMembers.sharedSpaceId, householdId)))).toHaveLength(2);
  });
});
