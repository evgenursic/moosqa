import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";

import {
  addReleaseToCollectionAction,
  assignUserRoleAction,
  bootstrapAdminAccessAction,
  createEditorialCollectionAction,
  runWeakCardRepairAction,
  updateReleaseEditorialAction,
} from "@/app/admin/actions";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getAdminAccessState } from "@/lib/admin-session";
import { getAdminDashboardData } from "@/lib/admin-dashboard";
import { formatPubDate, formatRelative } from "@/lib/utils";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Admin | MooSQA",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage({ searchParams }: AdminPageProps) {
  return (
    <main className="editorial-shell flex-1 px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-[1760px] bg-[var(--color-paper)] px-2 md:px-4">
        <SiteHeader />
        <Suspense fallback={<AdminShell />}>
          <AdminContent searchParams={searchParams} />
        </Suspense>
        <SiteFooter />
      </div>
    </main>
  );
}

async function AdminContent({ searchParams }: AdminPageProps) {
  await connection();
  const access = await getAdminAccessState();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const query = readSearchParam(resolvedSearchParams.q);

  if (!access.configured) {
    return <AdminNotice title="Setup required" message="Supabase Auth must be configured before admin access can be enabled." />;
  }

  if (access.error) {
    return <AdminNotice title="Account error" message="Admin access could not verify your current session." />;
  }

  if (!access.authenticated) {
    return (
      <AdminNotice title="Sign in required" message="Sign in with an editor or admin account to open MooSQA admin.">
        <Link
          href="/account?next=%2Fadmin"
          className="mt-4 inline-flex border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
        >
          Open account
        </Link>
      </AdminNotice>
    );
  }

  if (!access.canAccess) {
    if (access.bootstrapAllowed && access.authenticated) {
      return (
        <AdminNotice
          title="Admin bootstrap"
          message="No ADMIN user exists yet. Sign in, confirm the debug secret, and grant the first admin role explicitly."
        >
          <form action={bootstrapAdminAccessAction} className="mt-5 grid gap-3 border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4">
            <LabeledInput name="bootstrapSecret" label="Debug secret" placeholder="Current DEBUG_SECRET" />
            <LabeledInput name="reason" label="Reason" placeholder="Initial admin bootstrap" />
            <div>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
              >
                Grant first admin
              </button>
            </div>
          </form>
        </AdminNotice>
      );
    }

    return <AdminNotice title="Access denied" message="This account does not have editor or admin privileges yet." />;
  }

  const dashboard = await getAdminDashboardData(query);

  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="mb-10">
        <p className="section-kicker text-black/43">Private admin</p>
        <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
          Editorial control.
        </h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-black/64">
          Product analytics, release overrides, curated collections, and weak-card repair controls for the live feed.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Users" value={String(dashboard.productAnalytics.funnel.totalUsers)} />
        <StatCard label="Save users" value={String(dashboard.productAnalytics.funnel.saveUsers)} />
        <StatCard label="Follow users" value={String(dashboard.productAnalytics.funnel.followUsers)} />
        <StatCard label="Radar users" value={String(dashboard.productAnalytics.funnel.radarUsers)} />
        <StatCard label="Notif opt-in" value={String(dashboard.productAnalytics.funnel.notificationUsers)} />
        <StatCard label="Opt-in / radar" value={`${dashboard.productAnalytics.funnel.notificationAdoptionRate}%`} />
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Saves / 100 opens" value={String(dashboard.productAnalytics.conversion.savesPer100Opens)} />
        <StatCard label="Follows / 100 opens" value={String(dashboard.productAnalytics.conversion.followsPer100Opens)} />
        <StatCard label="Notif eligible" value={String(dashboard.productAnalytics.funnel.notificationEligibleUsers)} />
        <StatCard label="Eligible / radar" value={`${dashboard.productAnalytics.funnel.notificationEligibleRate}%`} />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <PanelCard title="Top saved releases">
          <div className="grid gap-3">
            {dashboard.productAnalytics.topSavedReleases.map((entry) => (
              <MetricRow
                key={entry.release?.id}
                title={entry.release?.artistName || entry.release?.projectTitle || entry.release?.title || "Unknown release"}
                subtitle={entry.release?.projectTitle || entry.release?.title || entry.release?.slug || "n/a"}
                value={`${entry.count} saves`}
              />
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Top follows">
          <div className="grid gap-3">
            {dashboard.productAnalytics.topFollowedArtists.map((entry) => (
              <MetricRow key={`artist-${entry.label}`} title={entry.label} subtitle="Artist" value={`${entry.count} follows`} />
            ))}
            {dashboard.productAnalytics.topFollowedLabels.map((entry) => (
              <MetricRow key={`label-${entry.label}`} title={entry.label} subtitle="Label" value={`${entry.count} follows`} />
            ))}
          </div>
        </PanelCard>
      </section>

      <section className="mt-8 grid gap-4 xl:grid-cols-4">
        <PanelCard title="Save conversion by release type">
          <div className="grid gap-3">
            {dashboard.productAnalytics.saveConversionByType.map((entry) => (
              <MetricRow
                key={entry.label}
                title={entry.label}
                subtitle={`${entry.opens} detail opens`}
                value={`${entry.savesPer100Opens} saves / 100 opens`}
              />
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Follow pathways">
          <div className="grid gap-3">
            {dashboard.productAnalytics.followPathways.map((entry) => (
              <MetricRow
                key={entry.label}
                title={entry.label}
                subtitle="Current follow mix"
                value={`${entry.count} follows`}
              />
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Detail funnel">
          <div className="grid gap-3">
            <MetricRow
              title="Release detail opens"
              subtitle="Aggregate public detail visits"
              value={String(dashboard.productAnalytics.conversion.detailOpens)}
            />
            <MetricRow
              title="Detail to save"
              subtitle="Across all public release pages"
              value={`${dashboard.productAnalytics.conversion.detailToSavePer100Opens} / 100 opens`}
            />
            <MetricRow
              title="Detail to follow"
              subtitle="Across all public release pages"
              value={`${dashboard.productAnalytics.conversion.detailToFollowPer100Opens} / 100 opens`}
            />
          </div>
        </PanelCard>

        <PanelCard title="Notification pipeline">
          <div className="grid gap-3">
            <MetricRow
              title="Queued"
              subtitle="Jobs waiting to send"
              value={String(dashboard.productAnalytics.notifications.pending)}
            />
            <MetricRow
              title="Processing"
              subtitle="Jobs currently running"
              value={String(dashboard.productAnalytics.notifications.processing)}
            />
            <MetricRow
              title="Sent"
              subtitle="Delivered notification jobs"
              value={String(dashboard.productAnalytics.notifications.sent)}
            />
            <MetricRow
              title="Failed"
              subtitle="Jobs that hard-failed"
              value={String(dashboard.productAnalytics.notifications.failed)}
            />
            <MetricRow
              title="Skipped"
              subtitle="Jobs suppressed or ineligible"
              value={String(dashboard.productAnalytics.notifications.skipped)}
            />
          </div>
        </PanelCard>
      </section>

      <section className="mt-8">
        <PanelCard title="Recent product trend">
          <div className="grid gap-3">
            {dashboard.productAnalytics.dailyTrends.slice(0, 8).map((entry) => (
              <MetricRow
                key={entry.dateKey}
                title={entry.label}
                subtitle={`${entry.opens} opens / ${entry.saves} saves / ${entry.follows} follows`}
                value={`${entry.notificationQueued} queued / ${entry.notificationSent} sent / ${entry.notificationFailed + entry.notificationSkipped} blocked`}
              />
            ))}
          </div>
        </PanelCard>
      </section>

      {access.isAdmin ? (
        <section className="mt-8 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <PanelCard title="Role access">
            <div id="roles" className="grid gap-5">
              <form action={assignUserRoleAction} className="grid gap-3 border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4 md:grid-cols-2">
                <LabeledInput name="email" label="User email" placeholder="editor@example.com" />
                <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                  Role
                  <select
                    name="role"
                    defaultValue="EDITOR"
                    className="min-h-11 border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--color-ink)]"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Admin</option>
                    <option value="USER">User</option>
                  </select>
                </label>
                <div className="md:col-span-2">
                  <LabeledInput name="reason" label="Reason" placeholder="Why this role is changing." />
                </div>
                <div className="md:col-span-2">
                  <LabeledInput name="confirmation" label="Confirm sensitive changes" placeholder="Type the target email for Admin or User changes." />
                  <p className="mt-2 text-xs leading-5 text-black/50">
                    Required when granting Admin or reverting someone to User. Include a reason with at least 6 characters.
                  </p>
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
                  >
                    Save role
                  </button>
                </div>
              </form>

              <div className="grid gap-3">
                {dashboard.roleRoster.map((entry) => (
                  <MetricRow
                    key={entry.id}
                    title={entry.displayName || entry.email || entry.id}
                    subtitle={entry.email || "No email"}
                    value={entry.role}
                  />
                ))}
              </div>
            </div>
          </PanelCard>

          <PanelCard title="Recent role activity">
            <div className="grid gap-3">
              {dashboard.recentRoleAssignments.map((entry) => (
                <MetricRow
                  key={entry.id}
                  title={entry.target.displayName || entry.target.email || "Unknown user"}
                  subtitle={`${entry.previousRole || "none"} -> ${entry.nextRole} / ${entry.actor?.displayName || entry.actor?.email || "bootstrap"}`}
                  value={formatRelative(entry.createdAt)}
                />
              ))}
            </div>
          </PanelCard>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <PanelCard title="Curated collections">
          <div id="collections" className="grid gap-5">
            <form action={createEditorialCollectionAction} className="grid gap-3 border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <LabeledInput name="slug" label="Slug" placeholder="editors-picks-spring" />
                <LabeledInput name="title" label="Title" placeholder="Editors' Picks: Spring" />
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
                <LabeledInput name="description" label="Description" placeholder="Short editorial context." />
                <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                  Type
                  <select
                    name="type"
                    defaultValue="CURATED"
                    className="min-h-11 border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--color-ink)]"
                  >
                    <option value="EDITORS_PICK">Editors pick</option>
                    <option value="CURATED">Curated</option>
                    <option value="ROUNDUP">Roundup</option>
                    <option value="SEASONAL">Seasonal</option>
                    <option value="BEST_OF">Best of</option>
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-3 text-sm text-black/62">
                <input type="checkbox" name="isPublished" className="h-4 w-4 accent-[var(--color-accent-strong)]" />
                Publish immediately
              </label>
              <div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
                >
                  Save collection
                </button>
              </div>
            </form>

            {dashboard.collections.map((collection) => (
              <article key={collection.id} className="border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                  <span>{collection.type}</span>
                  <span>{collection.isPublished ? "Published" : "Draft"}</span>
                  <span>{formatRelative(collection.updatedAt)}</span>
                </div>
                <h2 className="mt-3 text-3xl leading-[0.96] text-[var(--color-ink)] serif-display">{collection.title}</h2>
                {collection.description ? <p className="mt-2 text-sm leading-7 text-black/62">{collection.description}</p> : null}
                <form action={createEditorialCollectionAction} className="mt-4 grid gap-3 border-t border-[var(--color-soft-line)] pt-4">
                  <input type="hidden" name="slug" value={collection.slug} />
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
                    <LabeledInput name="title" label="Edit title" defaultValue={collection.title} placeholder="Collection title" />
                    <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                      Type
                      <select
                        name="type"
                        defaultValue={collection.type}
                        className="min-h-11 border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--color-ink)]"
                      >
                        <option value="EDITORS_PICK">Editors pick</option>
                        <option value="CURATED">Curated</option>
                        <option value="ROUNDUP">Roundup</option>
                        <option value="SEASONAL">Seasonal</option>
                        <option value="BEST_OF">Best of</option>
                      </select>
                    </label>
                  </div>
                  <LabeledInput name="description" label="Edit description" defaultValue={collection.description || ""} placeholder="Short editorial context." />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-3 text-sm text-black/62">
                      <input type="checkbox" name="isPublished" defaultChecked={collection.isPublished} className="h-4 w-4 accent-[var(--color-accent-strong)]" />
                      Published
                    </label>
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                    >
                      Update collection
                    </button>
                  </div>
                </form>
                <div className="mt-4 grid gap-2">
                  {collection.entries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-2 first:border-t-0 first:pt-0">
                      <div className="min-w-0">
                        <p className="truncate text-lg text-[var(--color-ink)] serif-display">
                          {entry.release.artistName || entry.release.projectTitle || entry.release.title}
                        </p>
                        <p className="truncate text-xs uppercase tracking-[0.16em] text-black/48">
                          {entry.release.genreName || "Genre pending"}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.16em] text-black/48">#{entry.position}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="Featured now">
          <div className="grid gap-3">
            {dashboard.featuredReleases.map((release) => (
              <MetricRow
                key={release.id}
                title={release.artistName || release.projectTitle || release.title}
                subtitle={`${release.genreName || "Genre pending"} / rank ${release.editorialRank}`}
                value={release.featuredAt ? formatRelative(release.featuredAt) : formatRelative(release.publishedAt)}
              />
            ))}
          </div>
        </PanelCard>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <PanelCard title="Release override search">
          <form action="/admin" id="search" className="grid gap-3 border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4" method="get">
            <LabeledInput name="q" label="Search release" placeholder="slug, artist, title, label" defaultValue={query} />
            <div>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
              >
                Search releases
              </button>
            </div>
          </form>

          <div className="mt-5 grid gap-5">
            {dashboard.searchResults.map((release) => (
              <article key={release.id} className="border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4">
                <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-black/50">
                  <span>{release.slug}</span>
                  <span>{formatPubDate(release.publishedAt)}</span>
                  <span>{release.qualityScore}/100 quality</span>
                  {release.isHidden ? <span>Hidden</span> : null}
                  {release.isFeatured ? <span>Featured</span> : null}
                </div>
                <h2 className="mt-3 text-3xl leading-[0.96] text-[var(--color-ink)] serif-display">
                  {release.artistName || release.projectTitle || release.title}
                </h2>
                <p className="mt-2 text-base text-black/66 serif-display">
                  {release.projectTitle || release.title}
                </p>

                <form action={updateReleaseEditorialAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="releaseId" value={release.id} />
                  <input type="hidden" name="slug" value={release.slug} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledInput name="genreOverride" label="Genre override" defaultValue={release.genreOverride || ""} placeholder={release.genreName || "Genre"} />
                    <LabeledInput name="editorialRank" label="Feature rank" defaultValue={String(release.editorialRank)} placeholder="0" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledInput name="imageUrlOverride" label="Cover override URL" defaultValue={release.imageUrlOverride || ""} placeholder={release.imageUrl || "https://..."} />
                    <LabeledInput name="sourceUrlOverride" label="Primary link override" defaultValue={release.sourceUrlOverride || ""} placeholder={release.sourceUrl} />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledInput name="youtubeUrl" label="YouTube URL" defaultValue={release.youtubeUrl || ""} placeholder="https://www.youtube.com/watch?v=..." />
                    <LabeledInput name="youtubeMusicUrl" label="YouTube Music URL" defaultValue={release.youtubeMusicUrl || ""} placeholder="https://music.youtube.com/watch?v=..." />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <LabeledInput name="youtubeViewCount" label="YouTube views" type="number" defaultValue={release.youtubeViewCount === null ? "" : String(release.youtubeViewCount)} placeholder="42800" />
                    <LabeledInput name="youtubePublishedAt" label="YouTube published date" type="date" defaultValue={formatDateInput(release.youtubePublishedAt)} placeholder="2026-04-24" />
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <LabeledInput name="bandcampUrl" label="Bandcamp URL" defaultValue={release.bandcampUrl || ""} placeholder="https://artist.bandcamp.com/..." />
                    <LabeledInput name="officialWebsiteUrl" label="Website URL" defaultValue={release.officialWebsiteUrl || ""} placeholder="https://artist.com" />
                    <LabeledInput name="officialStoreUrl" label="Store URL" defaultValue={release.officialStoreUrl || ""} placeholder="https://store.artist.com" />
                  </div>
                  <LabeledInput name="summaryOverride" label="Summary override" defaultValue={release.summaryOverride || ""} placeholder={release.summary || "Short editorial summary"} />
                  <LabeledInput name="editorialNotes" label="Editorial notes" defaultValue={release.editorialNotes || ""} placeholder="Internal context for future edits." />
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 text-sm text-black/62">
                      <input type="checkbox" name="isFeatured" defaultChecked={release.isFeatured} className="h-4 w-4 accent-[var(--color-accent-strong)]" />
                      Featured release
                    </label>
                    <label className="flex items-center gap-3 text-sm text-black/62">
                      <input type="checkbox" name="isHidden" defaultChecked={release.isHidden} className="h-4 w-4 accent-[var(--color-accent-strong)]" />
                      Hidden from public feed
                    </label>
                  </div>
                  <LabeledInput name="hiddenReason" label="Hidden reason" defaultValue={release.hiddenReason || ""} placeholder="Why this release is hidden." />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
                    >
                      Save release overrides
                    </button>
                    {dashboard.collections[0] ? (
                      <div className="flex flex-wrap gap-3">
                        <input type="hidden" form={`collection-${release.id}`} name="releaseId" value={release.id} />
                      </div>
                    ) : null}
                  </div>
                </form>

                {dashboard.collections[0] ? (
                  <form id={`collection-${release.id}`} action={addReleaseToCollectionAction} className="mt-4 grid gap-3 border-t border-[var(--color-soft-line)] pt-4 md:grid-cols-[minmax(0,1fr)_8rem_12rem_auto]">
                    <input type="hidden" name="releaseId" value={release.id} />
                    <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
                      Collection
                      <select name="collectionId" className="min-h-11 border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--color-ink)]">
                        {dashboard.collections.map((collection) => (
                          <option key={collection.id} value={collection.id}>
                            {collection.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <LabeledInput name="position" label="Position" defaultValue="0" placeholder="0" />
                    <LabeledInput name="note" label="Entry note" placeholder="Optional entry note" />
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="inline-flex min-h-11 items-center justify-center border border-[var(--color-line)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-[var(--color-ink)] transition hover:border-[var(--color-accent-strong)] hover:text-[var(--color-accent-strong)]"
                      >
                        Add to collection
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </PanelCard>

        <div className="grid gap-4">
          <PanelCard title="Repair queue">
            <div id="repair" className="grid gap-4">
              <form action={runWeakCardRepairAction} className="grid gap-3 border border-[var(--color-soft-line)] bg-[var(--color-paper)] p-4">
                <div className="grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)]">
                  <LabeledInput name="limit" label="Limit" type="number" defaultValue="4" placeholder="4" />
                  <LabeledInput name="reason" label="Reason" placeholder="Repair stale weak cards after editorial review." />
                </div>
                <div>
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center justify-center border border-[var(--color-ink)] bg-[var(--color-ink)] px-4 py-3 text-xs uppercase tracking-[0.16em] text-white transition hover:bg-[var(--color-accent-strong)]"
                  >
                    Run bounded repair
                  </button>
                </div>
              </form>
              {dashboard.quality.summaryAudit.repairCandidates.slice(0, 8).map((release) => (
                <MetricRow
                  key={release.id}
                  title={release.artistName || release.projectTitle || release.title}
                  subtitle={`${release.summaryQualityScore}/100 summary`}
                  value={`${release.priorityScore} priority`}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard title="Recent editorial activity">
            <div className="grid gap-3">
              {dashboard.recentAudits.map((entry) => (
                <MetricRow
                  key={entry.id}
                  title={entry.release.artistName || entry.release.projectTitle || entry.release.title}
                  subtitle={`${entry.action} / ${entry.editor?.displayName || entry.editor?.email || "unknown editor"}`}
                  value={formatRelative(entry.createdAt)}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard title="Genre conversion">
            <div className="grid gap-3">
              {dashboard.productAnalytics.genrePerformance.map((entry) => (
                <MetricRow
                  key={entry.label}
                  title={entry.label}
                  subtitle={`${entry.opens} opens`}
                  value={`${entry.savesPer100Opens} saves / 100 opens`}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard title="Source performance">
            <div className="grid gap-3">
              {dashboard.productAnalytics.sourcePerformance.map((entry) => (
                <MetricRow
                  key={entry.label}
                  title={entry.label}
                  subtitle={`${entry.opens} opens / ${entry.listenClicks} listen clicks`}
                  value={`${entry.savesPer100Opens} saves / 100 opens`}
                />
              ))}
            </div>
          </PanelCard>

          <PanelCard title="Editorial impact">
            <div className="grid gap-3">
              {dashboard.productAnalytics.editorialPerformance.map((entry) => (
                <MetricRow
                  key={entry.label}
                  title={entry.label}
                  subtitle={`${entry.releaseCount} releases / ${entry.opens} opens`}
                  value={`${entry.savesPer100Opens} saves / 100 opens`}
                />
              ))}
            </div>
          </PanelCard>
        </div>
      </section>
    </section>
  );
}

function AdminShell() {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <div className="h-24 animate-pulse bg-[var(--color-panel)]" />
      <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse border border-[var(--color-line)] bg-[var(--color-panel)]" />
        ))}
      </div>
    </section>
  );
}

function AdminNotice({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-t border-[var(--color-line)] py-10 md:py-14">
      <p className="section-kicker text-black/43">Private admin</p>
      <h1 className="mt-3 text-5xl leading-none text-[var(--color-ink)] serif-display md:text-7xl">
        {title}
      </h1>
      <div className="mt-8 max-w-2xl border border-[var(--color-line)] bg-[var(--color-panel)] p-5 text-sm leading-7 text-black/64">
        {message}
        {children}
      </div>
    </section>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{title}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-line)] bg-[var(--color-panel)] p-4">
      <p className="section-kicker text-black/43">{label}</p>
      <p className="mt-4 text-4xl text-[var(--color-ink)] serif-display">{value}</p>
    </div>
  );
}

function MetricRow({
  title,
  subtitle,
  value,
}: {
  title: string;
  subtitle: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[var(--color-soft-line)] pt-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="truncate text-lg text-[var(--color-ink)] serif-display">{title}</p>
        <p className="truncate text-xs uppercase tracking-[0.16em] text-black/48">{subtitle}</p>
      </div>
      <span className="text-xs uppercase tracking-[0.16em] text-black/52">{value}</span>
    </div>
  );
}

function LabeledInput({
  name,
  label,
  placeholder,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-xs uppercase tracking-[0.16em] text-black/58">
      {label}
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="min-h-11 border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm normal-case tracking-normal text-[var(--color-ink)]"
      />
    </label>
  );
}

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function formatDateInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}
