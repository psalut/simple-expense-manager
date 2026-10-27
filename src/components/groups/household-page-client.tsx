"use client";

import Link from "next/link";
import { GroupDetail } from "@/components/groups/group-detail";
import { HouseholdOnboarding } from "@/components/groups/household-onboarding";
import { SectionHeading } from "@/components/navigation/section-heading";
import { HouseholdDataLoading, QueryUnavailable, StaleDataNotice } from "@/components/app-data/query-feedback";
import { useAppUser } from "@/components/app-query-provider";
import { useHouseholdPageData } from "@/lib/app-data/client";

export function HouseholdPageClient({
  month,
  today,
}: {
  month: string;
  today: string;
}) {
  const account = useAppUser();
  const query = useHouseholdPageData();

  if (!query.data) {
    if (query.isError) {
      return <QueryUnavailable onRetry={() => void query.refetch()} />;
    }
    return <HouseholdDataLoading />;
  }

  const { household, space, legacy, overview, categories } = query.data;
  return (
    <main className="household-page-main mx-auto w-full max-w-3xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-10">
      {query.isError && <StaleDataNotice />}
      {space && overview ? (
        <GroupDetail
          space={space}
          displayName="Casa"
          currentUserId={account.id}
          groups={[space]}
          categories={categories}
          expenses={overview.expenses}
          balances={overview.balances}
          month={month}
          today={today}
          account={account}
        />
      ) : (
        <>
          <SectionHeading title="Casa" account={account} />
          <HouseholdOnboarding empty={household.empty} canJoin={household.canJoin} />
        </>
      )}
      {legacy.length > 0 && (
        <details className="border-t border-border pt-4">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">Historial anterior a Casa</summary>
          <p className="my-2 text-sm text-muted-foreground">
            Estos grupos conservan sus gastos y balances hasta que el propietario complete la transición. No se agregarán gastos nuevos.
          </p>
          <ul>
            {legacy.map((item) => (
              <li key={item.id}>
                <Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={"/groups/" + encodeURIComponent(item.id)}>
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
