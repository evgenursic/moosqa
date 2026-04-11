export default function ReleaseLoading() {
  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="grid gap-10 border-b border-[var(--color-line)] py-6 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-6">
          <section className="space-y-6">
            <div className="h-4 w-32 animate-pulse bg-[var(--color-panel)]" />
            <div className="h-20 w-[36rem] max-w-full animate-pulse bg-[var(--color-panel)]" />
            <div className="h-10 w-[24rem] max-w-full animate-pulse bg-[var(--color-panel)]" />
            <div className="h-28 max-w-4xl animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </section>
          <section className="space-y-6">
            <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
            <div className="h-36 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
          </section>
        </div>
      </div>
    </main>
  );
}
