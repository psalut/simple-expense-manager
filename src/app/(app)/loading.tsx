export default function AppLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10" aria-busy="true">
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
