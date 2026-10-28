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
import { Toast } from "@base-ui/react/toast";
import { Check, X } from "lucide-react";
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
          <Toast.Provider timeout={3500} limit={3}>
            <AppToastViewport />
            <CasaEntryObserver userId={user.id} />
            {children}
          </Toast.Provider>
        </QueryClientProvider>
      </AppQueryClientContext.Provider>
    </AppUserContext.Provider>
  );
}

function AppToastViewport() {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal>
      <Toast.Viewport className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-nav-safe-padding)+9.5rem)] z-[60] mx-auto w-[calc(100vw-2rem)] max-w-sm md:inset-auto md:right-4 md:bottom-4 md:mx-0 md:w-80">
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="pointer-events-auto absolute right-0 bottom-0 left-0 z-[calc(1000-var(--toast-index))] w-full rounded-2xl border border-border bg-card text-card-foreground shadow-lg transition-[opacity,transform] duration-200 data-starting-style:translate-y-2 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:opacity-0 motion-reduce:transition-none"
          >
            <Toast.Content className="flex min-w-0 items-center gap-3 px-4 py-2">
              <span
                aria-hidden="true"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-bordeaux text-white"
              >
                <Check size={16} />
              </span>
              <Toast.Title className="min-w-0 flex-1 text-sm font-semibold" />
              <Toast.Close
                aria-label="Cerrar notificación"
                className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <X size={16} aria-hidden="true" />
              </Toast.Close>
            </Toast.Content>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
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
