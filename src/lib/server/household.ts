import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sharedSpaces, sharedSpaceMembers } from "@/db/shared-space-schema";
import { user } from "@/db/auth-schema";
import { resolveHouseholdId } from "@/lib/shared-spaces/household-policy";

export type HouseholdTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function resolveHousehold(connection: HouseholdTransaction | typeof db = db) {
  const spaces = await connection.select({ id: sharedSpaces.id, name: sharedSpaces.name }).from(sharedSpaces);
  return { id: resolveHouseholdId(spaces, process.env.HOUSEHOLD_SPACE_ID?.trim()), empty: spaces.length === 0 };
}

export async function getHouseholdForUser(userId: string) {
  const household = await resolveHousehold();
  if (!household.id) return { ...household, space: null, canJoin: false };
  const memberships = await db.select({ userId: sharedSpaceMembers.userId })
    .from(sharedSpaceMembers).where(eq(sharedSpaceMembers.sharedSpaceId, household.id));
  if (!memberships.some((member) => member.userId === userId)) {
    return { id: null, empty: false, space: null, canJoin: memberships.length === 1 };
  }
  const members = await db.select({ userId: user.id, name: user.name }).from(sharedSpaceMembers)
    .innerJoin(user, eq(sharedSpaceMembers.userId, user.id))
    .where(eq(sharedSpaceMembers.sharedSpaceId, household.id));
  return { ...household, space: { id: household.id, name: "Casa", members }, canJoin: false };
}

export function isRegistrationClosed() {
  return process.env.AUTH_REGISTRATION_CLOSED === "true";
}

// Enforced for existing sessions as well as newly created sessions.
export async function isAccountAllowed(userId: string) {
  if (!isRegistrationClosed()) return true;
  const household = await getHouseholdForUser(userId);
  return household.space?.members.length === 2;
}
