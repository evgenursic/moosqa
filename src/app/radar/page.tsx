import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getRecommendedReleasesForUser, type RadarRecommendation } from "@/lib/recommendations";
import { getSiteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import {
  ensureUserProfile,
  getPersonalRadarForUser,
  type PersonalRadarRelease,
} from "@/lib/user-product";
import { formatRedditDateLabel } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Personal Radar",
  description: "Saved releases and followed artist or label updates for your MooSQA account.",
  alternates: {
    canonical: `${getSiteUrl()}/radar`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RadarPage() {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <Suspense fallback={<RadarSkeleton />}>
          <RadarContent />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}

async function RadarContent() {
  await connection();

  if (!isSupabaseAuthConfigured()) {
    return <RadarUnavailable message="Personal radar is waiting for Supabase Auth configuration." />;
  }

  const authState = await getSupabaseServerUser();

  if (authState.error) {
    return <RadarUnavailable message="Personal radar could not verify your account. Try again shortly." />;
  }

  if (!authState.user) {
    return <RadarSignIn />;
  }

  await ensureUserProfile({
    id: authState.user.id,
    email: authState.user.email,
    displayName: getDisplayName(authState.user.user_metadata),
  });

  const radar = await getPersonalRadarForUser(authState.user.id);
  const recommendations = await getRecommendedReleasesForUser(authState.user.id);

  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="mb-10">
        <p className="section-kicker text-black/43">Personal radar</p>
        <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
          Saved signals.
        </h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-black/64">
          A quiet view of releases you saved and the newest matches from artists or labels you follow.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <RadarReleaseList title="Saved releases" releases={radar.savedReleases} empty="Save releases from detail pages and they will collect here." />
        <RadarReleaseList title="From your follows" releases={radar.followedReleases} empty="Follow artists or labels on release pages to build this feed." />
        <RadarRecommendationList releases={recommendations} />
      </div>

      <section className="mt-8 border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
        <p className="section-kicker text-black/45">Follows</p>
        {radar.follows.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-3 text-[11px] uppercase tracking-[0.16em] text-black/58">
            {radar.follows.map((follow) => (
              <span key={`${follow.targetType}:${follow.normalizedValue}`} className="border border-[var(--color-line)] px-3 py-2">
                {follow.targetValue}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-7 text-black/62">No follows yet.</p>
        )}
      </section>
    </section>
  );
}

function RadarReleaseList({
  title,
  releases,
  empty,
}: {
  title: string;
  releases: PersonalRadarRelease[];
  empty: string;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">{title}</p>
      {releases.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {releases.map((release) => (
            <Link
              key={release.id}
              href={`/releases/${release.slug}?from=%2Fradar`}
              className="block border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4 transition hover:border-[var(--color-accent-strong)]"
            >
              <p className="text-xl leading-tight text-[var(--color-ink)] serif-display">
                {release.artistName || release.projectTitle || release.title}
              </p>
              {release.artistName && release.projectTitle ? (
                <p className="mt-1 text-sm text-black/62">{release.projectTitle}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-black/48">
                {release.genreName ? <span>{release.genreName}</span> : null}
                {release.labelName ? <span>{release.labelName}</span> : null}
                <span>{formatRedditDateLabel(release.publishedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-black/62">{empty}</p>
      )}
    </section>
  );
}

function RadarRecommendationList({ releases }: { releases: RadarRecommendation[] }) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-panel)] p-5">
      <p className="section-kicker text-black/45">Recommended next</p>
      {releases.length > 0 ? (
        <div className="mt-5 grid gap-4">
          {releases.map((release) => (
            <Link
              key={release.id}
              href={`/releases/${release.slug}?from=%2Fradar`}
              className="block border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4 transition hover:border-[var(--color-accent-strong)]"
            >
              <p className="text-xl leading-tight text-[var(--color-ink)] serif-display">
                {release.artistName || release.projectTitle || release.title}
              </p>
              {release.artistName && release.projectTitle ? (
                <p className="mt-1 text-sm text-black/62">{release.projectTitle}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-black/48">
                {release.genreName ? <span>{release.genreName}</span> : null}
                {release.labelName ? <span>{release.labelName}</span> : null}
                <span>{formatRedditDateLabel(release.publishedAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-black/52">
                {release.reasons.map((reason) => (
                  <span key={reason} className="border border-[var(--color-soft-line)] px-2 py-1">
                    {reason}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-black/62">
          Recommendations appear after MooSQA sees enough save, follow, and genre signals.
        </p>
      )}
    </section>
  );
}

function RadarSignIn() {
  return (
    <RadarUnavailable message="Sign in to view saved releases and followed artist updates.">
      <Link
        href="/account?next=%2Fradar"
        className="mt-4 inline-flex border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
      >
        Open account
      </Link>
    </RadarUnavailable>
  );
}

function RadarUnavailable({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <p className="section-kicker text-black/43">Personal radar</p>
      <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
        Saved signals.
      </h1>
      <div className="mt-8 max-w-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 text-sm leading-7 text-black/64">
        {message}
        {children}
      </div>
    </section>
  );
}

function RadarSkeleton() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <p className="section-kicker text-black/43">Personal radar</p>
      <div className="mt-4 h-20 max-w-xl animate-pulse bg-[var(--color-panel)]" />
      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        <div className="h-72 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
        <div className="h-72 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
      </div>
    </section>
  );
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
