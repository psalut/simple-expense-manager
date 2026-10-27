import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getGroupExpenseOverview } from "@/lib/server/expenses";
import { listCategories } from "@/lib/server/categories";
import { getHouseholdForUser } from "@/lib/server/household";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";
import { privateAppDataRoute } from "@/lib/server/app-data-response";

export const dynamic = "force-dynamic";

export async function GET() {
  return privateAppDataRoute("household", async () => {
    const account = await getAuthenticatedUserProfile();
    const [household, spaces] = await Promise.all([
      getHouseholdForUser(account.id),
      getSharedSpacesForUser(account.id),
    ]);
    const space = household.space;
    const [overview, categories] = space
      ? await Promise.all([
          getGroupExpenseOverview(account.id, space.id),
          listCategories(),
        ])
      : [null, []];

    return {
      household: { empty: household.empty, canJoin: household.canJoin },
      space,
      legacy: spaces.filter((item) => item.id !== household.id),
      overview,
      categories,
    };
  });
}
