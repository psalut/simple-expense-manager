import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/auth-schema";
import {
  sharedSpaceInvitations,
  sharedSpaceMembers,
  sharedSpaces,
} from "@/db/shared-space-schema";
import {
  invitationAcceptanceError,
  MAX_SHARED_SPACE_MEMBERS,
} from "@/lib/shared-spaces/policy";
import type { SharedSpaceOverview } from "@/lib/shared-spaces/types";

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export class SharedSpaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedSpaceError";
  }
}

export async function getSharedSpaceIdsForUser(
  userId: string,
): Promise<string[]> {
  const memberships = await db
    .select({ sharedSpaceId: sharedSpaceMembers.sharedSpaceId })
    .from(sharedSpaceMembers)
    .where(eq(sharedSpaceMembers.userId, userId))
    .orderBy(asc(sharedSpaceMembers.sharedSpaceId));

  return memberships.map(({ sharedSpaceId }) => sharedSpaceId);
}

export async function isUserMemberOfSharedSpace(
  userId: string,
  sharedSpaceId: string,
): Promise<boolean> {
  const [membership] = await db
    .select({ userId: sharedSpaceMembers.userId })
    .from(sharedSpaceMembers)
    .where(
      and(
        eq(sharedSpaceMembers.userId, userId),
        eq(sharedSpaceMembers.sharedSpaceId, sharedSpaceId),
      ),
    )
    .limit(1);

  return membership !== undefined;
}

export async function getSharedSpacesForUser(
  userId: string,
): Promise<SharedSpaceOverview[]> {
  const spaces = await getSharedSpaceSummariesForUser(userId);

  if (spaces.length === 0) return [];

  const members = await db
    .select({
      sharedSpaceId: sharedSpaceMembers.sharedSpaceId,
      userId: sharedSpaceMembers.userId,
      name: user.name,
    })
    .from(sharedSpaceMembers)
    .innerJoin(user, eq(sharedSpaceMembers.userId, user.id))
    .where(
      inArray(
        sharedSpaceMembers.sharedSpaceId,
        spaces.map((space) => space.id),
      ),
    )
    .orderBy(asc(user.name), asc(user.id));

  const membersBySpaceId = new Map<string, SharedSpaceOverview["members"]>();
  for (const member of members) {
    const grouped = membersBySpaceId.get(member.sharedSpaceId) ?? [];
    grouped.push({ userId: member.userId, name: member.name });
    membersBySpaceId.set(member.sharedSpaceId, grouped);
  }

  return spaces.map((space) => ({
    ...space,
    members: membersBySpaceId.get(space.id) ?? [],
  }));
}

export async function getSharedSpaceSummariesForUser(
  userId: string,
): Promise<{ id: string; name: string }[]> {
  return db
    .select({
      id: sharedSpaces.id,
      name: sharedSpaces.name,
    })
    .from(sharedSpaceMembers)
    .innerJoin(
      sharedSpaces,
      eq(sharedSpaceMembers.sharedSpaceId, sharedSpaces.id),
    )
    .where(eq(sharedSpaceMembers.userId, userId))
    .orderBy(asc(sharedSpaces.name), asc(sharedSpaces.id));
}

export async function createSharedSpace(
  userId: string,
  rawName: unknown,
): Promise<void> {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  if (!name || name.length > 80) {
    throw new SharedSpaceError("El nombre del grupo debe tener entre 1 y 80 caracteres.");
  }

  await db.transaction(async (tx) => {
    const sharedSpaceId = randomUUID();
    await tx.insert(sharedSpaces).values({
      id: sharedSpaceId,
      name,
      createdBy: userId,
    });
    await tx.insert(sharedSpaceMembers).values({
      sharedSpaceId,
      userId,
    });
  });
}

export async function createSharedSpaceInvitation(
  userId: string,
  rawSharedSpaceId: unknown,
) {
  const sharedSpaceId =
    typeof rawSharedSpaceId === "string" ? rawSharedSpaceId.trim() : "";
  if (!sharedSpaceId || sharedSpaceId.length > 100) {
    throw new SharedSpaceError("Elegí un grupo válido para invitar a alguien.");
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

  await db.transaction(async (tx) => {
    const [membership] = await tx
      .select({
        sharedSpaceId: sharedSpaceMembers.sharedSpaceId,
        memberCount: sharedSpaces.memberCount,
      })
      .from(sharedSpaceMembers)
      .innerJoin(
        sharedSpaces,
        eq(sharedSpaceMembers.sharedSpaceId, sharedSpaces.id),
      )
      .where(
        and(
          eq(sharedSpaceMembers.userId, userId),
          eq(sharedSpaceMembers.sharedSpaceId, sharedSpaceId),
        ),
      )
      .for("update", { of: sharedSpaces })
      .limit(1);

    if (!membership) {
      throw new SharedSpaceError("No tenés acceso a ese grupo.");
    }
    if (membership.memberCount >= MAX_SHARED_SPACE_MEMBERS) {
      throw new SharedSpaceError("Este grupo ya tiene dos integrantes.");
    }

    await tx.insert(sharedSpaceInvitations).values({
      id: randomUUID(),
      sharedSpaceId,
      inviterUserId: userId,
      tokenHash,
      expiresAt,
    });
  });

  return { code: token, expiresAt: expiresAt.toISOString() };
}

export async function acceptSharedSpaceInvitation(
  userId: string,
  rawCode: unknown,
): Promise<void> {
  const code = typeof rawCode === "string" ? rawCode.trim() : "";
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(code)) {
    throw new SharedSpaceError("El código de invitación no es válido.");
  }

  const tokenHash = createHash("sha256").update(code).digest("hex");

  try {
    await db.transaction(async (tx) => {
      const [invitation] = await tx
        .select()
        .from(sharedSpaceInvitations)
        .where(eq(sharedSpaceInvitations.tokenHash, tokenHash))
        .for("update")
        .limit(1);

      if (!invitation) {
        throw new SharedSpaceError(
          "La invitación no existe, venció o ya fue utilizada.",
        );
      }

      const [space] = await tx
        .select({ id: sharedSpaces.id, memberCount: sharedSpaces.memberCount })
        .from(sharedSpaces)
        .where(eq(sharedSpaces.id, invitation.sharedSpaceId))
        .for("update")
        .limit(1);
      if (!space) {
        throw new SharedSpaceError("El espacio de la invitación ya no existe.");
      }

      const [existingMembership] = await tx
        .select({ sharedSpaceId: sharedSpaceMembers.sharedSpaceId })
        .from(sharedSpaceMembers)
        .where(
          and(
            eq(sharedSpaceMembers.userId, userId),
            eq(sharedSpaceMembers.sharedSpaceId, invitation.sharedSpaceId),
          ),
        )
        .limit(1);
      const rejection = invitationAcceptanceError(
        {
          acceptedAt: invitation.acceptedAt,
          expiresAt: invitation.expiresAt,
          userAlreadyMember: existingMembership !== undefined,
          memberCount: space.memberCount,
        },
        new Date(),
      );
      if (rejection) {
        throw new SharedSpaceError(rejection);
      }

      await tx.insert(sharedSpaceMembers).values({
        sharedSpaceId: invitation.sharedSpaceId,
        userId,
      });
      await tx
        .update(sharedSpaceInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(sharedSpaceInvitations.id, invitation.id));
    });
  } catch (error) {
    if (error instanceof SharedSpaceError) throw error;
    if (isMemberLimitViolation(error)) {
      throw new SharedSpaceError("Este grupo ya tiene dos integrantes.");
    }
    if (isDuplicateMembershipViolation(error)) {
      throw new SharedSpaceError("Ya formás parte de este grupo.");
    }
    throw error;
  }
}

function isDuplicateMembershipViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const record = current as {
      code?: unknown;
      constraint?: unknown;
      detail?: unknown;
      cause?: unknown;
    };
    if (
      record.code === "23505" &&
      (record.constraint === "shared_space_members_pkey" ||
        record.constraint === "shared_space_members_shared_space_id_user_id_pk" ||
        String(record.detail ?? "").includes("shared_space_members_pkey"))
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

function isMemberLimitViolation(error: unknown): boolean {
  let current: unknown = error;
  while (typeof current === "object" && current !== null) {
    const record = current as {
      code?: unknown;
      constraint?: unknown;
      cause?: unknown;
    };
    if (
      record.code === "23514" &&
      record.constraint === "shared_space_member_limit"
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}
