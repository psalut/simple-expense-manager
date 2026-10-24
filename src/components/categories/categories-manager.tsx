"use client";

import Link from "next/link";
import { ChevronRight, UsersRound } from "lucide-react";
import { CategoryCatalog } from "@/components/categories/category-catalog";
import type { CategoryView } from "@/lib/categories/types";

type GroupCatalogLink = {
  id: string;
  displayName: string;
};

type Props = {
  categories: CategoryView[];
  groups: GroupCatalogLink[];
};

export function CategoriesManager({ categories, groups }: Props) {
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
        <p className="text-sm text-muted-foreground">
          Administrá tus categorías personales y abrí el catálogo de cada grupo.
        </p>
      </header>

      <CategoryCatalog
        title="Mis categorías"
        description="Solo vos podés verlas y administrarlas."
        categories={categories}
        sharedSpaceId={null}
      />

      <section aria-labelledby="group-catalogs-title" className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 id="group-catalogs-title" className="text-xl font-semibold tracking-tight">
            Categorías de mis grupos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada grupo tiene su propio catálogo.
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl bg-muted/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Cuando tengas un grupo, su catálogo va a aparecer acá.
            </p>
            <Link
              href="/groups"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              Ver grupos
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={"/groups/" + group.id + "/categories"}
                  aria-label={"Abrir categorías de " + group.displayName}
                  className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <UsersRound size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{group.displayName}</span>
                  </span>
                  <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
