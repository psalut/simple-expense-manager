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
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Toast } from "@base-ui/react/toast";
import { AlertCircle, Check, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createAppQueryClient } from "@/lib/app-data/query-client";
import { appDataQueryKeys, isCasaEntry } from "@/lib/app-data/query-keys";
import {
  dismissExpenseMutationNotice,
  recoverExpenseMutation,
  type ExpenseMutationNotice,
} from "@/lib/app-data/optimistic-expenses";

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
            <AppToastViewport userId={user.id} />
            <CasaEntryObserver userId={user.id} />
            {children}
          </Toast.Provider>
        </QueryClientProvider>
      </AppQueryClientContext.Provider>
    </AppUserContext.Provider>
  );
}

function AppToastViewport({ userId }: { userId: string }) {
  const toastManager = Toast.useToastManager<{ noticeId?: string }>();
  const { toasts } = toastManager;
  const router = useRouter();
  const queryClient = useQueryClient();
  const shownNoticeIds = useRef(new Set<string>());
  const noticesQuery = useQuery({
    queryKey: appDataQueryKeys.expenseMutationNotices(userId),
    queryFn: async () => [] as ExpenseMutationNotice[],
    enabled: false,
    initialData: [] as ExpenseMutationNotice[],
    staleTime: Infinity,
  });

  useEffect(() => {
    for (const notice of noticesQuery.data) {
      if (shownNoticeIds.current.has(notice.id)) continue;
      shownNoticeIds.current.add(notice.id);
      toastManager.add({
        id: notice.id,
        type: notice.type === "error" ? "expense-error" : "success",
        title: notice.title,
        description: notice.description,
        timeout: notice.type === "error" ? 0 : 3500,
        priority: notice.type === "error" ? "high" : "low",
        data: { noticeId: notice.id },
        onClose:
          notice.type === "error"
            ? () => dismissExpenseMutationNotice(queryClient, userId, notice.id)
            : undefined,
      });
      if (notice.type === "success") {
        dismissExpenseMutationNotice(queryClient, userId, notice.id);
      }
    }
  }, [noticesQuery.data, queryClient, toastManager, userId]);

  function recoverExpense(noticeId: string) {
    const recovery = recoverExpenseMutation(queryClient, userId, noticeId);
    toastManager.close(noticeId);
    if (recovery) router.push(recovery.route);
  }

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
                className={
                  "grid size-8 shrink-0 place-items-center rounded-full text-white " +
                  (toast.type === "expense-error"
                    ? "bg-destructive"
                    : "bg-brand-bordeaux")
                }
              >
                {toast.type === "expense-error" ? (
                  <AlertCircle size={16} />
                ) : (
                  <Check size={16} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <Toast.Title className="text-sm font-semibold" />
                <Toast.Description className="mt-0.5 text-sm text-muted-foreground" />
              </span>
              {toast.type === "expense-error" && (
                <Toast.Action
                  className="min-h-11 shrink-0 rounded-xl px-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring"
                  onClick={() => {
                    if (toast.data?.noticeId) {
                      recoverExpense(toast.data.noticeId);
                    }
                  }}
                >
                  Recuperar
                </Toast.Action>
              )}
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
