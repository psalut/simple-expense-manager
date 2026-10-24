import { describe, expect, it } from "vitest";
import { getSharedSpaceDisplayName } from "./display-name";

describe("getSharedSpaceDisplayName", () => {
  it("adds the group ID prefix when names collide", () => {
    const spaces = [
      { id: "12345678-aaaa", name: "Casa" },
      { id: "abcdef12-bbbb", name: "casa" },
    ];

    expect(getSharedSpaceDisplayName(spaces[0], spaces)).toBe("Casa · 123456");
    expect(getSharedSpaceDisplayName(spaces[1], spaces)).toBe("casa · abcdef");
  });

  it("keeps a unique group name unchanged", () => {
    const spaces = [{ id: "12345678-aaaa", name: "Viaje" }];

    expect(getSharedSpaceDisplayName(spaces[0], spaces)).toBe("Viaje");
  });
});
