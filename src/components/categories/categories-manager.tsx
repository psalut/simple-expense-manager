"use client";

import { CategoryCatalog } from "@/components/categories/category-catalog";
import { SectionHeading } from "@/components/navigation/section-heading";
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
    <div className="space-y-6">
      <SectionHeading
        title="Categorías"
        account={account}
      />

      <CategoryCatalog
        title="Catálogo global"
        description="Elegí nombre, descripción y color para que las categorías sean fáciles de reconocer."
        categories={categories}
        replacementCategories={replacementCategories}
      />
    </div>
  );
}
