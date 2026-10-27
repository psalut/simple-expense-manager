import type { QueryClient } from "@tanstack/react-query";

const privateRoot = (userId: string) => ["private-app-data", userId] as const;

export const appDataQueryKeys = {
  privateRoot,
  expenses: (userId: string) => [...privateRoot(userId), "expenses"] as const,
  expenseMonth: (userId: string, month: string) =>
    [...privateRoot(userId), "expenses", month] as const,
  household: (userId: string) => [...privateRoot(userId), "household"] as const,
  categories: (userId: string) => [...privateRoot(userId), "categories"] as const,
  archivedCategories: (userId: string) =>
    [...privateRoot(userId), "categories", "archived"] as const,
};

export function isCasaEntry(previousPath: string | null, currentPath: string | null) {
  return currentPath === "/household" && previousPath !== currentPath;
}

export async function invalidateExpenseRelatedData(
  queryClient: QueryClient,
  userId: string,
) {
  const keys = [
    appDataQueryKeys.expenses(userId),
    appDataQueryKeys.household(userId),
  ];

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export async function invalidateAllPrivateAppData(
  queryClient: QueryClient,
  userId: string,
) {
  const queryKey = appDataQueryKeys.privateRoot(userId);
  return queryClient.invalidateQueries({ queryKey });
}

export async function invalidateHouseholdAndExpenses(
  queryClient: QueryClient,
  userId: string,
) {
  const keys = [
    appDataQueryKeys.expenses(userId),
    appDataQueryKeys.household(userId),
  ];

  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}
