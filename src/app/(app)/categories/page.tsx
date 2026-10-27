import { CategoriesManager } from "@/components/categories/categories-manager";
import { listCategories } from "@/lib/server/categories";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";

export default async function CategoriesPage() {
  const user = await getAuthenticatedUserProfile();
  const categories = await listCategories();
  const replacementCategories = categories.filter(
    (category) => !category.isArchived,
  );

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <CategoriesManager
        categories={categories}
        replacementCategories={replacementCategories}
        account={user}
      />
    </main>
  );
}
