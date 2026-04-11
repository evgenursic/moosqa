import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GenreFilterDrawer } from "@/components/genre-filter-drawer";
import { PageScrollRestorer } from "@/components/page-scroll-restorer";
import { ReleaseCard } from "@/components/release-card";
import { ShareFilterLink } from "@/components/share-filter-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getSectionArchivePage,
  isReleaseSectionKey,
  releaseSectionDefinitions,
} from "@/lib/release-sections";
import { getSiteUrl } from "@/lib/site";
import { refreshHomepageData, shouldBlockForHomepageRefresh } from "@/lib/sync-releases";

type BrowseSectionPageProps = {
  params: Promise<{
    section: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const unstable_instant = false;

export async function generateMetadata({
  params,
  searchParams,
}: BrowseSectionPageProps): Promise<Metadata> {
  try {
    const { section } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};

    if (!isReleaseSectionKey(section)) {
      return {
        title: "Browse | MooSQA",
      };
    }

    const definition = releaseSectionDefinitions[section];
    const page = parsePageParam(resolvedSearchParams.page);
    const genre = parseGenreParam(resolvedSearchParams.genre);
    const url = new URL(buildArchiveHref(section, { page, genre }), getSiteUrl()).toString();
    const titleParts = [definition.title];
    if (genre) {
      titleParts.push(genre);
    }
    if (page > 1) {
      titleParts.push(`Page ${page}`);
    }
    const title = `${titleParts.join(" | ")} | MooSQA`;
    const description = genre
      ? `${definition.description} Filtered to ${genre}${page > 1 ? `, page ${page}` : ""}.`
      : page > 1
        ? `${definition.description} Archive page ${page}.`
        : definition.description;

    return {
      title,
      description,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title,
        description,
        url,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch (error) {
    console.error("Browse metadata generation failed.", error);
    return {
      title: "Browse | MooSQA",
      description: "Explore the MooSQA archive.",
    };
  }
}

export default async function BrowseSectionPage({
  params,
  searchParams,
}: BrowseSectionPageProps) {
  const { section } = await params;
  if (!isReleaseSectionKey(section)) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const page = parsePageParam(resolvedSearchParams.page);
  const genre = parseGenreParam(resolvedSearchParams.genre);
  let archive: Awaited<ReturnType<typeof getSectionArchivePage>> | null = null;
  let archiveLoadError = false;

  try {
    const shouldWaitForRefresh = await shouldBlockForHomepageRefresh();

    if (shouldWaitForRefresh) {
      await refreshHomepageData();
    }

    archive = await getSectionArchivePage(section, page, genre);
  } catch (error) {
    archiveLoadError = true;
    console.error(`Archive page failed to load for section ${section}.`, error);
  }

  if (!archive) {
    return (
      <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
        <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
          <SiteHeader />
          <PageScrollRestorer />
          <section className="border-t border-[var(--color-line)] py-10">
            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              {archiveLoadError
                ? "This archive is temporarily unavailable. Reload in a moment."
                : "Archive unavailable."}
            </div>
          </section>
          <SiteFooter />
        </div>
      </main>
    );
  }

  const archiveHref = `${buildArchiveHref(section, { page: archive.page, genre: archive.selectedGenre })}#archive`;
  const canonicalArchiveHref = buildArchiveHref(section, {
    page: archive.page,
    genre: archive.selectedGenre,
  });
  const sectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${archive.title} archive`,
    url: new URL(canonicalArchiveHref, getSiteUrl()).toString(),
    description: archive.description,
    isPartOf: {
      "@type": "WebSite",
      name: "MooSQA",
      url: getSiteUrl(),
    },
    mainEntity: {
      "@type": "ItemList",
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      numberOfItems: archive.releases.length,
      itemListElement: archive.releases.map((release, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: new URL(`/releases/${release.slug}`, getSiteUrl()).toString(),
        name: release.artistName && release.projectTitle
          ? `${release.artistName} - ${release.projectTitle}`
          : release.title,
      })),
    },
  };

  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sectionJsonLd) }}
      />
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <PageScrollRestorer />

        <section id="archive" className="border-t border-[var(--color-line)] py-10">
          <div className="flex flex-col gap-5 border-b border-[var(--color-soft-line)] pb-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker text-black/43">{archive.title}</p>
              <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-6xl">
                Full archive.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-black/63">
                {archive.description}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.selectedGenre
                  ? `${archive.total} matching posts`
                  : `${archive.total} total posts`}
              </span>
              {archive.selectedGenre && archive.overallTotal !== archive.total ? (
                <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                  {archive.overallTotal} overall
                </span>
              ) : null}
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                Page {archive.page} / {archive.pageCount}
              </span>
              <Link
                href={`/#${archive.homeId}`}
                scroll={false}
                className="inline-flex items-center border border-[var(--color-line)] px-3 py-2 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              >
                Back to homepage section
              </Link>
              {archive.selectedGenre ? (
                <ShareFilterLink
                  href={canonicalArchiveHref}
                  label={`${archive.title} filtered by ${archive.selectedGenre}`}
                />
              ) : null}
            </div>
          </div>

          {archive.genres.length > 0 ? (
            <GenreFilterDrawer
              title="Genre filter"
              description={`Filter ${archive.title.toLowerCase()} without leaving the ${archive.title.toLowerCase()} archive.`}
              selectedGenre={archive.selectedGenre || ""}
              allHref={buildArchiveHref(section)}
              options={archive.genres.map((genreOption) => ({
                label: genreOption,
                href: buildArchiveHref(section, { genre: genreOption }),
              }))}
              searchPlaceholder={`Filter ${archive.title.toLowerCase()} genres`}
              className="mt-6 border-b border-[var(--color-soft-line)] pb-6"
              compact
            />
          ) : null}

          {archive.releases.length > 0 ? (
            <div className="mt-8 grid gap-8 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
              {archive.releases.map((release, index) => (
                <ReleaseCard
                  key={release.id}
                  release={release}
                  compact={index > 3}
                  priority={index < 2}
                  context={getReleaseCardContext(section)}
                  fromHref={archiveHref}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              {archive.emptyState}
            </div>
          )}

          <ArchivePagination
            section={section}
            page={archive.page}
            pageCount={archive.pageCount}
            genre={archive.selectedGenre}
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}

function ArchivePagination({
  section,
  page,
  pageCount,
  genre,
}: {
  section: string;
  page: number;
  pageCount: number;
  genre: string | null;
}) {
  if (pageCount <= 1) {
    return null;
  }

  const pageNumbers = getPaginationWindow(page, pageCount);

  return (
    <nav className="mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--color-soft-line)] pt-6 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]">
      {page > 1 ? (
        <Link
          href={buildArchiveHref(section, { page: page - 1, genre })}
          prefetch
          scroll={false}
          className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Previous
        </Link>
      ) : null}

      {pageNumbers.map((value, index) =>
        value === "ellipsis" ? (
          <span key={`${section}-ellipsis-${index}`} className="px-1 text-black/45">
            ...
          </span>
        ) : (
          <Link
            key={`${section}-${value}`}
            href={buildArchiveHref(section, { page: value, genre })}
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
          href={buildArchiveHref(section, { page: page + 1, genre })}
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

function parsePageParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw || "1");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function parseGenreParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() || "";
}

function buildArchiveHref(
  section: string,
  options?: {
    page?: number;
    genre?: string | null;
  },
) {
  const params = new URLSearchParams();

  if (options?.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  if (options?.genre) {
    params.set("genre", options.genre);
  }

  const query = params.toString();
  return query ? `/browse/${section}?${query}` : `/browse/${section}`;
}

function getReleaseCardContext(section: string) {
  if (section === "top-rated") {
    return "top-rated" as const;
  }

  if (section === "top-engaged") {
    return "top-engaged" as const;
  }

  return "default" as const;
}
