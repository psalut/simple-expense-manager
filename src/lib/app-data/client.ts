"use client";

import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import type { CategoryView } from "@/lib/categories/types";
import { AppDataRequestError } from "@/lib/app-data/errors";
import { appDataQueryKeys } from "@/lib/app-data/query-keys";
import type {
  CategoryTransport,
  ExpensePageData,
  ExpensePageTransport,
  HouseholdPageData,
  HouseholdPageTransport,
} from "@/lib/app-data/types";
import { useAppUser } from "@/components/app-query-provider";

export function useExpensePageData(month: string) {
  const user = useAppUser();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: appDataQueryKeys.expenseMonth(user.id, month),
    queryFn: ({ signal }) =>
      readPrivateData<ExpensePageTransport>(
        `/api/app-data/expenses?month=${encodeURIComponent(month)}`,
        signal,
        queryClient,
      ).then(hydrateExpensePageData),
    enabled: typeof window !== "undefined",
  });
}

export function useHouseholdPageData() {
  const user = useAppUser();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: appDataQueryKeys.household(user.id),
    queryFn: ({ signal }) =>
      readPrivateData<HouseholdPageTransport>(
        "/api/app-data/household",
        signal,
        queryClient,
      ).then(hydrateHouseholdPageData),
    enabled: typeof window !== "undefined",
    refetchOnMount: false,
    // Casa is forced fresh by the single pathname observer in the provider.
    // Mount/focus refetches remain stale-only everywhere else.
  });
}

export function useCategoriesData() {
  const user = useAppUser();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: appDataQueryKeys.categories(user.id),
    queryFn: ({ signal }) =>
      readPrivateData<CategoryTransport[]>(
        "/api/app-data/categories",
        signal,
        queryClient,
      ).then(hydrateCategories),
    enabled: typeof window !== "undefined",
  });
}

export function useArchivedCategoriesData(enabled: boolean) {
  const user = useAppUser();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: appDataQueryKeys.archivedCategories(user.id),
    queryFn: ({ signal }) =>
      readPrivateData<CategoryTransport[]>(
        "/api/app-data/categories?archived=1",
        signal,
        queryClient,
      ).then(hydrateCategories),
    enabled: enabled && typeof window !== "undefined",
  });
}

async function readPrivateData<T>(
  url: string,
  signal: AbortSignal,
  queryClient: QueryClient,
): Promise<T> {
  const response = await fetch(url, {
    signal,
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await queryClient.cancelQueries();
      queryClient.clear();
      if (typeof window !== "undefined") {
        window.location.replace(
          response.status === 401 ? "/login" : "/access-denied",
        );
      }
    }
    throw new AppDataRequestError(response.status);
  }

  return (await response.json()) as T;
}

function hydrateExpensePageData(data: ExpensePageTransport): ExpensePageData {
  return { ...data, categories: hydrateCategories(data.categories) };
}

function hydrateHouseholdPageData(data: HouseholdPageTransport): HouseholdPageData {
  return { ...data, categories: hydrateCategories(data.categories) };
}

function hydrateCategories(categories: CategoryTransport[]): CategoryView[] {
  return categories.map((category) => ({
    ...category,
    createdAt: new Date(category.createdAt),
    updatedAt: new Date(category.updatedAt),
  }));
}

export function getPrivateDataErrorMessage() {
  return "No se pudieron cargar los datos. Revisá la conexión e intentá nuevamente.";
}

