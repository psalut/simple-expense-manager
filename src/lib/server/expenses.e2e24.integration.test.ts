import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";

const requestContext = vi.hoisted(() => ({ cookie: "" }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(requestContext.cookie ? { cookie: requestContext.cookie } : {}),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createExpenseAction, deleteExpenseAction, updateExpenseAction } from "@/app/(app)/expenses/actions";
import { createIncomeAction, deleteIncomeAction, updateIncomeAction } from "@/app/(app)/incomes/actions";
import HomePage from "@/app/(app)/page";
import GroupDetailPage from "@/app/(app)/groups/[id]/page";
import { auth } from "@/lib/auth";
import { AuthenticationRequiredError, getAuthenticatedUserId } from "@/lib/server/authenticated-user";
import {
  ExpenseError,
  getGroupExpenseOverview,
  listPersonalExpenses,
} from "@/lib/server/expenses";
import { getPersonalIncomeMonth } from "@/lib/server/incomes";
import {
  acceptSharedSpaceInvitation,
  createSharedSpace,
  createSharedSpaceInvitation,
} from "@/lib/server/shared-spaces";
import { db } from "@/db";
import { categories } from "@/db/categories-schema";
import { expenses } from "@/db/expenses-schema";
import { incomes } from "@/db/incomes-schema";
import { sharedSpaces, sharedSpaceMembers } from "@/db/shared-space-schema";
import { user } from "@/db/auth-schema";

const TEST_DATE = "2026-10-25";
const RUN_ID = randomUUID();

type TestAccount = {
  id: string;
  cookie: string;
};

type PersistedExpense = {
  exists: boolean;
  amountCents: string | null;
  description: string | null;
  expenseDate: string | null;
  categoryId: string | null;
  categoryName: string | null;
  sharedSpaceId: string | null;
  updatedAt: string | null;
};

const createdUserIds: string[] = [];
const createdGroupNames: string[] = [];
const createdExpenseIds: string[] = [];
const createdIncomeIds: string[] = [];
let accountA: TestAccount;
let accountB: TestAccount;
let accountC: TestAccount;
let mainGroupId: string;
let targetGroupId: string;
let categoryAId: string;
let categoryBId: string;
let sharedExpenseId: string;
let privateExpenseId: string;
let sharedDraft: Record<string, unknown>;
let privateDraft: Record<string, unknown>;

describe("E2E-24 server authorization against Neon/PostgreSQL", () => {
  beforeAll(async () => {
    assertConfirmedDevelopmentDatabase();
    const [identity] = await db.execute<{ database: string; schema: string }>(
      sql`select current_database() as database, current_schema() as schema`,
    );
    if (!identity?.schema.startsWith("test_household_")) {
      throw new Error("E2E-24 only writes to its isolated disposable schema.");
    }

    await db.insert(categories).values([
      { id: randomUUID(), name: "Fixture A", description: "Test category A", color: "#336699" },
      { id: randomUUID(), name: "Fixture B", description: "Test category B", color: "#663399" },
    ]);

    const activeCategories = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.isArchived, false))
      .orderBy(categories.name, categories.id)
      .limit(2);
    if (activeCategories.length !== 2) {
      throw new Error("E2E-24 requiere dos categorías activas para detectar cambios de categoría.");
    }
    [categoryAId, categoryBId] = activeCategories.map(({ id }) => id);

    accountA = await createAuthenticatedFixture("A");
    accountB = await createAuthenticatedFixture("B");
    accountC = await createAuthenticatedFixture("C");

    const mainName = "Casa";
    createdGroupNames.push(mainName);
    await createSharedSpace(accountA.id, mainName);
    mainGroupId = await findCreatedGroupId(mainName);
    process.env.HOUSEHOLD_SPACE_ID = mainGroupId;
    const mainInvite = await createSharedSpaceInvitation(accountA.id, mainGroupId);
    await acceptSharedSpaceInvitation(accountB.id, mainInvite.code);

    const targetName = `E2E-24 ${RUN_ID} A-C`;
    createdGroupNames.push(targetName);
    // Historical group fixture predates 0001; normal services must not create one.
    targetGroupId = randomUUID();
    await db.insert(sharedSpaces).values({ id: targetGroupId, name: targetName, createdBy: accountA.id });
    await db.insert(sharedSpaceMembers).values([
      { sharedSpaceId: targetGroupId, userId: accountA.id },
      { sharedSpaceId: targetGroupId, userId: accountC.id },
    ]);

    sharedDraft = {
      amount: "100.00",
      description: `E2E-24 shared fixture ${RUN_ID}`,
      categoryId: categoryAId,
      expenseDate: TEST_DATE,
      sharedSpaceId: mainGroupId,
    };
    privateDraft = {
      amount: "50.00",
      description: `E2E-24 private fixture ${RUN_ID}`,
      categoryId: categoryAId,
      expenseDate: TEST_DATE,
      sharedSpaceId: null,
    };

    const sharedCreated = await asAccount(accountA, () => createExpenseAction(sharedDraft));
    if (!sharedCreated.success) throw new Error("E2E-24 no pudo crear su fixture compartido descartable.");
    sharedExpenseId = sharedCreated.data.id;
    createdExpenseIds.push(sharedExpenseId);

    const privateCreated = await asAccount(accountA, () => createExpenseAction(privateDraft));
    if (!privateCreated.success) throw new Error("E2E-24 no pudo crear su fixture privado descartable.");
    privateExpenseId = privateCreated.data.id;
    createdExpenseIds.push(privateExpenseId);
  }, 60_000);

  afterAll(async () => {
    try {
      if (createdExpenseIds.length) {
        await db.delete(expenses).where(inArray(expenses.id, createdExpenseIds));
      }
      if (createdIncomeIds.length) {
        await db.delete(incomes).where(inArray(incomes.id, createdIncomeIds));
      }
      if (createdGroupNames.length) {
        await db.delete(sharedSpaces).where(inArray(sharedSpaces.name, createdGroupNames));
      }
      if (createdUserIds.length) {
        await db.delete(user).where(inArray(user.id, createdUserIds));
      }
    } finally {
      requestContext.cookie = "";
      await db.$client.end({ timeout: 3 });
    }
  }, 30_000);

  it("resuelve sesiones Better Auth reales; B lee solo el gasto compartido y no recibe el privado de A", async () => {
    await expect(asAccount(accountA, getAuthenticatedUserId)).resolves.toBe(accountA.id);
    await expect(asAccount(accountB, getAuthenticatedUserId)).resolves.toBe(accountB.id);
    await expect(asAccount(accountC, getAuthenticatedUserId)).resolves.toBe(accountC.id);

    const groupView = await asAccount(accountB, async () => {
      const viewerId = await getAuthenticatedUserId();
      return getGroupExpenseOverview(viewerId, mainGroupId);
    });
    expect(groupView.expenses.find(({ id }) => id === sharedExpenseId)).toMatchObject({
      id: sharedExpenseId,
      amountCents: "10000",
      description: sharedDraft.description,
      categoryId: categoryAId,
      expenseDate: TEST_DATE,
      sharedSpaceId: mainGroupId,
      payerUserId: accountA.id,
    });
    expect(groupView.balances).toHaveLength(2);
    expect(await readGroupBalances(mainGroupId, accountA)).toEqual(
      [
        { userId: accountA.id, paidCents: "10000", assignedCents: "5000", balanceCents: "5000" },
        { userId: accountB.id, paidCents: "0", assignedCents: "5000", balanceCents: "-5000" },
      ].sort((left, right) => left.userId.localeCompare(right.userId)),
    );

    const personalView = await asAccount(accountB, async () => {
      const viewerId = await getAuthenticatedUserId();
      return listPersonalExpenses(viewerId, "2026-10-01", "2026-11-01");
    });
    expect(personalView.some(({ id }) => id === sharedExpenseId)).toBe(false);
    expect(personalView.some(({ id }) => id === privateExpenseId)).toBe(false);
    expect(groupView.expenses.some(({ id }) => id === privateExpenseId)).toBe(false);
  });

  it("keeps income private and outside household balances even for direct server-action calls", async () => {
    const balancesBefore = await readGroupBalances(mainGroupId, accountA);
    const sharedAttempt = await asAccount(accountA, () =>
      createIncomeAction({
        amount: "15.00",
        description: `E2E-24 shared income attempt ${RUN_ID}`,
        incomeDate: TEST_DATE,
        sharedSpaceId: mainGroupId,
      }),
    );
    expect(sharedAttempt).toMatchObject({ success: false });

    const created = await asAccount(accountA, () =>
      createIncomeAction({
        amount: "15.25",
        description: `E2E-24 personal income ${RUN_ID}`,
        incomeDate: TEST_DATE,
      }),
    );
    if (!created.success) throw new Error("E2E-24 no pudo crear su ingreso personal descartable.");
    createdIncomeIds.push(created.data.id);

    const ownerUpdate = await asAccount(accountA, () =>
      updateIncomeAction(created.data.id, {
        amount: "16.75",
        description: `E2E-24 updated personal income ${RUN_ID}`,
        incomeDate: TEST_DATE,
      }),
    );
    expect(ownerUpdate).toMatchObject({ success: true });

    const visibleToOwner = await asAccount(accountA, () =>
      getPersonalIncomeMonth(accountA.id, "2026-10-01", "2026-11-01"),
    );
    expect(visibleToOwner.find(({ id }) => id === created.data.id)).toMatchObject({
      kind: "income",
      amountCents: "1675",
      description: `E2E-24 updated personal income ${RUN_ID}`,
      incomeDate: TEST_DATE,
    });
    const visibleToOther = await asAccount(accountB, () =>
      getPersonalIncomeMonth(accountB.id, "2026-10-01", "2026-11-01"),
    );
    expect(visibleToOther.some(({ id }) => id === created.data.id)).toBe(false);

    const forgedUpdate = await asAccount(accountB, () =>
      updateIncomeAction(created.data.id, {
        amount: "999.99",
        description: "forged update",
        incomeDate: TEST_DATE,
      }),
    );
    expect(forgedUpdate).toMatchObject({ success: false });
    const forgedDelete = await asAccount(accountB, () =>
      deleteIncomeAction(created.data.id),
    );
    expect(forgedDelete).toMatchObject({ success: false });
    await expect(
      asAccount(accountA, () => getPersonalIncomeMonth(accountA.id, "2026-10-01", "2026-11-01")),
    ).resolves.toContainEqual(expect.objectContaining({ id: created.data.id, amountCents: "1675" }));
    await expect(readGroupBalances(mainGroupId, accountA)).resolves.toEqual(balancesBefore);

    const deleted = await asAccount(accountA, () => deleteIncomeAction(created.data.id));
    expect(deleted).toMatchObject({ success: true });
    createdIncomeIds.splice(createdIncomeIds.indexOf(created.data.id), 1);
  });

  it("rechaza el IDOR de edición de B con campos e identidad falsificados y conserva registro y balances", async () => {
    const maliciousPayload = {
      ...sharedDraft,
      id: privateExpenseId,
      expenseId: privateExpenseId,
      userId: accountA.id,
      ownerId: accountA.id,
      amount: "999999.99",
      description: `E2E-24 FORGED edit ${RUN_ID}`,
      categoryId: categoryBId,
      expenseDate: "2026-10-01",
    };

    const result = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountB, () => updateExpenseAction(sharedExpenseId, maliciousPayload)),
    );
    expect(result).toMatchObject({ success: false });
  });

  it("rechaza que B convierta en privado el gasto compartido de A y conserva balances", async () => {
    const result = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountB, () =>
        updateExpenseAction(sharedExpenseId, {
          ...sharedDraft,
          amount: "1.00",
          description: `E2E-24 FORGED private ${RUN_ID}`,
          sharedSpaceId: null,
        }),
      ),
    );
    expect(result).toMatchObject({ success: false });
  });

  it("rechaza que B mueva el gasto a otro grupo y conserva ambos grupos y balances", async () => {
    const beforeTarget = await readGroupBalances(targetGroupId, accountC);
    expect(beforeTarget.every(({ paidCents, assignedCents, balanceCents }) =>
      paidCents === "0" && assignedCents === "0" && balanceCents === "0",
    )).toBe(true);
    const result = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountB, () =>
        updateExpenseAction(sharedExpenseId, {
          ...sharedDraft,
          amount: "2.00",
          description: `E2E-24 FORGED move ${RUN_ID}`,
          sharedSpaceId: targetGroupId,
        }),
      ),
    );
    expect(result).toMatchObject({ success: false });
    await expect(readGroupBalances(targetGroupId, accountC)).resolves.toEqual(beforeTarget);
  });

  it("rechaza que B elimine el gasto compartido de A y conserva registro y balances", async () => {
    const result = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountB, () => deleteExpenseAction(sharedExpenseId)),
    );
    expect(result).toMatchObject({ success: false });
  });

  it("impide a B ver por listados, editar o eliminar el gasto privado de A (IDOR)", async () => {
    const beforeRead = await readPersistedState(privateExpenseId);
    const privateRead = await asAccount(accountB, async () => {
      const viewerId = await getAuthenticatedUserId();
      const [personal, group] = await Promise.all([
        listPersonalExpenses(viewerId, "2026-10-01", "2026-11-01"),
        getGroupExpenseOverview(viewerId, mainGroupId),
      ]);
      return { personal, group };
    });
    expect(privateRead.personal.some(({ id }) => id === privateExpenseId)).toBe(false);
    expect(privateRead.group.expenses.some(({ id }) => id === privateExpenseId)).toBe(false);
    await expect(readPersistedState(privateExpenseId)).resolves.toEqual(beforeRead);

    const updateResult = await expectDeniedWithoutMutation(privateExpenseId, () =>
      asAccount(accountB, () =>
        updateExpenseAction(privateExpenseId, {
          ...privateDraft,
          amount: "0.01",
          description: `E2E-24 FORGED private IDOR ${RUN_ID}`,
        }),
      ),
    );
    expect(updateResult).toMatchObject({ success: false });

    const deleteResult = await expectDeniedWithoutMutation(privateExpenseId, () =>
      asAccount(accountB, () => deleteExpenseAction(privateExpenseId)),
    );
    expect(deleteResult).toMatchObject({ success: false });
  }, 30_000);

  it("rechaza lectura, edición y eliminación de C, que no pertenece al grupo A-B", async () => {
    const before = await readPersistedState(sharedExpenseId);
    await expect(
      asAccount(accountC, async () => {
        const viewerId = await getAuthenticatedUserId();
        return getGroupExpenseOverview(viewerId, mainGroupId);
      }),
    ).rejects.toBeInstanceOf(ExpenseError);
    await expect(readPersistedState(sharedExpenseId)).resolves.toEqual(before);

    const updateResult = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountC, () =>
        updateExpenseAction(sharedExpenseId, {
          ...sharedDraft,
          amount: "3.00",
          description: `E2E-24 C FORGED edit ${RUN_ID}`,
        }),
      ),
    );
    expect(updateResult).toMatchObject({ success: false });

    const deleteResult = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(accountC, () => deleteExpenseAction(sharedExpenseId)),
    );
    expect(deleteResult).toMatchObject({ success: false });
  }, 30_000);

  it("exige sesión para las lecturas de página y las mutaciones de Server Action", async () => {
    const beforeHomeRead = await readPersistedState(sharedExpenseId);
    await expect(asAccount(null, () => HomePage({ searchParams: Promise.resolve({}) }))).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    await expect(readPersistedState(sharedExpenseId)).resolves.toEqual(beforeHomeRead);

    const beforeGroupRead = await readPersistedState(sharedExpenseId);
    await expect(
      asAccount(null, () => GroupDetailPage({ params: Promise.resolve({ id: mainGroupId }) })),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);
    await expect(readPersistedState(sharedExpenseId)).resolves.toEqual(beforeGroupRead);

    const updateResult = await expectDeniedWithoutMutation(sharedExpenseId, () =>
      asAccount(null, () => updateExpenseAction(sharedExpenseId, sharedDraft)),
    );
    expect(updateResult).toMatchObject({ success: false });

    const deleteResult = await expectDeniedWithoutMutation(privateExpenseId, () =>
      asAccount(null, () => deleteExpenseAction(privateExpenseId)),
    );
    expect(deleteResult).toMatchObject({ success: false });

    const balanceBefore = await readGroupBalances(mainGroupId, accountA);
    const unauthenticatedCreate = await asAccount(null, () => createExpenseAction({
      ...privateDraft,
      description: `E2E-24 unauthenticated create ${RUN_ID}`,
    }));
    expect(unauthenticatedCreate).toMatchObject({ success: false });
    const accidentalCreate = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(eq(expenses.description, `E2E-24 unauthenticated create ${RUN_ID}`));
    expect(accidentalCreate).toHaveLength(0);
    await expect(readGroupBalances(mainGroupId, accountA)).resolves.toEqual(balanceBefore);
  }, 30_000);

  it("permite a A editar legítimamente su gasto descartable", async () => {
    const updatedDraft = {
      ...sharedDraft,
      amount: "123.45",
      description: `E2E-24 legitimate A edit ${RUN_ID}`,
      categoryId: categoryBId,
      expenseDate: "2026-10-24",
      sharedSpaceId: mainGroupId,
    };
    const result = await asAccount(accountA, () => updateExpenseAction(sharedExpenseId, updatedDraft));
    expect(result).toMatchObject({ success: true, data: { id: sharedExpenseId, sharedSpaceId: mainGroupId } });
    const persisted = await readPersistedState(sharedExpenseId);
    expect(persisted.expense).toMatchObject({
      exists: true,
      amountCents: "12345",
      description: updatedDraft.description,
      expenseDate: updatedDraft.expenseDate,
      categoryId: categoryBId,
      sharedSpaceId: mainGroupId,
    });
    expect(await readGroupBalances(mainGroupId, accountA)).toEqual(
      [
        { userId: accountA.id, paidCents: "12345", assignedCents: "6173", balanceCents: "6172" },
        { userId: accountB.id, paidCents: "0", assignedCents: "6172", balanceCents: "-6172" },
      ].sort((left, right) => left.userId.localeCompare(right.userId)),
    );
  });
});

function assertConfirmedDevelopmentDatabase() {
  if (process.env.RUN_DB_INTEGRATION !== "true") throw new Error("Explicit DB integration opt-in required.");
}

async function createAuthenticatedFixture(label: string): Promise<TestAccount> {
  const email = `e2e-24-${RUN_ID}-${label.toLowerCase()}@example.test`;
  const result = await auth.api.signUpEmail({
    body: {
      name: `E2E-24 ${label}`,
      email,
      password: `test-${randomUUID()}-Only-Local`,
    },
    headers: new Headers({ host: "localhost:3000", origin: "http://localhost:3000" }),
    returnHeaders: true,
  });
  const userId = result.response.user.id;
  createdUserIds.push(userId);
  const cookies = result.headers.getSetCookie().map((line) => line.split(";", 1)[0]);
  const sessionCookie = cookies.find((cookie) => /(?:__Secure-|__Host-)?better-auth\.session_token=/i.test(cookie));
  if (!sessionCookie) throw new Error("Better Auth no devolvió una cookie de sesión para el fixture.");
  return { id: userId, cookie: sessionCookie };
}

async function findCreatedGroupId(name: string): Promise<string> {
  const [group] = await db
    .select({ id: sharedSpaces.id })
    .from(sharedSpaces)
    .where(eq(sharedSpaces.name, name))
    .limit(1);
  if (!group) throw new Error("No se encontró el grupo temporal creado para E2E-24.");
  return group.id;
}

async function asAccount<T>(account: TestAccount | null, operation: () => Promise<T>): Promise<T> {
  requestContext.cookie = account?.cookie ?? "";
  try {
    return await operation();
  } finally {
    requestContext.cookie = "";
  }
}

async function readPersistedState(expenseId: string): Promise<{
  expense: PersistedExpense;
  balances: Awaited<ReturnType<typeof readGroupBalances>>;
}> {
  const [row] = await db
    .select({
      id: expenses.id,
      amountCents: expenses.amountCents,
      description: expenses.description,
      expenseDate: expenses.expenseDate,
      categoryId: expenses.categoryId,
      categoryName: categories.name,
      sharedSpaceId: expenses.sharedSpaceId,
      updatedAt: expenses.updatedAt,
    })
    .from(expenses)
    .innerJoin(categories, eq(expenses.categoryId, categories.id))
    .where(eq(expenses.id, expenseId))
    .limit(1);
  const balances = await readGroupBalances(mainGroupId, accountA);

  return {
    expense: row
      ? {
          exists: true,
          amountCents: row.amountCents.toString(),
          description: row.description,
          expenseDate: row.expenseDate,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          sharedSpaceId: row.sharedSpaceId,
          updatedAt: row.updatedAt.toISOString(),
        }
      : {
          exists: false,
          amountCents: null,
          description: null,
          expenseDate: null,
          categoryId: null,
          categoryName: null,
          sharedSpaceId: null,
          updatedAt: null,
        },
    balances,
  };
}

async function readGroupBalances(
  sharedSpaceId: string,
  viewer: TestAccount,
): Promise<Array<{ userId: string; paidCents: string; assignedCents: string; balanceCents: string }>> {
  const overview = await asAccount(viewer, async () => {
    const viewerId = await getAuthenticatedUserId();
    return getGroupExpenseOverview(viewerId, sharedSpaceId);
  });
  return overview.balances
    .map(({ userId, paidCents, assignedCents, balanceCents }) => ({
      userId,
      paidCents,
      assignedCents,
      balanceCents,
    }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
}

async function expectDeniedWithoutMutation<T>(
  expenseId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const before = await readPersistedState(expenseId);
  const result = await operation();
  expect(result).toMatchObject({ success: false });
  const after = await readPersistedState(expenseId);
  expect(after).toEqual(before);
  return result;
}
