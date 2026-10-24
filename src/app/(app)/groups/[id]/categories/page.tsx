import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryCatalog } from "@/components/categories/category-catalog";
import { getAuthenticatedUserId } from "@/lib/server/authenticated-user";
import {
  CategoryError,
  listCategoriesForSharedSpace,
} from "@/lib/server/categories";
import { getSharedSpaceSummariesForUser } from "@/lib/server/shared-spaces";
import { getSharedSpaceDisplayName } from "@/lib/shared-spaces/display-name";

export default async function GroupCategoriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, userId] = await Promise.all([
    params,
    getAuthenticatedUserId(),
  ]);
  const spaces = await getSharedSpaceSummariesForUser(userId);
  const space = spaces.find((candidate) => candidate.id === id);

  if (!space) notFound();

  let categories;
  try {
    categories = await listCategoriesForSharedSpace(userId, space.id);
  } catch (error) {
    if (error instanceof CategoryError) notFound();
    throw error;
  }

  const displayName = getSharedSpaceDisplayName(space, spaces);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link
        href={`/groups/${space.id}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a {displayName}
      </Link>

      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Catálogo del grupo</p>
        <h1 className="break-words text-3xl font-semibold tracking-tight">
          Categorías de {displayName}
        </h1>
      </header>

      <CategoryCatalog
        title="Categorías activas"
        categories={categories}
        sharedSpaceId={space.id}
        sharedSpaceName={displayName}
      />
    </main>
  );
}
