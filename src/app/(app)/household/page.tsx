import Link from "next/link";
import { GroupDetail } from "@/components/groups/group-detail";
import { HouseholdOnboarding } from "@/components/groups/household-onboarding";
import { SectionHeading } from "@/components/navigation/section-heading";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getHouseholdForUser } from "@/lib/server/household";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";
import { getGroupExpenseOverview } from "@/lib/server/expenses";
import { listCategories } from "@/lib/server/categories";
import { currentDateInBuenosAires } from "@/lib/expenses/format";

export default async function HouseholdPage() {
  const account = await getAuthenticatedUserProfile();
  const household = await getHouseholdForUser(account.id);
  const legacy = (await getSharedSpacesForUser(account.id)).filter((space) => space.id !== household.id);
  const space = household.space;
  const [overview, categories] = space ? await Promise.all([
    getGroupExpenseOverview(account.id, space.id), listCategories(),
  ]) : [null, []];
  return <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-4 sm:px-6 sm:py-10">
    {space && overview ? <GroupDetail space={space} displayName="Casa" currentUserId={account.id} groups={[space]} categories={categories} expenses={overview.expenses} balances={overview.balances} today={currentDateInBuenosAires()} account={account} /> : <>
      <SectionHeading title="Casa" account={account} />
      <HouseholdOnboarding empty={household.empty} canJoin={household.canJoin} />
    </>}
    {legacy.length > 0 && <details className="border-t border-border pt-4">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">Historial anterior a Casa</summary>
      <p className="my-2 text-sm text-muted-foreground">Estos grupos conservan sus gastos y balances hasta que el propietario complete la transición. No se agregarán gastos nuevos.</p>
      <ul>{legacy.map((item) => <li key={item.id}><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={"/groups/" + encodeURIComponent(item.id)}>{item.name}</Link></li>)}</ul>
    </details>}
  </main>;
}
