import { describe, expect, it } from "vitest";
import {
  resolveCategorySuggestion,
  keepOnlyCurrentlyActiveSuggestion,
  shouldApplyAutomaticSuggestion,
  suggestionThreshold,
  withSuggestionTimeout,
} from "./suggestion-policy";

const options = [
  { key: "category_0", id: "cat-1", name: "Almacén", description: "Compras de alimentos." },
];

describe("Jev category suggestion policy", () => {
  it("accepts an eligible high-confidence choice and maps its private option key to an id", () => {
    expect(resolveCategorySuggestion({
      answers: { category: { type: "choice", choice: "category_0", probabilities: { category_0: 0.91, no_match: 0.09 } } },
    }, options, 0.8)).toEqual({ categoryId: "cat-1", probability: 0.91 });
  });

  it("returns no suggestion for no_match, unknown choices, and low confidence", () => {
    expect(resolveCategorySuggestion({
      answers: { category: { type: "choice", choice: "no_match", probabilities: { no_match: 0.99 } } },
    }, options, 0.8)).toEqual({ categoryId: null, probability: null });
    expect(resolveCategorySuggestion({
      answers: { category: { type: "choice", choice: "category_0", probabilities: { category_0: 0.79 } } },
    }, options, 0.8)).toEqual({ categoryId: null, probability: null });
    expect(resolveCategorySuggestion({
      answers: { category: { type: "choice", choice: "some-other-id", probabilities: { "some-other-id": 1 } } },
    }, options, 0.8)).toEqual({ categoryId: null, probability: null });
  });

  it("rejects malformed choice answers instead of trusting an unexpected response", () => {
    expect(resolveCategorySuggestion({ answers: { category: { type: "noul", choice: "category_0", probabilities: { category_0: 1 } } } }, options, 0.8))
      .toEqual({ categoryId: null, probability: null });
    expect(resolveCategorySuggestion({ answers: { category: { type: "choice", choice: "category_0", probabilities: [] } } }, options, 0.8))
      .toEqual({ categoryId: null, probability: null });
    expect(resolveCategorySuggestion(null, options, 0.8))
      .toEqual({ categoryId: null, probability: null });
  });

  it("uses a bounded configurable threshold with a conservative default", () => {
    expect(suggestionThreshold(undefined)).toBe(0.8);
    expect(suggestionThreshold("0.9")).toBe(0.9);
    expect(suggestionThreshold("0.1")).toBe(0.8);
  });

  it("drops a suggestion if that category was archived while Jev was deciding", () => {
    expect(
      keepOnlyCurrentlyActiveSuggestion(
        { categoryId: "cat-1", probability: 0.95 },
        [],
      ),
    ).toEqual({ categoryId: null, probability: null });
  });

  it("turns timeouts into manual-selection fallback", async () => {
    const result = await withSuggestionTimeout(
      (signal) => new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")));
      }),
      5,
    );
    expect(result).toBeNull();
  });

  it("does not apply an obsolete response or overwrite a manual selection", () => {
    expect(shouldApplyAutomaticSuggestion(1, 2, false)).toBe(false);
    expect(shouldApplyAutomaticSuggestion(2, 2, true)).toBe(false);
    expect(shouldApplyAutomaticSuggestion(2, 2, false)).toBe(true);
  });
});
