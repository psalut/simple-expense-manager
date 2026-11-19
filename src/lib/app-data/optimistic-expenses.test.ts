import { afterEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { ExpensePageData, HouseholdPageData } from "@/lib/app-data/types";
import { appDataQueryKeys } from "@/lib/app-data/query-keys";
import {
  applyPendingExpenseChanges,
  OPTIMISTIC_EXPENSE_ID_PREFIX,
  recoverExpenseMutation,
  runOptimisticExpenseChange,
  type ExpenseChange,
} from "@/lib/app-data/optimistic-expenses";
import type {
  GroupExpenseView,
  PersonalExpenseView,
} from "@/lib/server/expenses";

const userId = "user-a";
const octoberKey = appDataQueryKeys.expenseMonth(userId, "2026-10");
const novemberKey = appDataQueryKeys.expenseMonth(userId, "2026-11");
const householdKey = appDataQueryKeys.household(userId);
const clients = new Set<QueryClient>();

function createClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.add(client);
  return client;
}

afterEach(() => {
  for (const client of clients) client.clear();
  clients.clear();
});

function personalExpense(
  overrides: Partial<PersonalExpenseView> = {},
): PersonalExpenseView {
  return {
    kind: "expense",
    id: "expense-1",
    amountCents: "101",
    currency: "ARS",
    description: "Almacén",
    categoryId: "category-1",
    categoryName: "Comida",
    categoryColor: "#778174",
    categoryIcon: "shopping-basket",
    categoryIsArchived: false,
    expenseDate: "2026-10-10",
    sharedSpaceId: null,
    sharedSpaceName: null,
    ...overrides,
  };
}

function groupExpense(
  overrides: Partial<GroupExpenseView> = {},
): GroupExpenseView {
  return {
    ...personalExpense({
      sharedSpaceId: "casa",
      sharedSpaceName: "Casa",
    }),
    createdAt: "2026-10-10T12:00:00.000Z",
    payerUserId: userId,
    payerName: "Pablo",
    ...overrides,
  };
}

function personalData(expenses: PersonalExpenseView[]): ExpensePageData {
  return {
    expenses,
    incomes: [],
    monthlyTotal: expenses
      .reduce((total, expense) => total + BigInt(expense.amountCents), 0n)
      .toString(),
    categories: [],
    groups: [],
  };
}

function householdData(expenses: GroupExpenseView[]): HouseholdPageData {
  return {
    household: { empty: false, canJoin: false },
    space: {
      id: "casa",
      name: "Casa",
      members: [
        { userId, name: "Pablo" },
        { userId: "user-b", name: "Ana" },
      ],
    },
    legacy: [],
    overview: {
      expenses,
      balances: [
        {
          userId,
          name: "Pablo",
          paidCents: "101",
          assignedCents: "50",
          balanceCents: "51",
        },
      ],
      payments: [],
    },
    categories: [],
  };
}

function change(
  kind: ExpenseChange["kind"],
  before: PersonalExpenseView | null,
  after: PersonalExpenseView | null,
  groupAfter: GroupExpenseView | null = null,
): ExpenseChange {
  return { kind, before, after, groupAfter };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitFor(
  predicate: () => boolean,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(predicate()).toBe(true);
}

describe("optimistic expense cache updates", () => {
  it("adds a temporary personal expense immediately and removes it on failure", async () => {
    const client = createClient();
    const existing = personalExpense();
    client.setQueryData(octoberKey, personalData([existing]));
    const serverAction = deferred<{
      success: false;
      error: string;
    }>();
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actionStarted = resolve;
    });
    const optimistic = personalExpense({
      id: `${OPTIMISTIC_EXPENSE_ID_PREFIX}create`,
      amountCents: "9007199254740993",
      description: "Compra grande",
    });
    const save = runOptimisticExpenseChange(
      client,
      userId,
      change("create", null, optimistic),
      () => {
        actionStarted();
        return serverAction.promise;
      },
    );

    await started;
    const pending = client.getQueryData<ExpensePageData>(octoberKey)!;
    expect(pending.expenses.map((expense) => expense.id)).toContain(optimistic.id);
    expect(pending.monthlyTotal).toBe("9007199254741094");

    serverAction.resolve({ success: false, error: "No se pudo guardar." });
    await save;
    expect(client.getQueryData<ExpensePageData>(octoberKey)).toEqual(
      personalData([existing]),
    );
  });

  it("moves an edited expense between months using exact cent totals and rolls back only that change", async () => {
    const client = createClient();
    const before = personalExpense();
    client.setQueryData(octoberKey, personalData([before]));
    client.setQueryData(novemberKey, personalData([]));
    const after = personalExpense({
      amountCents: "209",
      description: "Compra modificada",
      expenseDate: "2026-11-02",
    });
    const serverAction = deferred<{
      success: false;
      error: string;
    }>();
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actionStarted = resolve;
    });
    const save = runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, after),
      () => {
        actionStarted();
        return serverAction.promise;
      },
    );

    await started;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([]);
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.monthlyTotal).toBe("0");
    expect(client.getQueryData<ExpensePageData>(novemberKey)?.expenses).toEqual([after]);
    expect(client.getQueryData<ExpensePageData>(novemberKey)?.monthlyTotal).toBe("209");

    serverAction.resolve({ success: false, error: "Falló la edición." });
    await save;
    expect(client.getQueryData<ExpensePageData>(octoberKey)).toEqual(
      personalData([before]),
    );
    expect(client.getQueryData<ExpensePageData>(novemberKey)).toEqual(
      personalData([]),
    );
  });

  it("removes a Casa expense immediately and restores it in both views on failure", async () => {
    const client = createClient();
    const before = groupExpense();
    client.setQueryData(octoberKey, personalData([before]));
    client.setQueryData(householdKey, householdData([before]));
    const serverAction = deferred<{
      success: false;
      error: string;
    }>();
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actionStarted = resolve;
    });
    const remove = runOptimisticExpenseChange(
      client,
      userId,
      change("delete", before, null),
      () => {
        actionStarted();
        return serverAction.promise;
      },
    );

    await started;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([]);
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses,
    ).toEqual([]);

    serverAction.resolve({ success: false, error: "No se pudo eliminar." });
    await remove;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([
      before,
    ]);
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses,
    ).toEqual([before]);
  });

  it("restores a shared expense in Casa if making it private fails", async () => {
    const client = createClient();
    const before = groupExpense();
    const after = personalExpense({
      amountCents: "203",
      sharedSpaceId: null,
      sharedSpaceName: null,
    });
    client.setQueryData(octoberKey, personalData([before]));
    client.setQueryData(householdKey, householdData([before]));
    const serverAction = deferred<{
      success: false;
      error: string;
    }>();
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actionStarted = resolve;
    });
    const save = runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, after),
      () => {
        actionStarted();
        return serverAction.promise;
      },
    );

    await started;
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses,
    ).toEqual([]);
    serverAction.resolve({ success: false, error: "No se pudo actualizar." });
    await save;
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses,
    ).toEqual([before]);
  });

  it("reconciles a confirmed Casa deletion without restoring the removed row", async () => {
    const client = createClient();
    const before = groupExpense();
    client.setQueryData(octoberKey, personalData([before]));
    client.setQueryData(householdKey, householdData([before]));
    const result = await runOptimisticExpenseChange(
      client,
      userId,
      change("delete", before, null),
      async () => ({ success: true, data: { id: before.id } }),
    );
    expect(result.success).toBe(true);
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([]);
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses,
    ).toEqual([]);

    client.setQueryData(
      octoberKey,
      applyPendingExpenseChanges(client, octoberKey, personalData([])),
    );
    client.setQueryData(
      householdKey,
      applyPendingExpenseChanges(client, householdKey, householdData([])),
    );
    expect(
      client.getQueryData(appDataQueryKeys.pendingExpenseOperations(userId)),
    ).toEqual([]);
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([]);
  });

  it("preserves a later same-expense edit when an earlier request fails", async () => {
    const client = createClient();
    const before = personalExpense();
    client.setQueryData(octoberKey, personalData([before]));
    const firstAfter = personalExpense({
      amountCents: "200",
      description: "Primera edición",
    });
    const secondAfter = personalExpense({
      amountCents: "301",
      description: "Segunda edición",
    });
    const firstAction = deferred<{
      success: false;
      error: string;
    }>();
    const secondAction = deferred<{ success: true; data: { id: string } }>();
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    let secondActionWasStarted = false;
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const secondStartedPromise = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, firstAfter),
      () => {
        firstStarted();
        return firstAction.promise;
      },
    );
    await firstStartedPromise;

    const secondSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", firstAfter, secondAfter),
      () => {
        secondActionWasStarted = true;
        secondStarted();
        return secondAction.promise;
      },
    );
    await waitFor(
      () =>
        client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]
          ?.amountCents === "301",
    );
    expect(secondActionWasStarted).toBe(false);

    firstAction.resolve({ success: false, error: "Primera edición rechazada." });
    await firstSave;
    await secondStartedPromise;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]).toMatchObject({
      amountCents: "301",
      description: "Segunda edición",
    });

    secondAction.resolve({ success: true, data: { id: before.id } });
    await secondSave;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]).toMatchObject({
      amountCents: "301",
      description: "Segunda edición",
    });
  });

  it("rolls a failed later edit back to the successful earlier value", async () => {
    const client = createClient();
    const before = personalExpense();
    client.setQueryData(octoberKey, personalData([before]));
    const firstAfter = personalExpense({
      amountCents: "200",
      description: "Guardado",
    });
    const secondAfter = personalExpense({
      amountCents: "301",
      description: "Fallido",
    });
    const firstAction = deferred<{ success: true; data: { id: string } }>();
    const secondAction = deferred<{
      success: false;
      error: string;
    }>();
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const secondStartedPromise = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, firstAfter),
      () => {
        firstStarted();
        return firstAction.promise;
      },
    );
    await firstStartedPromise;

    const secondSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", firstAfter, secondAfter),
      () => {
        secondStarted();
        return secondAction.promise;
      },
    );
    await waitFor(
      () =>
        client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]
          ?.amountCents === "301",
    );
    firstAction.resolve({ success: true, data: { id: before.id } });
    await firstSave;
    await secondStartedPromise;

    secondAction.resolve({ success: false, error: "No se pudo guardar." });
    await secondSave;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]).toMatchObject({
      amountCents: "200",
      description: "Guardado",
    });
  });

  it("rolls back a failed edit chain to the original persisted value", async () => {
    const client = createClient();
    const before = personalExpense();
    const firstAfter = personalExpense({
      amountCents: "200",
      description: "Primera edición",
    });
    const secondAfter = personalExpense({
      amountCents: "301",
      description: "Segunda edición",
    });
    client.setQueryData(octoberKey, personalData([before]));
    const firstAction = deferred<{
      success: false;
      error: string;
    }>();
    const secondAction = deferred<{
      success: false;
      error: string;
    }>();
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    const firstStartedPromise = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const secondStartedPromise = new Promise<void>((resolve) => {
      secondStarted = resolve;
    });
    const firstSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, firstAfter),
      () => {
        firstStarted();
        return firstAction.promise;
      },
    );
    await firstStartedPromise;
    const secondSave = runOptimisticExpenseChange(
      client,
      userId,
      change("update", firstAfter, secondAfter),
      () => {
        secondStarted();
        return secondAction.promise;
      },
    );
    await waitFor(
      () =>
        client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]
          ?.description === "Segunda edición",
    );

    firstAction.resolve({ success: false, error: "Primera edición rechazada." });
    await firstSave;
    await secondStartedPromise;
    secondAction.resolve({ success: false, error: "Segunda edición rechazada." });
    await secondSave;
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses).toEqual([
      before,
    ]);
  });

  it("keeps a failed mutation recoverable after its editor has been closed", async () => {
    const client = createClient();
    const before = personalExpense();
    const after = personalExpense({
      amountCents: "209",
      description: "Dato para recuperar",
    });
    client.setQueryData(octoberKey, personalData([before]));
    let actionCalls = 0;
    const result = await runOptimisticExpenseChange(
      client,
      userId,
      change("update", before, after),
      async () => {
        actionCalls += 1;
        return { success: false, error: "Servidor no disponible." };
      },
      {
        recovery: {
          route: "/?month=2026-10",
          kind: "update",
          before,
          groupBefore: null,
          draft: {
            amount: "2.09",
            description: after.description,
            categoryId: after.categoryId,
            expenseDate: after.expenseDate,
            sharedSpaceId: null,
          },
        },
      },
    );

    expect(result.success).toBe(false);
    expect(actionCalls).toBe(1);
    const notices = client.getQueryData<
      { id: string; type: string; recovery?: { draft: { description: string } } }[]
    >(appDataQueryKeys.expenseMutationNotices(userId));
    expect(notices).toHaveLength(1);
    expect(notices?.[0]).toMatchObject({
      type: "error",
      description: "Servidor no disponible.",
      recovery: { draft: { description: after.description } },
    });
    const recovered = recoverExpenseMutation(client, userId, notices![0].id);
    expect(recovered?.draft.description).toBe(after.description);
    expect(
      client.getQueryData(appDataQueryKeys.expenseMutationRecovery(userId)),
    ).toEqual(recovered);
  });

  it("reapplies a pending change over an in-flight refetch and updates Casa activity optimistically", async () => {
    const client = createClient();
    const base = personalExpense({
      sharedSpaceId: "casa",
      sharedSpaceName: "Casa",
    });
    const sharedBefore = groupExpense();
    client.setQueryData(octoberKey, personalData([base]));
    client.setQueryData(householdKey, householdData([sharedBefore]));
    const after = personalExpense({
      amountCents: "203",
      description: "Compartido actualizado",
      sharedSpaceId: "casa",
      sharedSpaceName: "Casa",
    });
    const groupAfter = groupExpense({
      amountCents: "203",
      description: "Compartido actualizado",
    });
    const serverAction = deferred<{
      success: false;
      error: string;
    }>();
    let actionStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      actionStarted = resolve;
    });
    const save = runOptimisticExpenseChange(
      client,
      userId,
      change("update", base, after, groupAfter),
      () => {
        actionStarted();
        return serverAction.promise;
      },
    );
    await started;

    const refetched = await client.fetchQuery({
      queryKey: householdKey,
      staleTime: 0,
      queryFn: async () =>
        applyPendingExpenseChanges(client, householdKey, householdData([sharedBefore])),
    });
    expect(refetched.overview?.expenses[0]).toMatchObject({
      amountCents: "203",
      description: "Compartido actualizado",
    });
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]).toMatchObject({
      amountCents: "203",
    });

    serverAction.resolve({ success: false, error: "Falló la edición." });
    await save;
    expect(client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses[0])
      .toMatchObject(sharedBefore);
    expect(client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]).toMatchObject(base);
  });

  it("keeps a successful create until authoritative personal and Casa reads reconcile it", async () => {
    const client = createClient();
    const after = personalExpense({
      id: `${OPTIMISTIC_EXPENSE_ID_PREFIX}confirmed`,
      amountCents: "507",
      sharedSpaceId: "casa",
      sharedSpaceName: "Casa",
    });
    const groupAfter = groupExpense({
      id: after.id,
      amountCents: "507",
    });
    client.setQueryData(octoberKey, personalData([]));
    client.setQueryData(householdKey, householdData([]));
    const result = await runOptimisticExpenseChange(
      client,
      userId,
      change("create", null, after, groupAfter),
      async () => ({ success: true, data: { id: "persisted-expense" } }),
    );
    expect(result.success).toBe(true);
    expect(
      client.getQueryData<ExpensePageData>(octoberKey)?.expenses[0]?.id,
    ).toBe("persisted-expense");
    expect(
      client.getQueryData<HouseholdPageData>(householdKey)?.overview?.expenses[0]?.id,
    ).toBe("persisted-expense");

    const authoritativePersonal = personalData([
      { ...after, id: "persisted-expense" },
    ]);
    const authoritativeHousehold = householdData([
      { ...groupAfter, id: "persisted-expense" },
    ]);
    const reconciledPersonal = applyPendingExpenseChanges(
      client,
      octoberKey,
      authoritativePersonal,
    );
    const reconciledHousehold = applyPendingExpenseChanges(
      client,
      householdKey,
      authoritativeHousehold,
    );
    expect(reconciledPersonal.expenses).toHaveLength(1);
    expect(reconciledHousehold.overview?.expenses).toHaveLength(1);
    client.setQueryData(octoberKey, reconciledPersonal);
    client.setQueryData(householdKey, reconciledHousehold);
    expect(
      client.getQueryData(appDataQueryKeys.pendingExpenseOperations(userId)),
    ).toEqual([]);
  });
});
