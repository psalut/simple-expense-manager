"use client";

import { CategoriesManager } from "@/components/categories/categories-manager";
import { CategoriesDataLoading, QueryUnavailable, StaleDataNotice } from "@/components/app-data/query-feedback";
import { useAppUser } from "@/components/app-query-provider";
import { useCategoriesData } from "@/lib/app-data/client";

export function CategoriesPageClient() {
  const user = useAppUser();
  const query = useCategoriesData();

  if (!query.data) {
    if (query.isError) {
      return <QueryUnavailable onRetry={() => void query.refetch()} />;
    }
    return <CategoriesDataLoading />;
  }

  const replacementCategories = query.data.filter((category) => !category.isArchived);
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      {query.isError && <StaleDataNotice />}
      <CategoriesManager
        categories={query.data}
        replacementCategories={replacementCategories}
        account={user}
      />
    </main>
  );
}
