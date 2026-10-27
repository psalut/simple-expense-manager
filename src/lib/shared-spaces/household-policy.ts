type Space = { id: string; name: string };

// A name alone never selects one household out of several historical groups.
export function resolveHouseholdId(spaces: readonly Space[], configuredId?: string): string | null {
  if (configuredId) {
    return spaces.some((space) => space.id === configuredId && space.name === "Casa")
      ? configuredId : null;
  }
  return spaces.length === 1 && spaces[0].name === "Casa" ? spaces[0].id : null;
}

export function canUseHousehold(
  householdId: string | null,
  requestedId: string,
  members: readonly string[],
  userId: string,
  requireComplete = true,
): boolean {
  return householdId === requestedId && members.includes(userId) &&
    (requireComplete ? members.length === 2 : members.length === 1);
}
