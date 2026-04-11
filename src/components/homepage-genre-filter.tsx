import { GenreFilterDrawer } from "@/components/genre-filter-drawer";

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
    <GenreFilterDrawer
      title="Browse by genre"
      selectedGenre={selectedGenre}
      allHref="/#latest"
      options={genres.map((genre) => ({
        label: genre,
        href: `/?genre=${encodeURIComponent(genre)}#explore`,
      }))}
      searchPlaceholder="Filter homepage genres"
      className="mt-4 border-t border-[var(--color-line)] pt-5 md:mt-5 md:pt-6"
    />
  );
}
