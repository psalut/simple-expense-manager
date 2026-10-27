import { ExpensesPageClient } from "@/components/expenses/expenses-page-client";
import {
  currentDateInBuenosAires,
  normalizeExpenseMonth,
} from "@/lib/expenses/format";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const today = currentDateInBuenosAires();
  const month = normalizeExpenseMonth(params.month, today);
  return <ExpensesPageClient month={month} today={today} />;
}
