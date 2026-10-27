import { GroupsManager } from "@/components/groups/groups-manager";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";

export default async function GroupsPage() {
  const user = await getAuthenticatedUserProfile();
  const spaces = await getSharedSpacesForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-7 px-4 py-8 sm:px-6 sm:py-10">
      <GroupsManager spaces={spaces} account={user} />
    </main>
  );
}
