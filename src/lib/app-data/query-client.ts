import { QueryClient } from "@tanstack/react-query";
import { AppDataRequestError } from "@/lib/app-data/errors";

export const APP_DATA_STALE_TIME = 5 * 60 * 1000;
export const APP_DATA_GC_TIME = 30 * 60 * 1000;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: APP_DATA_STALE_TIME,
        gcTime: APP_DATA_GC_TIME,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          if (
            error instanceof AppDataRequestError &&
            (error.status === 401 || error.status === 403)
          ) {
            return false;
          }
          return failureCount < 1;
        },
      },
    },
  });
}
