import { describe, expect, it } from "vitest";
import { canUseHousehold, resolveHouseholdId } from "./household-policy";

describe("single household", () => {
  const casa = { id: "casa", name: "Casa" };
  const legacy = { id: "legacy", name: "Viaje" };
  it("resolves a single Casa, with no hardcoded UUID", () => {
    expect(resolveHouseholdId([casa])).toBe("casa");
    expect(resolveHouseholdId([])).toBeNull();
    expect(resolveHouseholdId([legacy])).toBeNull();
  });
  it("requires a valid explicit selection while historical groups coexist", () => {
    expect(resolveHouseholdId([casa, legacy])).toBeNull();
    expect(resolveHouseholdId([casa, legacy], "casa")).toBe("casa");
    expect(resolveHouseholdId([casa, legacy], "legacy")).toBeNull();
    expect(resolveHouseholdId([casa], "missing")).toBeNull();
  });
  it("rejects a browser group ID, outsiders and incomplete/oversized households", () => {
    expect(canUseHousehold("casa", "legacy", ["a", "b"], "a")).toBe(false);
    expect(canUseHousehold("casa", "casa", ["a", "b"], "c")).toBe(false);
    expect(canUseHousehold("casa", "casa", ["a"], "a")).toBe(false);
    expect(canUseHousehold("casa", "casa", ["a", "b", "c"], "a")).toBe(false);
    expect(canUseHousehold("casa", "casa", ["a", "b"], "a")).toBe(true);
  });
  it("permits onboarding invitations only with one existing member", () => {
    expect(canUseHousehold("casa", "casa", ["a"], "a", false)).toBe(true);
    expect(canUseHousehold("casa", "casa", ["a", "b"], "a", false)).toBe(false);
  });
});
