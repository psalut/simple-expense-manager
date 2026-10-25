import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/categories", () => ({
  listActiveCategoryOptions: vi.fn(),
}));

import { listActiveCategoryOptions } from "@/lib/server/categories";
import { suggestCategoryForTitle } from "./category-suggestions";

const listActiveCategories = vi.mocked(listActiveCategoryOptions);
const fetchMock = vi.fn<typeof fetch>();
const categories = [
  {
    id: "private-category-id-1",
    name: "Almacén",
    description: "Compras habituales de alimentos.",
  },
  {
    id: "private-category-id-2",
    name: "Transporte",
    description: "Colectivo, tren, taxi y combustible.",
  },
];
const noSuggestion = { categoryId: null, probability: null };

function typeSafeResponse(
  choice: string,
  probabilities: Record<string, number>,
) {
  return new Response(
    JSON.stringify({
      model: "jev-latest",
      answers: {
        category: {
          type: "choice",
          choice,
          probabilities,
          confidence: 0.9,
        },
      },
      usage: { input_tokens: 10, output_tokens: 2 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("direct TypeSafe Jev category suggestions", () => {
  beforeEach(() => {
    vi.stubEnv("TYPESAFE_API_KEY", "unit-test-key");
    vi.stubEnv("CATEGORY_SUGGESTION_MIN_PROBABILITY", "0.8");
    listActiveCategories.mockReset().mockResolvedValue(categories);
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends only the expense detail and active category names/descriptions, then maps the server option key", async () => {
    fetchMock.mockResolvedValue(
      typeSafeResponse("category_1", {
        category_0: 0.03,
        category_1: 0.94,
        no_match: 0.03,
      }),
    );

    await expect(
      suggestCategoryForTitle("Carga de tarjeta SUBE"),
    ).resolves.toEqual({
      categoryId: "private-category-id-2",
      probability: 0.94,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer unit-test-key",
    );
    expect(init?.cache).toBe("no-store");

    const body = JSON.parse(String(init?.body)) as {
      model: string;
      state: string;
      questions: {
        category: {
          type: string;
          criteria: Record<string, string>;
        };
      };
    };
    expect(body).toEqual({
      model: "jev-latest",
      state: "Carga de tarjeta SUBE",
      questions: {
        category: {
          type: "choice",
          instructions: expect.stringContaining("no_match"),
          criteria: {
            category_0: "Almacén: Compras habituales de alimentos.",
            category_1: "Transporte: Colectivo, tren, taxi y combustible.",
            no_match: "Ninguna categoría describe claramente este gasto.",
          },
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("private-category-id");
    expect(JSON.stringify(body)).not.toContain("usage");
  });

  it("returns no suggestion for no_match and below-threshold probability", async () => {
    fetchMock.mockResolvedValueOnce(
      typeSafeResponse("no_match", {
        category_0: 0.02,
        category_1: 0.02,
        no_match: 0.96,
      }),
    );
    await expect(suggestCategoryForTitle("Algo sin categoría clara"))
      .resolves.toEqual(noSuggestion);

    fetchMock.mockResolvedValueOnce(
      typeSafeResponse("category_0", {
        category_0: 0.79,
        category_1: 0.12,
        no_match: 0.09,
      }),
    );
    await expect(suggestCategoryForTitle("Compra variada"))
      .resolves.toEqual(noSuggestion);
  });

  it("treats an unexpected answer shape as no suggestion", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          answers: { category: { type: "score", choice: "category_0" } },
        }),
        { status: 200 },
      ),
    );

    await expect(suggestCategoryForTitle("Compra"))
      .resolves.toEqual(noSuggestion);
  });

  it("keeps the manual fallback on authentication and network errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));
    await expect(suggestCategoryForTitle("Compra en almacén"))
      .resolves.toEqual(noSuggestion);

    fetchMock.mockRejectedValueOnce(new Error("network failure"));
    await expect(suggestCategoryForTitle("Compra en almacén"))
      .resolves.toEqual(noSuggestion);
  });

  it("aborts a request that exceeds the four-second timeout", async () => {
    vi.useFakeTimers();
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    fetchMock.mockImplementation((_input, init) => {
      markStarted();
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    });

    const suggestion = suggestCategoryForTitle("Compra en almacén");
    await started;
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(suggestion).resolves.toEqual(noSuggestion);
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("drops a category that becomes archived while Jev is deciding", async () => {
    listActiveCategories
      .mockResolvedValueOnce(categories)
      .mockResolvedValueOnce([categories[1]]);
    fetchMock.mockResolvedValue(
      typeSafeResponse("category_0", {
        category_0: 0.92,
        category_1: 0.04,
        no_match: 0.04,
      }),
    );

    await expect(suggestCategoryForTitle("Compra en almacén"))
      .resolves.toEqual(noSuggestion);
    expect(listActiveCategories).toHaveBeenCalledTimes(2);
  });

  it("does not call TypeSafe when the server credential is absent", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");

    await expect(suggestCategoryForTitle("Compra en almacén"))
      .resolves.toEqual(noSuggestion);
    expect(listActiveCategories).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
