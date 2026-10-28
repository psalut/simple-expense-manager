import type { CategorySuggestionOption } from "./types";

export type CategorySuggestion = {
  categoryId: string | null;
  probability: number | null;
};

export function suggestionThreshold(value: string | undefined): number {
  if (!value) return 0.8;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 1 ? parsed : 0.8;
}

export function resolveCategorySuggestion(
  result: unknown,
  options: readonly CategorySuggestionOption[],
  threshold: number,
): CategorySuggestion {
  if (!isRecord(result) || !isRecord(result.answers)) {
    return { categoryId: null, probability: null };
  }

  const answer = result.answers.category;
  if (
    !isRecord(answer) ||
    answer.type !== "choice" ||
    typeof answer.choice !== "string" ||
    answer.choice === "no_match" ||
    !isRecord(answer.probabilities)
  ) {
    return { categoryId: null, probability: null };
  }

  const option = options.find((candidate) => candidate.key === answer.choice);
  const probability = answer.probabilities[answer.choice];
  if (
    !option ||
    typeof probability !== "number" ||
    !Number.isFinite(probability) ||
    probability < 0 ||
    probability > 1 ||
    probability < threshold
  ) {
    return { categoryId: null, probability: null };
  }

  return { categoryId: option.id, probability };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function keepOnlyCurrentlyActiveSuggestion(
  suggestion: CategorySuggestion,
  activeCategoryIds: readonly string[],
): CategorySuggestion {
  if (
    suggestion.categoryId === null ||
    !activeCategoryIds.includes(suggestion.categoryId)
  ) {
    return { categoryId: null, probability: null };
  }
  return suggestion;
}

export function shouldApplyAutomaticSuggestion(
  responseRequestId: number,
  currentRequestId: number,
  manualSelectionMade: boolean,
): boolean {
  return responseRequestId === currentRequestId && !manualSelectionMade;
}

export function shouldRequestCategorySuggestion(input: {
  open: boolean;
  readOnly: boolean;
  isIncome: boolean;
  hasExistingMovement: boolean;
  manualSelectionMade: boolean;
  description: string;
}): boolean {
  return (
    input.open &&
    !input.readOnly &&
    !input.isIncome &&
    !input.hasExistingMovement &&
    !input.manualSelectionMade &&
    input.description.trim().length >= 3
  );
}

export async function withSuggestionTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      operation(controller.signal).catch(() => null),
      timeout,
    ]);
  } catch {
    return null;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
