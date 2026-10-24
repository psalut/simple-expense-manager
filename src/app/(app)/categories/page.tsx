import { CategoriesManager } from "@/components/categories/categories-manager";
import {
  listPersonalCategories,
} from "@/lib/server/categories";
import { getAuthenticatedUserId } from "@/lib/server/authenticated-user";
import { getSharedSpaceSummariesForUser } from "@/lib/server/shared-spaces";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";

export default async function CategoriesPage() {
  const userId = await getAuthenticatedUserId();
  const [categories, spaces] = await Promise.all([
    listPersonalCategories(userId),
    getSharedSpaceSummariesForUser(userId),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <CategoriesManager
        categories={categories}
        groups={spaces.map((space) => ({
          id: space.id,
          displayName: getSharedSpaceDisplayName(space, spaces),
        }))}
      />
    </main>
  );
}
