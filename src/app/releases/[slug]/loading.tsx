export default function ReleaseLoading() {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="grid gap-10 border-b border-[var(--color-line)] py-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <div className="h-3 w-28 animate-pulse bg-[var(--color-soft-line)]" />
            <div className="h-20 w-5/6 animate-pulse bg-[var(--color-line)]" />
            <div className="h-10 w-3/4 animate-pulse bg-[var(--color-soft-line)]" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-8 w-28 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]"
                />
              ))}
            </div>
            <div className="h-40 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </section>

          <section className="space-y-6">
            <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
            <div className="h-40 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </section>
        </div>
      </div>
    </main>
  );
}
