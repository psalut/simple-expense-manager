import { HouseholdPageClient } from "@/components/groups/household-page-client";
import {
  currentDateInBuenosAires,
  normalizeExpenseMonth,
} from "@/lib/expenses/format";

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const today = currentDateInBuenosAires();
  const month = normalizeExpenseMonth(params.month, today);

  return <HouseholdPageClient month={month} today={today} />;
}
