"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  QueryClientProvider,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { createAppQueryClient } from "@/lib/app-data/query-client";
import { appDataQueryKeys, isCasaEntry } from "@/lib/app-data/query-keys";

export type AppUser = { id: string; name: string; email: string };

const AppUserContext = createContext<AppUser | null>(null);
const AppQueryClientContext = createContext<QueryClient | null>(null);

export function AppQueryProvider({
  user,
  children,
}: {
  user: AppUser;
  children: ReactNode;
}) {
  const [queryClient] = useState(createAppQueryClient);

  return (
    <AppUserContext.Provider value={user}>
      <AppQueryClientContext.Provider value={queryClient}>
        <QueryClientProvider client={queryClient}>
          <CasaEntryObserver userId={user.id} />
          {children}
        </QueryClientProvider>
      </AppQueryClientContext.Provider>
    </AppUserContext.Provider>
  );
}

export function useAppUser() {
  const user = useContext(AppUserContext);
  if (!user) throw new Error("AppQueryProvider is missing.");
  return user;
}

export function useAppQueryClient() {
  return useContext(AppQueryClientContext);
}

function CasaEntryObserver({ userId }: { userId: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = pathname;

    if (isCasaEntry(previous, pathname)) {
      void queryClient.refetchQueries({
        queryKey: appDataQueryKeys.household(userId),
        exact: true,
        type: "all",
      }, { cancelRefetch: false });
    }
  }, [pathname, queryClient, userId]);

  return null;
}
