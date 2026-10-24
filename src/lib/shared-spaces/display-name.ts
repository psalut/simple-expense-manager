import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

export function getSharedSpaceDisplayName(
  space: Pick<SharedSpaceOverview, "id" | "name">,
  spaces: Pick<SharedSpaceOverview, "id" | "name">[],
) {
  const normalizedName = space.name.trim().toLocaleLowerCase("es-AR");
  const hasDuplicateName = spaces.some(
    (other) =>
      other.id !== space.id &&
      other.name.trim().toLocaleLowerCase("es-AR") === normalizedName,
  );

  return hasDuplicateName ? `${space.name} · ${space.id.slice(0, 6)}` : space.name;
}
