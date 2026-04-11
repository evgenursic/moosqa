import Link from "next/link";

type HomepageGenreFilterProps = {
  genres: string[];
  selectedGenre: string;
};

export function HomepageGenreFilter({
  genres,
  selectedGenre,
}: HomepageGenreFilterProps) {
  if (genres.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 border-t border-[var(--color-line)] pt-5 md:mt-5 md:pt-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="section-kicker text-black/43">Browse by genre</p>
          <p className="mt-2 text-sm leading-7 text-black/62">
            Jump straight into the sound you want before opening the next card.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-black/55">
          <Link
            href="/#latest"
            scroll={false}
            className={
              selectedGenre
                ? "inline-flex items-center border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                : "inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-3 py-2 text-white"
            }
          >
            All genres
          </Link>

          {genres.map((genre) => (
            <Link
              key={genre}
              href={`/?genre=${encodeURIComponent(genre)}#explore`}
              scroll={false}
              className={
                selectedGenre === genre
                  ? "inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-3 py-2 text-white"
                  : "inline-flex items-center border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              }
            >
              {genre}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
