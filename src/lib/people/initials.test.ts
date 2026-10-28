import { describe, expect, it } from "vitest";
import { getPersonInitials } from "./initials";

describe("getPersonInitials", () => {
  it("uses the first and last name initials", () => {
    expect(getPersonInitials("Pablo Salut")).toBe("PS");
    expect(getPersonInitials("Ana María Valeria")).toBe("AV");
  });

  it("uses the available name initial when the name has one word", () => {
    expect(getPersonInitials("Pablo")).toBe("P");
  });

  it("falls back to the email name or a neutral initial", () => {
    expect(getPersonInitials("", "ana@example.com")).toBe("A");
    expect(getPersonInitials(null, null)).toBe("U");
  });
});
