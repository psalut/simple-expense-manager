"use client";

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type {
  ExpensePageData,
  HouseholdPageData,
} from "@/lib/app-data/types";
import { appDataQueryKeys } from "@/lib/app-data/query-keys";
import type {
  GroupExpenseView,
  PersonalExpenseView,
} from "@/lib/server/expenses";
import type { ActionResult } from "@/lib/action-result";

export const OPTIMISTIC_EXPENSE_ID_PREFIX = "optimistic-expense:";

type ExpenseChangeKind = "create" | "update" | "delete";

export type ExpenseChange = {
  kind: ExpenseChangeKind;
  before: PersonalExpenseView | null;
  after: PersonalExpenseView | null;
  groupAfter: GroupExpenseView | null;
};

export type ExpenseRecoveryDraft = {
  amount: string;
  description: string;
  categoryId: string;
  expenseDate: string;
  sharedSpaceId: string | null;
};

export type ExpenseMutationRecovery = {
  route: string;
  kind: ExpenseChangeKind;
  before: PersonalExpenseView | null;
  groupBefore: GroupExpenseView | null;
  draft: ExpenseRecoveryDraft;
};

export type ExpenseMutationNotice = {
  id: string;
  type: "success" | "error";
  title: string;
  description?: string;
  recovery?: ExpenseMutationRecovery;
};

type PendingExpenseOperation = ExpenseChange & {
  operationId: string;
  userId: string;
  groupBefore: GroupExpenseView | null;
  status: "pending" | "committed";
  reconciliationFailed?: boolean;
  requiredKeys: string[];
  confirmedKeys: string[];
};

const operationKey = (userId: string) =>
  appDataQueryKeys.pendingExpenseOperations(userId);
const mutationQueues = new Map<string, Promise<unknown>>();
const subscribedClients = new WeakSet<QueryClient>();

function subscribeToExpenseReconciliation(queryClient: QueryClient) {
  if (subscribedClients.has(queryClient)) return;
  subscribedClients.add(queryClient);
  queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type !== "updated" ||
      (event.action.type !== "success" && event.action.type !== "error")
    ) {
      return;
    }
    const queryKey = event.query.queryKey;
    if (
      (queryKey[2] !== "expenses" && queryKey[2] !== "household") ||
      typeof queryKey[1] !== "string"
    ) {
      return;
    }

    const userId = queryKey[1];
    const key = keyForQuery(queryKey);
    const operations = pendingOperations(queryClient, userId);
    const nextOperations =
      event.action.type === "error"
        ? operations.map((operation) =>
            operation.status === "committed" &&
            operation.requiredKeys.includes(key)
              ? { ...operation, reconciliationFailed: true }
              : operation,
          )
        : operations.filter(
            (operation) =>
              operation.status !== "committed" ||
              operation.requiredKeys.some(
                (requiredKey) => !operation.confirmedKeys.includes(requiredKey),
              ),
          );
    if (
      nextOperations.length !== operations.length ||
      event.action.type === "error"
    ) {
      storeOperations(queryClient, userId, nextOperations);
    }
  });
}

export function isOptimisticExpenseId(id: string) {
  return id.startsWith(OPTIMISTIC_EXPENSE_ID_PREFIX);
}

export function useHouseholdExpenseBalancePending(
  userId: string,
  groupId: string,
) {
  const query = useQuery({
    queryKey: operationKey(userId),
    queryFn: async () => [] as PendingExpenseOperation[],
    enabled: false,
    initialData: [] as PendingExpenseOperation[],
    staleTime: Infinity,
  });

  const relevantOperation = query.data.find(
    (operation) =>
      operation.before?.sharedSpaceId === groupId ||
      operation.after?.sharedSpaceId === groupId,
  );
  if (!relevantOperation) return null;
  return relevantOperation.reconciliationFailed ? "error" : "pending";
}

function pendingOperations(
  queryClient: QueryClient,
  userId: string,
): PendingExpenseOperation[] {
  return queryClient.getQueryData<PendingExpenseOperation[]>(operationKey(userId)) ?? [];
}

function storeOperations(
  queryClient: QueryClient,
  userId: string,
  operations: PendingExpenseOperation[],
) {
  queryClient.setQueryData(operationKey(userId), operations);
}

function noticeKey(userId: string) {
  return appDataQueryKeys.expenseMutationNotices(userId);
}

function noticesFor(
  queryClient: QueryClient,
  userId: string,
): ExpenseMutationNotice[] {
  return queryClient.getQueryData<ExpenseMutationNotice[]>(noticeKey(userId)) ?? [];
}

function storeNotices(
  queryClient: QueryClient,
  userId: string,
  notices: ExpenseMutationNotice[],
) {
  queryClient.setQueryData(noticeKey(userId), notices);
}

function publishNotice(
  queryClient: QueryClient,
  userId: string,
  notice: ExpenseMutationNotice,
) {
  storeNotices(queryClient, userId, [...noticesFor(queryClient, userId), notice]);
}

export function dismissExpenseMutationNotice(
  queryClient: QueryClient,
  userId: string,
  noticeId: string,
) {
  storeNotices(
    queryClient,
    userId,
    noticesFor(queryClient, userId).filter((notice) => notice.id !== noticeId),
  );
}

export function recoverExpenseMutation(
  queryClient: QueryClient,
  userId: string,
  noticeId: string,
) {
  const notice = noticesFor(queryClient, userId).find(
    (candidate) => candidate.id === noticeId,
  );
  if (!notice?.recovery) return null;
  queryClient.setQueryData(
    appDataQueryKeys.expenseMutationRecovery(userId),
    notice.recovery,
  );
  dismissExpenseMutationNotice(queryClient, userId, noticeId);
  return notice.recovery;
}

export function useExpenseMutationRecovery(userId: string) {
  return useQuery<ExpenseMutationRecovery | null>({
    queryKey: appDataQueryKeys.expenseMutationRecovery(userId),
    queryFn: async () => null,
    enabled: false,
    initialData: null,
    staleTime: Infinity,
  });
}

export function clearExpenseMutationRecovery(
  queryClient: QueryClient,
  userId: string,
) {
  queryClient.setQueryData(
    appDataQueryKeys.expenseMutationRecovery(userId),
    null,
  );
}

function changedQueryKeys(
  userId: string,
  change: ExpenseChange,
): QueryKey[] {
  const months = new Set(
    [change.before?.expenseDate, change.after?.expenseDate]
      .filter((date): date is string => Boolean(date))
      .map((date) => date.slice(0, 7)),
  );
  const keys: QueryKey[] = [...months].map((month) =>
    appDataQueryKeys.expenseMonth(userId, month),
  );
  if (
    [change.before, change.after].some(
      (expense) => expense?.sharedSpaceName === "Casa",
    )
  ) {
    keys.push(appDataQueryKeys.household(userId));
  }
  return keys;
}

function expenseId(change: ExpenseChange) {
  return change.after?.id ?? change.before?.id;
}

function groupExpenseFromCache(
  queryClient: QueryClient,
  userId: string,
  id: string | undefined,
): GroupExpenseView | null {
  if (!id) return null;
  const data = queryClient.getQueryData<HouseholdPageData>(
    appDataQueryKeys.household(userId),
  );
  return data?.overview?.expenses.find((expense) => expense.id === id) ?? null;
}

function sameExpense(
  left: PersonalExpenseView | GroupExpenseView,
  right: PersonalExpenseView,
) {
  return (
    left.id === right.id &&
    left.amountCents === right.amountCents &&
    left.description === right.description &&
    left.categoryId === right.categoryId &&
    left.expenseDate === right.expenseDate &&
    left.sharedSpaceId === right.sharedSpaceId
  );
}

function insertPersonalExpense(
  expenses: PersonalExpenseView[],
  expense: PersonalExpenseView,
  preferredIndex?: number,
) {
  const index =
    preferredIndex !== undefined
      ? Math.min(preferredIndex, expenses.length)
      : expenses.findIndex(
          (existing) => existing.expenseDate <= expense.expenseDate,
        );
  const next = [...expenses];
  next.splice(index < 0 ? next.length : index, 0, expense);
  return next;
}

function sortGroupExpenses(expenses: GroupExpenseView[]) {
  return [...expenses].sort(
    (left, right) =>
      right.expenseDate.localeCompare(left.expenseDate) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

function personalForMonth(
  data: ExpensePageData,
  month: string,
  operation: PendingExpenseOperation,
  rollback: boolean,
  hasLaterOperation: boolean,
): ExpensePageData {
  const { before, after, kind } = operation;
  const currentId = expenseId(operation);
  if (!currentId) return data;

  let expenses = data.expenses;
  if (rollback) {
    if (hasLaterOperation) return data;
    const current = expenses.find((expense) => expense.id === currentId);
    if (kind === "create") {
      expenses = expenses.filter((expense) => expense.id !== currentId);
    } else if (kind === "delete") {
      if (!current && before?.expenseDate.slice(0, 7) === month) {
        expenses = insertPersonalExpense(expenses, before);
      }
    } else if (after && before) {
      if (current && sameExpense(current, after)) {
        const currentIndex = expenses.indexOf(current);
        expenses = expenses.filter((expense) => expense.id !== currentId);
        if (before.expenseDate.slice(0, 7) === month) {
          expenses = insertPersonalExpense(
            expenses,
            before,
            current.expenseDate === before.expenseDate
              ? currentIndex
              : undefined,
          );
        }
      } else if (!current && before.expenseDate.slice(0, 7) === month) {
        expenses = insertPersonalExpense(expenses, before);
      } else {
        return data;
      }
    } else {
      return data;
    }
  } else {
    const current = expenses.find((expense) => expense.id === currentId);
    const currentIndex = current ? expenses.indexOf(current) : undefined;
    expenses = expenses.filter((expense) => expense.id !== currentId);
    if (after?.expenseDate.slice(0, 7) === month) {
      expenses = insertPersonalExpense(
        expenses,
        after,
        current?.expenseDate === after.expenseDate ? currentIndex : undefined,
      );
    }
  }

  return {
    ...data,
    expenses,
    monthlyTotal: expenses
      .reduce((total, expense) => total + BigInt(expense.amountCents), 0n)
      .toString(),
  };
}

function householdForOperation(
  data: HouseholdPageData,
  operation: PendingExpenseOperation,
  rollback: boolean,
  hasLaterOperation: boolean,
): HouseholdPageData {
  const expenses = data.overview?.expenses;
  const spaceId = data.space?.id;
  const id = expenseId(operation);
  if (!expenses || !spaceId || !id) return data;

  const { before, after, groupBefore, groupAfter, kind } = operation;
  const current = expenses.find((expense) => expense.id === id);
  let nextExpenses = expenses;

  if (rollback) {
    if (hasLaterOperation) return data;
    if (kind === "create") {
      nextExpenses = expenses.filter((expense) => expense.id !== id);
    } else if (kind === "delete") {
      if (!current && groupBefore?.sharedSpaceId === spaceId) {
        nextExpenses = [...expenses, groupBefore];
      }
    } else if (after && before) {
      if (current && sameExpense(current, after)) {
        nextExpenses = expenses.filter((expense) => expense.id !== id);
        if (before.sharedSpaceId === spaceId) {
          nextExpenses = [
            ...nextExpenses,
            {
              ...current,
              ...before,
              ...(groupBefore
                ? {
                    payerUserId: groupBefore.payerUserId,
                    payerName: groupBefore.payerName,
                    createdAt: groupBefore.createdAt,
                  }
                : {}),
            },
          ];
        }
      } else if (!current && before.sharedSpaceId === spaceId && groupBefore) {
        nextExpenses = [...expenses, groupBefore];
      } else {
        return data;
      }
    } else {
      return data;
    }
  } else {
    nextExpenses = expenses.filter((expense) => expense.id !== id);
    if (after?.sharedSpaceId === spaceId) {
      const cachedGroupExpense = current ?? groupAfter;
      if (cachedGroupExpense) {
        nextExpenses = [
          ...nextExpenses,
          {
            ...cachedGroupExpense,
            ...after,
            ...(groupAfter
              ? {
                  payerUserId: groupAfter.payerUserId,
                  payerName: groupAfter.payerName,
                }
              : {}),
          },
        ];
      }
    }
  }

  return {
    ...data,
    overview: {
      ...data.overview!,
      expenses: sortGroupExpenses(nextExpenses),
    },
  };
}

function applyOperation(
  queryClient: QueryClient,
  queryKey: QueryKey,
  data: ExpensePageData | HouseholdPageData,
  operation: PendingExpenseOperation,
  rollback = false,
) {
  const operations = pendingOperations(queryClient, operation.userId);
  const currentIndex = operations.findIndex(
    (candidate) => candidate.operationId === operation.operationId,
  );
  const hasLaterOperation =
    currentIndex >= 0 &&
    operations.slice(currentIndex + 1).some(
      (candidate) => expenseId(candidate) === expenseId(operation),
    );
  if (
    queryKey[2] === "expenses" &&
    typeof queryKey[3] === "string" &&
    "expenses" in data
  ) {
    return personalForMonth(
      data,
      queryKey[3],
      operation,
      rollback,
      hasLaterOperation,
    );
  }
  if (queryKey[2] === "household" && "overview" in data) {
    return householdForOperation(data, operation, rollback, hasLaterOperation);
  }
  return data;
}

function updateCachedQueries(
  queryClient: QueryClient,
  operation: PendingExpenseOperation,
  rollback = false,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<
    ExpensePageData | HouseholdPageData
  >({ queryKey: appDataQueryKeys.privateRoot(operation.userId) })) {
    if (!data) continue;
    const next = applyOperation(queryClient, queryKey, data, operation, rollback);
    if (next !== data) queryClient.setQueryData(queryKey, next);
  }
}

function replayPendingOperations(
  queryClient: QueryClient,
  userId: string,
) {
  const operations = pendingOperations(queryClient, userId);
  for (const [queryKey, data] of queryClient.getQueriesData<
    ExpensePageData | HouseholdPageData
  >({ queryKey: appDataQueryKeys.privateRoot(userId) })) {
    if (!data) continue;
    let next = data;
    for (const operation of operations) {
      next = applyOperation(queryClient, queryKey, next, operation);
    }
    if (next !== data) queryClient.setQueryData(queryKey, next);
  }
}

export async function beginOptimisticExpenseChange(
  queryClient: QueryClient,
  userId: string,
  change: ExpenseChange,
) {
  const operation: PendingExpenseOperation = {
    ...change,
    operationId: `${OPTIMISTIC_EXPENSE_ID_PREFIX}${crypto.randomUUID()}`,
    userId,
    groupBefore: groupExpenseFromCache(queryClient, userId, expenseId(change)),
    status: "pending",
    requiredKeys: [],
    confirmedKeys: [],
  };
  subscribeToExpenseReconciliation(queryClient);
  storeOperations(queryClient, userId, [
    ...pendingOperations(queryClient, userId),
    operation,
  ]);
  await Promise.all([
    queryClient.cancelQueries({
      queryKey: appDataQueryKeys.expenses(userId),
    }),
    queryClient.cancelQueries({
      queryKey: appDataQueryKeys.household(userId),
    }),
  ]);
  replayPendingOperations(queryClient, userId);
  return operation;
}

function replaceOptimisticId(
  queryClient: QueryClient,
  operation: PendingExpenseOperation,
  persistedId: string,
) {
  const temporaryId = operation.after?.id;
  if (!temporaryId || temporaryId === persistedId) return;
  for (const [queryKey, data] of queryClient.getQueriesData<
    ExpensePageData | HouseholdPageData
  >({ queryKey: appDataQueryKeys.privateRoot(operation.userId) })) {
    if (!data) continue;
    if (queryKey[2] === "expenses" && "expenses" in data) {
      queryClient.setQueryData(queryKey, {
        ...data,
        expenses: data.expenses.map((expense) =>
          expense.id === temporaryId
            ? { ...expense, id: persistedId }
            : expense,
        ),
      });
    } else if (queryKey[2] === "household" && "overview" in data && data.overview) {
      queryClient.setQueryData(queryKey, {
        ...data,
        overview: {
          ...data.overview,
          expenses: data.overview.expenses.map((expense) =>
            expense.id === temporaryId
              ? { ...expense, id: persistedId }
              : expense,
          ),
        },
      });
    }
  }
}

function keyForQuery(queryKey: QueryKey) {
  return JSON.stringify(queryKey);
}

function reflectedInPersonalMonth(
  data: ExpensePageData,
  month: string,
  operation: PendingExpenseOperation,
) {
  const expected =
    operation.after?.expenseDate.slice(0, 7) === month
      ? operation.after
      : null;
  const current = data.expenses.find(
    (expense) => expense.id === (operation.after?.id ?? operation.before?.id),
  );
  return expected ? Boolean(current && sameExpense(current, expected)) : !current;
}

function reflectedInHousehold(
  data: HouseholdPageData,
  operation: PendingExpenseOperation,
) {
  const spaceId = data.space?.id;
  const id = operation.after?.id ?? operation.before?.id;
  if (!spaceId || !id) return true;
  const targetsCurrentHousehold =
    operation.before?.sharedSpaceId === spaceId ||
    operation.after?.sharedSpaceId === spaceId;
  if (!targetsCurrentHousehold) return true;
  const expected =
    operation.after?.sharedSpaceId === spaceId ? operation.after : null;
  const current = data.overview?.expenses.find((expense) => expense.id === id);
  return expected ? Boolean(current && sameExpense(current, expected)) : !current;
}

function operationIsReflected(
  queryKey: QueryKey,
  data: ExpensePageData | HouseholdPageData,
  operation: PendingExpenseOperation,
) {
  if (
    queryKey[2] === "expenses" &&
    typeof queryKey[3] === "string" &&
    "expenses" in data
  ) {
    return reflectedInPersonalMonth(data, queryKey[3], operation);
  }
  if (queryKey[2] === "household" && "overview" in data) {
    return reflectedInHousehold(data, operation);
  }
  return false;
}

export function applyPendingExpenseChanges<T extends ExpensePageData | HouseholdPageData>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  data: T,
): T {
  const userId = typeof queryKey[1] === "string" ? queryKey[1] : "";
  const key = keyForQuery(queryKey);
  const operations = pendingOperations(queryClient, userId);
  let result: ExpensePageData | HouseholdPageData = data;
  const confirmed = new Map<string, string[]>();

  for (const [index, operation] of operations.entries()) {
    result = applyOperation(queryClient, queryKey, result, operation);
    if (operation.status !== "committed" || !operation.requiredKeys.includes(key)) {
      continue;
    }
    const reflected =
      operationIsReflected(queryKey, data, operation) ||
      operations
        .slice(index + 1)
        .some(
          (laterOperation) =>
            laterOperation.status === "committed" &&
            expenseId(laterOperation) === expenseId(operation) &&
            operationIsReflected(queryKey, data, laterOperation),
        );
    if (reflected) confirmed.set(operation.operationId, operation.confirmedKeys);
  }

  if (confirmed.size > 0) {
    storeOperations(
      queryClient,
      userId,
      operations
        .map((operation) => {
          const confirmedKeys = confirmed.get(operation.operationId);
          if (!confirmedKeys) return operation;
          return {
            ...operation,
            confirmedKeys: [...new Set([...confirmedKeys, key])],
          };
        }),
    );
  }

  return result as T;
}

async function commitExpenseChange(
  queryClient: QueryClient,
  operation: PendingExpenseOperation,
  persistedId: string,
) {
  await Promise.all(
    changedQueryKeys(operation.userId, operation).map((queryKey) =>
      queryClient.cancelQueries({ queryKey, exact: true }),
    ),
  );
  replaceOptimisticId(queryClient, operation, persistedId);
  const committedOperation: PendingExpenseOperation = {
    ...operation,
    after: operation.after
      ? { ...operation.after, id: persistedId }
      : null,
    groupAfter: operation.groupAfter
      ? { ...operation.groupAfter, id: persistedId }
      : null,
    status: "committed",
    requiredKeys: changedQueryKeys(operation.userId, operation).map(
      keyForQuery,
    ),
    confirmedKeys: [],
  };
  const operations = pendingOperations(queryClient, operation.userId);
  const operationIndex = operations.findIndex(
    (current) => current.operationId === operation.operationId,
  );
  const nextSameExpense = operations
    .slice(operationIndex + 1)
    .find((current) => expenseId(current) === expenseId(operation));
  storeOperations(
    queryClient,
    operation.userId,
    operations.map((current) => {
      if (current.operationId === operation.operationId) {
        return committedOperation;
      }
      if (nextSameExpense?.operationId === current.operationId) {
        return {
          ...current,
          before: operation.after,
          groupBefore: operation.groupAfter,
        };
      }
      return current;
    }),
  );
  if (!nextSameExpense) updateCachedQueries(queryClient, committedOperation);
  for (const queryKey of changedQueryKeys(operation.userId, operation)) {
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }
}

async function rollbackExpenseChange(
  queryClient: QueryClient,
  operation: PendingExpenseOperation,
) {
  const keys = changedQueryKeys(operation.userId, operation);
  await Promise.all(
    keys.map((queryKey) =>
      queryClient.cancelQueries({ queryKey, exact: true }),
    ),
  );
  const operations = pendingOperations(queryClient, operation.userId);
  const operationIndex = operations.findIndex(
    (current) => current.operationId === operation.operationId,
  );
  const nextSameExpense = operations
    .slice(operationIndex + 1)
    .find((current) => expenseId(current) === expenseId(operation));
  updateCachedQueries(queryClient, operation, true);
  storeOperations(
    queryClient,
    operation.userId,
    operations
      .filter((current) => current.operationId !== operation.operationId)
      .map((current) =>
        nextSameExpense?.operationId === current.operationId
          ? {
              ...current,
              before: operation.before,
              groupBefore: operation.groupBefore,
            }
          : current,
      ),
  );
  for (const queryKey of keys) {
    void queryClient.invalidateQueries({ queryKey, exact: true });
  }
}

async function serializeExpenseMutation<T>(
  userId: string,
  expenseId: string,
  run: () => Promise<T>,
): Promise<T> {
  const queueKey = `${userId}:${expenseId}`;
  const previous = mutationQueues.get(queueKey) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(run);
  mutationQueues.set(queueKey, current);
  try {
    return await current;
  } finally {
    if (mutationQueues.get(queueKey) === current) mutationQueues.delete(queueKey);
  }
}

export async function runOptimisticExpenseChange<T extends { id: string }>(
  queryClient: QueryClient,
  userId: string,
  change: ExpenseChange,
  action: () => Promise<ActionResult<T>>,
  options?: { recovery: ExpenseMutationRecovery },
): Promise<ActionResult<T>> {
  if (change.before && isOptimisticExpenseId(change.before.id)) {
    return {
      success: false,
      error: "Este gasto todavía se está guardando. Esperá a que termine para editarlo.",
    };
  }

  const operationPromise = beginOptimisticExpenseChange(
    queryClient,
    userId,
    change,
  );
  const operationId = change.before?.id ?? change.after?.id;
  const run = async () => {
    let operation = await operationPromise;
    if (operationId && change.kind !== "create") {
      operation =
        pendingOperations(queryClient, userId).find(
          (current) => current.operationId === operation.operationId,
        ) ?? operation;
    }
    let result: ActionResult<T>;
    try {
      result = await action();
    } catch {
      result = {
        success: false,
        error: "No se pudo conectar con el servidor. Revisá tu conexión e intentá otra vez.",
      };
    }
    if (result.success) {
      await commitExpenseChange(queryClient, operation, result.data.id);
      publishNotice(queryClient, userId, {
        id: `${operation.operationId}:success`,
        type: "success",
        title:
          operation.kind === "create"
            ? "Gasto guardado"
            : operation.kind === "update"
              ? "Gasto actualizado"
              : "Gasto eliminado",
      });
    } else {
      await rollbackExpenseChange(queryClient, operation);
      publishNotice(queryClient, userId, {
        id: `${operation.operationId}:error`,
        type: "error",
        title:
          operation.kind === "create"
            ? "No se pudo guardar el gasto"
            : operation.kind === "update"
              ? "No se pudo actualizar el gasto"
              : "No se pudo eliminar el gasto",
        description: result.error,
        recovery: options?.recovery
          ? {
              ...options.recovery,
              kind: operation.kind,
              before: operation.before,
              groupBefore: operation.groupBefore,
            }
          : undefined,
      });
    }
    return result;
  };

  if (!operationId || change.kind === "create") return run();
  return serializeExpenseMutation(userId, operationId, run);
}
