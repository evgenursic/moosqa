export default function BrowseSectionLoading() {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <section className="border-t border-[var(--color-line)] py-10">
          <div className="border-b border-[var(--color-soft-line)] pb-8">
            <div className="h-3 w-28 animate-pulse bg-[var(--color-line)]" />
            <div className="mt-5 h-14 w-72 max-w-full animate-pulse bg-[var(--color-line)]" />
            <div className="mt-4 h-5 w-[34rem] max-w-full animate-pulse bg-[var(--color-soft-line)]" />
          </div>

          <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, index) => (
              <div key={index} className="border-t border-[var(--color-line)] pt-6">
                <div className="aspect-[4/3] animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
                <div className="mt-4 h-8 w-24 animate-pulse bg-[var(--color-soft-line)]" />
                <div className="mt-4 h-12 w-4/5 animate-pulse bg-[var(--color-line)]" />
                <div className="mt-4 h-16 animate-pulse bg-[var(--color-soft-line)]" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
