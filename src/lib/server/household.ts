import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sharedSpaces, sharedSpaceMembers } from "@/db/shared-space-schema";
import { user } from "@/db/auth-schema";
import { resolveHouseholdId } from "@/lib/shared-spaces/household-policy";
import { measureServerWork } from "@/lib/server/performance";

export type HouseholdTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolveHousehold(connection: HouseholdTransaction | typeof db = db) {
  const spaces = await measureServerWork("db.household.resolve", () =>
    connection.select({ id: sharedSpaces.id, name: sharedSpaces.name }).from(sharedSpaces),
  );
  return { id: resolveHouseholdId(spaces, process.env.HOUSEHOLD_SPACE_ID?.trim()), empty: spaces.length === 0 };
}

export const getHouseholdForUser = cache(async (userId: string) => {
  const household = await resolveHousehold();
  if (!household.id) return { ...household, space: null, canJoin: false };
  const memberships = await measureServerWork("db.household.members", () =>
    db.select({ userId: sharedSpaceMembers.userId })
      .from(sharedSpaceMembers).where(eq(sharedSpaceMembers.sharedSpaceId, household.id!)),
  );
  if (!memberships.some((member) => member.userId === userId)) {
    return { id: null, empty: false, space: null, canJoin: memberships.length === 1 };
  }
  const members = await measureServerWork("db.household.member-profiles", () =>
    db.select({ userId: user.id, name: user.name }).from(sharedSpaceMembers)
      .innerJoin(user, eq(sharedSpaceMembers.userId, user.id))
      .where(eq(sharedSpaceMembers.sharedSpaceId, household.id!)),
  );
  return { ...household, space: { id: household.id, name: "Casa", members }, canJoin: false };
});

export function isRegistrationClosed() {
  return process.env.AUTH_REGISTRATION_CLOSED === "true";
}

// Enforced for existing sessions as well as newly created sessions.
export const isAccountAllowed = cache(async (userId: string) => {
  if (!isRegistrationClosed()) return true;
  const household = await getHouseholdForUser(userId);
  return household.space?.members.length === 2;
});
