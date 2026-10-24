import { describe, expect, it } from "vitest";
import { invitationAcceptanceError } from "./policy";

const now = new Date("2026-10-23T12:00:00.000Z");
const validInvitation = {
  acceptedAt: null,
  expiresAt: new Date("2026-10-30T12:00:00.000Z"),
  userAlreadyMember: false,
};

describe("shared-space invitations", () => {
  it("accepts a fresh invite into Viaje even when the user already belongs to Casa", () => {
    expect(invitationAcceptanceError(validInvitation, now)).toBeNull();
  });

  it("allows invitations to add participants beyond the former two-member cap", () => {
    // Acceptance state is scoped to the invite's group and has no member-count limit.
    expect(invitationAcceptanceError(validInvitation, now)).toBeNull();
  });

  it("rejects a code after it was accepted or expired", () => {
    expect(
      invitationAcceptanceError({ ...validInvitation, acceptedAt: now }, now),
    ).toMatch(/ya fue utilizada/i);
    expect(
      invitationAcceptanceError({ ...validInvitation, expiresAt: now }, now),
    ).toMatch(/venció/i);
  });

  it("rejects a duplicate membership in the invitation's specific group", () => {
    expect(
      invitationAcceptanceError({ ...validInvitation, userAlreadyMember: true }, now),
    ).toMatch(/ya formás parte/i);
  });
});
