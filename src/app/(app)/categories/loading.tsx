export default function CategoriesLoading() {
  return (
    <main
      className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10"
      aria-busy="true"
    >
      <p className="sr-only" role="status">
        Cargando categorías…
      </p>
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
