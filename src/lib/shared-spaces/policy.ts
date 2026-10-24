export type InvitationAcceptanceState = {
  acceptedAt: Date | null;
  expiresAt: Date;
  userAlreadyMember: boolean;
};

export function invitationAcceptanceError(
  state: InvitationAcceptanceState,
  now = new Date(),
): string | null {
  if (state.acceptedAt !== null || state.expiresAt.getTime() <= now.getTime()) {
    return "La invitación no existe, venció o ya fue utilizada.";
  }
  if (state.userAlreadyMember) {
    return "Ya formás parte de este grupo.";
  }
  return null;
}
