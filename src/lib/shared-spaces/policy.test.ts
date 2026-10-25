import { describe, expect, it } from "vitest";
import { invitationAcceptanceError, MAX_SHARED_SPACE_MEMBERS } from "./policy";

const now = new Date("2026-10-23T12:00:00.000Z");
const validInvitation = {
  acceptedAt: null,
  expiresAt: new Date("2026-10-30T12:00:00.000Z"),
  userAlreadyMember: false,
  memberCount: 1,
};

describe("shared-space invitations", () => {
  it("accepts a valid invitation when the group has one member", () => {
    expect(invitationAcceptanceError(validInvitation, now)).toBeNull();
  });

  it("enforces a two-member limit", () => {
    expect(MAX_SHARED_SPACE_MEMBERS).toBe(2);
    expect(invitationAcceptanceError({ ...validInvitation, memberCount: 2 }, now)).toMatch(/dos integrantes/i);
  });

  it("rejects invitations that are already accepted or expired", () => {
    expect(invitationAcceptanceError({ ...validInvitation, acceptedAt: now }, now)).toMatch(/ya fue utilizada/i);
    expect(invitationAcceptanceError({ ...validInvitation, expiresAt: now }, now)).toMatch(/venció/i);
  });

  it("rejects duplicate membership", () => {
    expect(invitationAcceptanceError({ ...validInvitation, userAlreadyMember: true }, now)).toMatch(/ya formás parte/i);
  });
});
