import Link from "next/link";
import { notFound } from "next/navigation";

import { ListeningLinks } from "@/components/listening-links";
import { RatingMeter } from "@/components/rating-meter";
import { ReleaseArtwork } from "@/components/release-artwork";
import { getReleaseBySlug } from "@/lib/sync-releases";
import { formatPubDate, formatRelative, getDisplayGenre, getDisplaySummary } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ReleasePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ReleasePage({ params }: ReleasePageProps) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);

  if (!release) {
    notFound();
  }

  const displayGenre = getDisplayGenre(release.genreName, release.releaseType);

  return (
    <main className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1500px] bg-[var(--color-paper)] px-2 md:px-4">
        <div className="grid gap-10 border-b border-[var(--color-line)] py-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="space-y-6">
            <Link href="/" className="section-kicker inline-flex text-black/43">
              Back to front page
            </Link>

            <div>
              <p className="section-kicker text-black/43">{release.releaseType.replace("_", " ")}</p>
              <h1 className="mt-4 max-w-5xl text-6xl leading-[0.92] text-[var(--color-ink)] serif-display md:text-7xl">
                {release.artistName || release.projectTitle || release.title}
              </h1>
              <p className="mt-4 max-w-4xl text-2xl leading-tight text-black/72 serif-display">
                {release.artistName && release.projectTitle ? release.projectTitle : release.title}
              </p>
            </div>

            <div className="flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
              <span>{formatPubDate(release.publishedAt)}</span>
              <span>{formatRelative(release.publishedAt)}</span>
              <span>{release.outletName || "Source pending"}</span>
              <span>{displayGenre}</span>
              {release.labelName ? <span>{release.labelName}</span> : null}
              <span>
                Reddit score {release.score ?? 0} / {release.commentCount ?? 0} comments
              </span>
            </div>

            <div className="max-w-4xl border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-sm leading-7 text-black/66">
              <p className="mb-3 text-[11px] uppercase tracking-[0.18em] text-black/45">AI summary</p>
              <p>{getDisplaySummary(release.aiSummary, release.summary)}</p>
            </div>

            <p className="text-[11px] uppercase tracking-[0.18em] text-black/45">
              Listening / highlighted buttons work now
            </p>
            <ListeningLinks release={release} />

            <div className="flex flex-wrap gap-3">
              <a
                href={release.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border border-[var(--color-accent-strong)] bg-[var(--color-accent-strong)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-white transition hover:opacity-92"
              >
                Open original source
              </a>
              <a
                href={release.redditPermalink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--color-ink)] transition hover:border-[var(--color-ink)]"
              >
                Open Reddit thread
              </a>
            </div>
          </section>

          <section className="space-y-6">
            <ReleaseArtwork
              title={release.title}
              artistName={release.artistName}
              projectTitle={release.projectTitle}
              imageUrl={release.imageUrl || release.thumbnailUrl}
              genreName={displayGenre}
              imageClassName="aspect-[4/3]"
            />

            <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
              <p className="section-kicker text-black/45">At a glance</p>
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.18em] text-black/55">
                <span className="border border-[var(--color-line)] px-3 py-2">{displayGenre}</span>
                {release.labelName ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">{release.labelName}</span>
                ) : null}
                {release.releaseDate ? (
                  <span className="border border-[var(--color-line)] px-3 py-2">
                    Release date {formatPubDate(release.releaseDate)}
                  </span>
                ) : null}
              </div>
            </div>

            <RatingMeter
              releaseId={release.id}
              initialAverage={release.scoreAverage}
              initialCount={release.scoreCount}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
