export default function BrowseSectionLoading() {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="h-28 border-b border-[var(--color-line)] bg-[var(--color-paper)]" />
        <div className="mt-4 h-5 w-40 animate-pulse bg-[var(--color-panel)]" />
        <section className="border-t border-[var(--color-line)] py-10">
          <div className="border-b border-[var(--color-soft-line)] pb-8">
            <div className="h-4 w-36 animate-pulse bg-[var(--color-panel)]" />
            <div className="mt-4 h-16 w-80 max-w-full animate-pulse bg-[var(--color-panel)]" />
            <div className="mt-4 h-5 w-[32rem] max-w-full animate-pulse bg-[var(--color-panel)]" />
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="border-t border-[var(--color-line)] pt-6">
                <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
