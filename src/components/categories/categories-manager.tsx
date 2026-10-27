"use client";

import { CategoryCatalog } from "@/components/categories/category-catalog";
import type { CategoryView } from "@/lib/categories/types";
import type { AuthenticatedUserProfile } from "@/lib/server/authenticated-user";

type Props = {
  categories: CategoryView[];
  replacementCategories: CategoryView[];
  account: Pick<AuthenticatedUserProfile, "name" | "email">;
};

export function CategoriesManager({
  categories,
  replacementCategories,
  account,
}: Props) {
  return (
    <CategoryCatalog
      account={account}
      categories={categories}
      replacementCategories={replacementCategories}
    />
  );
}
