import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchivePagination } from "@/components/archive-pagination";
import { GenreFilterDrawer } from "@/components/genre-filter-drawer";
import { PageScrollRestorer } from "@/components/page-scroll-restorer";
import { ReleaseCard } from "@/components/release-card";
import { ShareFilterLink } from "@/components/share-filter-link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  getSectionArchivePageLightweight,
  releaseSectionDefinitions,
  isReleaseSectionKey,
} from "@/lib/release-sections";
import { buildArchiveHref, parseArchiveViewMode } from "@/lib/archive-links";
import { getPopularityMaxForReleases } from "@/lib/release-metrics";
import { getSiteUrl } from "@/lib/site";

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
  const { section } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  if (!isReleaseSectionKey(section)) {
    return {
      title: "Browse | MooSQA",
      description: "Explore the MooSQA archive of singles, albums, EPs and live sessions.",
    };
  }

  const view = parseArchiveViewMode(resolvedSearchParams.view);
  const genre = parseGenreParam(resolvedSearchParams.genre) || null;
  const page = parsePageParam(resolvedSearchParams.page);
  const sectionDefinition = releaseSectionDefinitions[section];
  const modePrefix = view === "trending" ? "Trending" : "Browse";
  const genreSuffix = genre ? ` | ${genre}` : "";
  const pageSuffix = page > 1 ? ` | Page ${page}` : "";
  const title = `${modePrefix} ${sectionDefinition.title}${genreSuffix}${pageSuffix} | MooSQA`;
  const description =
    view === "trending"
      ? genre
        ? `Track the strongest ${genre} momentum inside MooSQA ${sectionDefinition.title.toLowerCase()}, ranked by audience opens, listening clicks, shares, and reactions.`
        : `Track the strongest audience momentum inside MooSQA ${sectionDefinition.title.toLowerCase()}, ranked by opens, listening clicks, shares, and reactions.`
      : genre
        ? `Browse ${sectionDefinition.title.toLowerCase()} filtered to ${genre} on MooSQA, with fresh indie releases, direct listening links, and community signals.`
        : sectionDefinition.description;
  const canonicalPath = buildArchiveHref(section, {
    page,
    genre,
    view,
  });
  const canonicalUrl = new URL(canonicalPath, getSiteUrl()).toString();

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
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
  const view = parseArchiveViewMode(resolvedSearchParams.view);
  let archive: Awaited<ReturnType<typeof getSectionArchivePageLightweight>> | null = null;
  let archiveLoadError = false;

  try {
    archive = await getSectionArchivePageLightweight(section, page, genre, view);
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

  const archiveHref = `${buildArchiveHref(section, {
    page: archive.page,
    genre: archive.selectedGenre,
    view: archive.archiveMode,
  })}#archive`;
  const canonicalArchiveHref = buildArchiveHref(section, {
    page: archive.page,
    genre: archive.selectedGenre,
    view: archive.archiveMode,
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
  const popularityMaxRaw = getPopularityMaxForReleases(archive.releases);

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
              <span className="border border-[var(--color-line)] bg-[var(--color-panel)] px-3 py-2">
                {archive.archiveMode === "trending" ? "Trending mode" : "Latest mode"}
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

          <div className="mt-6 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)]">
            <Link
              href={buildArchiveHref(section, {
                genre: archive.selectedGenre,
                view: "latest",
              })}
              scroll={false}
              className={
                archive.archiveMode === "latest"
                  ? "inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-white"
                  : "inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              }
            >
              Latest order
            </Link>
            <Link
              href={buildArchiveHref(section, {
                genre: archive.selectedGenre,
                view: "trending",
              })}
              scroll={false}
              className={
                archive.archiveMode === "trending"
                  ? "inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-white"
                  : "inline-flex items-center border border-[var(--color-line)] px-4 py-3 transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
              }
            >
              Trending
            </Link>
          </div>

          {archive.genres.length > 0 ? (
            <GenreFilterDrawer
              title="Genre filter"
              description={`Filter ${archive.title.toLowerCase()} without leaving the ${archive.title.toLowerCase()} archive.`}
              selectedGenre={archive.selectedGenre || ""}
              allHref={buildArchiveHref(section, {
                view: archive.archiveMode,
              })}
              options={archive.genres.map((genreOption) => ({
                label: genreOption,
                href: buildArchiveHref(section, {
                  genre: genreOption,
                  view: archive.archiveMode,
                }),
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
                  popularityMaxRaw={popularityMaxRaw}
                />
              ))}
            </div>
          ) : (
            <div className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/63">
              {archive.emptyState}
            </div>
          )}

          <ArchivePagination
            page={archive.page}
            pageCount={archive.pageCount}
            buildHref={(nextPage) =>
              buildArchiveHref(section, {
                page: nextPage,
                genre: archive.selectedGenre,
                view: archive.archiveMode,
              })
            }
          />
        </section>

        <SiteFooter />
      </div>
    </main>
  );
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

function getReleaseCardContext(section: string) {
  if (section === "top-rated") {
    return "top-rated" as const;
  }

  if (section === "top-engaged") {
    return "top-engaged" as const;
  }

  return "default" as const;
}
