"use client";

import { ExpensesList } from "@/components/expenses/expenses-list";
import { ExpensesDataLoading, QueryUnavailable, StaleDataNotice } from "@/components/app-data/query-feedback";
import { useAppUser } from "@/components/app-query-provider";
import { useExpensePageData } from "@/lib/app-data/client";

export function ExpensesPageClient({ month, today }: { month: string; today: string }) {
  const user = useAppUser();
  const query = useExpensePageData(month);

  if (!query.data) {
    if (query.isError) {
      return <QueryUnavailable onRetry={() => void query.refetch()} />;
    }
    return <ExpensesDataLoading />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-3 sm:px-6 sm:pb-12 sm:pt-10">
      {query.isError && <StaleDataNotice />}
      <ExpensesList
        expenses={query.data.expenses}
        incomes={query.data.incomes}
        categories={query.data.categories}
        groups={query.data.groups}
        currentUserId={user.id}
        account={user}
        month={month}
        monthlyTotal={query.data.monthlyTotal}
        today={today}
      />
    </main>
  );
}
