import { afterEach, describe, expect, it } from "vitest";
import { createAppQueryClient, APP_DATA_GC_TIME, APP_DATA_STALE_TIME } from "@/lib/app-data/query-client";
import {
  appDataQueryKeys,
  invalidateAllPrivateAppData,
  invalidateExpenseRelatedData,
  isCasaEntry,
} from "@/lib/app-data/query-keys";

const queryClients = new Set<ReturnType<typeof createAppQueryClient>>();

function createClient() {
  const client = createAppQueryClient();
  queryClients.add(client);
  return client;
}

afterEach(() => {
  for (const client of queryClients) client.clear();
  queryClients.clear();
});

describe("private app data cache", () => {
  it("uses a five-minute fresh window and keeps inactive data for thirty minutes", () => {
    const client = createClient();
    expect(client.getDefaultOptions().queries?.staleTime).toBe(APP_DATA_STALE_TIME);
    expect(client.getDefaultOptions().queries?.gcTime).toBe(APP_DATA_GC_TIME);
  });

  it("scopes months and accounts into different stable keys", () => {
    const october = appDataQueryKeys.expenseMonth("user-a", "2026-10");
    const november = appDataQueryKeys.expenseMonth("user-a", "2026-11");
    const otherUser = appDataQueryKeys.expenseMonth("user-b", "2026-10");
    expect(new Set([JSON.stringify(october), JSON.stringify(november), JSON.stringify(otherUser)]).size).toBe(3);
  });

  it("invalidates every month and Casa data for the writer only", async () => {
    const client = createClient();
    const ownMonth = appDataQueryKeys.expenseMonth("user-a", "2026-10");
    const ownOtherMonth = appDataQueryKeys.expenseMonth("user-a", "2026-09");
    const ownCasa = appDataQueryKeys.household("user-a");
    const anotherUser = appDataQueryKeys.expenseMonth("user-b", "2026-10");
    for (const key of [ownMonth, ownOtherMonth, ownCasa, anotherUser]) {
      client.setQueryData(key, { cached: true });
    }

    await invalidateExpenseRelatedData(client, "user-a");

    expect(client.getQueryState(ownMonth)?.isInvalidated).toBe(true);
    expect(client.getQueryState(ownOtherMonth)?.isInvalidated).toBe(true);
    expect(client.getQueryState(ownCasa)?.isInvalidated).toBe(true);
    expect(client.getQueryState(anotherUser)?.isInvalidated).toBe(false);
  });

  it("invalidates active and archived category data together", async () => {
    const client = createClient();
    const active = appDataQueryKeys.categories("user-a");
    const archived = appDataQueryKeys.archivedCategories("user-a");
    client.setQueryData(active, []);
    client.setQueryData(archived, []);

    await invalidateAllPrivateAppData(client, "user-a");

    expect(client.getQueryState(active)?.isInvalidated).toBe(true);
    expect(client.getQueryState(archived)?.isInvalidated).toBe(true);
  });

  it("forces a refresh when the pathname enters Casa, not on unrelated renders", () => {
    expect(isCasaEntry(null, "/household")).toBe(true);
    expect(isCasaEntry("/categories", "/household")).toBe(true);
    expect(isCasaEntry("/household", "/household")).toBe(false);
    expect(isCasaEntry("/categories", "/")).toBe(false);
  });

  it("keeps each authenticated user's cache in a separate client instance", () => {
    const firstUser = createClient();
    const secondUser = createClient();
    const sharedShape = ["private-app-data", "user-a", "household"] as const;
    firstUser.setQueryData(sharedShape, { balance: "100" });

    expect(firstUser.getQueryData(sharedShape)).toEqual({ balance: "100" });
    expect(secondUser.getQueryData(sharedShape)).toBeUndefined();
  });

  it("retains the last successful value when a background request fails", async () => {
    const client = createClient();
    const queryKey = appDataQueryKeys.household("user-a");
    let shouldFail = false;
    client.setQueryDefaults(queryKey, {
      retry: false,
      queryFn: async () => {
        if (shouldFail) throw new Error("offline");
        return { balanceCents: "4000" };
      },
    });

    await client.fetchQuery({ queryKey });
    shouldFail = true;
    await client.invalidateQueries({ queryKey, refetchType: "none" });
    await expect(client.fetchQuery({ queryKey })).rejects.toThrow("offline");

    expect(client.getQueryData(queryKey)).toEqual({ balanceCents: "4000" });
  });
});
