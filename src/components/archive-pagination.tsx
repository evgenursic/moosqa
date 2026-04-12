import Link from "next/link";

type ArchivePaginationProps = {
  page: number;
  pageCount: number;
  buildHref: (page: number) => string;
  className?: string;
};

export function ArchivePagination({
  page,
  pageCount,
  buildHref,
  className = "",
}: ArchivePaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getPaginationWindow(page, pageCount);

  return (
    <nav
      className={`mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--color-soft-line)] pt-6 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] ${className}`.trim()}
    >
      {page > 1 ? (
        <Link
          href={buildHref(page - 1)}
          prefetch
          scroll={false}
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Previous
        </Link>
      ) : null}

      {pageNumbers.map((value, index) =>
        value === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className="px-1 text-black/45">
            ...
          </span>
        ) : (
          <Link
            key={`page-${value}`}
            href={buildHref(value)}
            prefetch
            scroll={false}
            aria-current={value === page ? "page" : undefined}
            className={
              value === page
                ? "inline-flex min-w-11 items-center justify-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-white"
                : "inline-flex min-w-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
            }
          >
            {value}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link
          href={buildHref(page + 1)}
          prefetch
          scroll={false}
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Next
        </Link>
      ) : null}
    </nav>
  );
}

function getPaginationWindow(page: number, pageCount: number) {
  const window = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const pages = [...window].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "ellipsis"> = [];

  for (let index = 0; index < pages.length; index += 1) {
    const current = pages[index];
    const previous = pages[index - 1];

    if (previous && current - previous > 1) {
      result.push("ellipsis");
    }

    result.push(current);
  }

  return result;
}
