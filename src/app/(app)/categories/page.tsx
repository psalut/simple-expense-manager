import { CategoriesManager } from "@/components/categories/categories-manager";
import { SharedSpacePanel } from "@/components/categories/shared-space-panel";
import { listCategories } from "@/lib/server/categories";
import { getAuthenticatedUserId } from "@/lib/server/authenticated-user";
import { getSharedSpacesForUser } from "@/lib/server/shared-spaces";

export default async function CategoriesPage() {
  const userId = await getAuthenticatedUserId();
  const [categories, spaces] = await Promise.all([
    listCategories(userId),
    getSharedSpacesForUser(userId),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      <CategoriesManager
        categories={categories}
        spaces={spaces}
      />
      <SharedSpacePanel spaces={spaces} />
    </main>
  );
}
