"use server";

import type { ActionResult } from "@/lib/action-result";
import {
  acceptSharedSpaceInvitation,
  createSharedSpace,
  createSharedSpaceInvitation,
  SharedSpaceError,
} from "@/lib/server/shared-spaces";
import {
  AuthenticationRequiredError,
  getAuthenticatedUserId,
} from "@/lib/server/authenticated-user";

export async function createSharedSpaceAction(
  name: unknown,
): Promise<ActionResult<null>> {
  return runAction(async (userId) => {
    await createSharedSpace(userId, name);
    return null;
  });
}

export async function createSharedSpaceInvitationAction(
  sharedSpaceId: unknown,
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  return runAction(async (userId) => {
    const invitation = await createSharedSpaceInvitation(userId, sharedSpaceId);
    return invitation;
  });
}

export async function acceptSharedSpaceInvitationAction(
  code: unknown,
): Promise<ActionResult<null>> {
  return runAction(async (userId) => {
    await acceptSharedSpaceInvitation(userId, code);
    return null;
  });
}

async function runAction<T>(
  operation: (userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const userId = await getAuthenticatedUserId();
    return { success: true, data: await operation(userId) };
  } catch (error) {
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof SharedSpaceError
    ) {
      return { success: false, error: error.message };
    }
    return {
      success: false,
      error: "No se pudo completar la operación. Intentá nuevamente.",
    };
  }
}
