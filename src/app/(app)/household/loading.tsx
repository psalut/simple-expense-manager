export default function HouseholdLoading() {
  return (
    <main className="household-page-main mx-auto w-full max-w-3xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-10" aria-busy="true">
      <p className="sr-only" role="status">Cargando Casa…</p>
      <div className="h-9 w-40 animate-pulse rounded-lg bg-muted" />
      <div className="h-56 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
