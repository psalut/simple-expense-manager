import { listCategories } from "@/lib/server/categories";
import { getAuthenticatedUserProfile } from "@/lib/server/authenticated-user";
import { privateAppDataRoute } from "@/lib/server/app-data-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  return privateAppDataRoute("categories", async () => {
    await getAuthenticatedUserProfile();
    const categories = await listCategories(includeArchived);
    return includeArchived
      ? categories.filter((category) => category.isArchived)
      : categories;
  });
}
