import { GroupsManager } from "@/components/groups/groups-manager";
import { getAuthenticatedUserId } from "@/lib/server/authenticated-user";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";

export default async function GroupsPage() {
  const userId = await getAuthenticatedUserId();
  const spaces = await getSharedSpacesForUser(userId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <GroupsManager spaces={spaces} />
    </main>
  );
}
