import { describe, expect, it } from "vitest";
import { formatDateOnly, parseDateOnly } from "./date-only";

describe("date-only calendar serialization", () => {
  it.each(["2026-03-08", "2026-10-25", "2024-02-29"])(
    "round-trips %s without changing the calendar day",
    (value) => {
      expect(formatDateOnly(parseDateOnly(value))).toBe(value);
    },
  );

  it("parses date-only values at midday UTC to avoid local midnight shifts", () => {
    expect(parseDateOnly("2026-10-25").toISOString()).toBe(
      "2026-10-25T12:00:00.000Z",
    );
  });
});
