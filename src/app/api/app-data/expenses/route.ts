import { getHouseholdForUser } from "@/lib/server/household";
import { listCategories } from "@/lib/server/categories";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getPersonalExpenseMonth } from "@/lib/server/expenses";
import { currentDateInBuenosAires, normalizeExpenseMonth, shiftMonth } from "@/lib/expenses/format";
import { privateAppDataRoute } from "@/lib/server/app-data-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const today = currentDateInBuenosAires();
  const month = normalizeExpenseMonth(url.searchParams.get("month") ?? undefined, today);
  const nextMonth = shiftMonth(month, 1);

  return privateAppDataRoute("expenses", async () => {
    const account = await getAuthenticatedUserProfile();
    const [monthData, categories, household] = await Promise.all([
      getPersonalExpenseMonth(account.id, month + "-01", nextMonth + "-01"),
      listCategories(),
      getHouseholdForUser(account.id),
    ]);

    return {
      expenses: monthData.expenses,
      monthlyTotal: monthData.monthlyTotal,
      categories,
      groups: household.space ? [household.space] : [],
    };
  });
}
