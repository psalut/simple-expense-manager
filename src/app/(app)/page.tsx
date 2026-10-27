import { ExpensesList } from "@/components/expenses/expenses-list";
import { listCategories } from "@/lib/server/categories";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { listPersonalExpenses } from "@/lib/server/expenses";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";
import {
  currentDateInBuenosAires,
  normalizeExpenseMonth,
  shiftMonth,
} from "@/lib/expenses/format";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const [user, params] = await Promise.all([
    getAuthenticatedUserProfile(),
    searchParams,
  ]);
  const userId = user.id;
  const today = currentDateInBuenosAires();
  const month = normalizeExpenseMonth(params.month, today);
  const nextMonth = shiftMonth(month, 1);
  const [expenses, categories, spaces] = await Promise.all([
    listPersonalExpenses(userId, month + "-01", nextMonth + "-01"),
    listCategories(),
    getSharedSpacesForUser(userId),
  ]);
  const groups = spaces.map((space) => ({
    id: space.id,
    name: getSharedSpaceDisplayName(space, spaces),
    members: space.members,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-8 sm:px-6 sm:pb-12 sm:pt-10">
      <ExpensesList
        expenses={expenses}
        categories={categories}
        groups={groups}
        currentUserId={userId}
        account={user}
        month={month}
        today={today}
      />
    </main>
  );
}
