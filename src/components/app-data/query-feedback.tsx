"use client";

import { Button } from "@/components/ui/button";
import { getPrivateDataErrorMessage } from "@/lib/app-data/client";

export function StaleDataNotice() {
  return (
    <p
      className="mb-4 rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground"
      role="status"
    >
      No se pudo actualizar. Se muestran los últimos datos cargados.
    </p>
  );
}

export function QueryUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8 sm:px-6 sm:py-10">
      <p className="text-sm leading-6 text-destructive-foreground" role="alert">
        {getPrivateDataErrorMessage()}
      </p>
      <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
        Intentar de nuevo
      </Button>
    </main>
  );
}

export function ExpensesDataLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-3 sm:px-6 sm:pb-12 sm:pt-10" aria-busy="true">
      <p className="sr-only" role="status">Cargando gastos…</p>
      <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="mt-3 h-5 w-64 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-7 h-12 animate-pulse rounded-xl bg-muted" />
      <ul className="mt-8 divide-y divide-border border-y border-border" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <li key={row} className="flex min-h-[4.5rem] items-center justify-between gap-4 py-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-44 max-w-full animate-pulse rounded bg-muted" />
              <div className="h-3 w-32 max-w-full animate-pulse rounded bg-muted" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </main>
  );
}

export function CategoriesDataLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10" aria-busy="true">
      <p className="sr-only" role="status">Cargando categorías…</p>
      <div className="space-y-3">
        <div className="h-9 w-48 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-5 max-w-xl animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        {[0, 1].map((group) => (
          <div key={group} className="space-y-4">
            <div className="h-7 w-44 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
            <div className="space-y-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
              {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-2">
                  <div className="h-5 w-36 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                  <div className="h-4 w-4/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function HouseholdDataLoading() {
  return (
    <main className="household-page-main mx-auto w-full max-w-3xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-10" aria-busy="true">
      <p className="sr-only" role="status">Actualizando Casa…</p>
      <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
