import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { GroupExpenses } from "@/components/expenses/group-expenses";
import { SectionHeading } from "@/components/navigation/section-heading";
import { resolveHousehold } from "@/lib/server/household";
import { currentDateInBuenosAires } from "@/lib/expenses/format";
import { getGroupExpenseOverview } from "@/lib/server/expenses";
import { listCategories } from "@/lib/server/categories";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user] = await Promise.all([
    params,
    getAuthenticatedUserProfile(),
  ]);
  const userId = user.id;
  const spaces = await getSharedSpacesForUser(userId);
  const space = spaces.find((candidate) => candidate.id === id);

  if (!space) notFound();
  if ((await resolveHousehold()).id === id) redirect("/household");

  const [overview, categories] = await Promise.all([
    getGroupExpenseOverview(userId, id),
    listCategories(),
  ]);
  const groups = spaces.map((item) => ({
    id: item.id,
    name: getSharedSpaceDisplayName(item, spaces),
    members: item.members,
  }));

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href="/household"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a Casa
      </Link>
      <SectionHeading title={getSharedSpaceDisplayName(space, spaces)} account={user} />
      <p className="text-sm leading-6 text-muted-foreground">Historial anterior a Casa. Los gastos y balances se conservan; no se admiten nuevos gastos ni invitaciones.</p>
      <GroupExpenses
        groupId={space.id}
        groupName={space.name}
        currentUserId={userId}
        groups={groups.filter((group) => group.id === id)}
        allowCreate={false}
        categories={categories}
        expenses={overview.expenses}
        balances={overview.balances}
        today={currentDateInBuenosAires()}
        account={user}
      />
    </main>
  );
}
