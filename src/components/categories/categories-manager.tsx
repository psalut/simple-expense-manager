"use client";

import { CategoryCatalog } from "@/components/categories/category-catalog";
import type { CategoryView } from "@/lib/categories/types";

type Props = {
  categories: CategoryView[];
  replacementCategories: CategoryView[];
};

export function CategoriesManager({
  categories,
  replacementCategories,
}: Props) {
  return (
    <div className="space-y-7">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Un catálogo compartido por todas las cuentas. Los cambios se reflejan
          en los gastos existentes sin mostrar a quién pertenecen.
        </p>
      </header>

      <CategoryCatalog
        title="Catálogo global"
        description="Elegí nombre, descripción y color para que las categorías sean fáciles de reconocer."
        categories={categories}
        replacementCategories={replacementCategories}
      />
    </div>
  );
}
