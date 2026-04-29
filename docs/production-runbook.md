# MooSQA Production Runbook

## Deploy

1. Merge or push to `main`.
2. Wait for the Vercel production deployment to finish.
3. Run `npm run db:inspect` before assuming the direct Supabase host is usable from the current environment.
4. If `DATABASE_URL` is unresolved but `DATABASE_RUNTIME_URL` reports the required tables, use `npm run db:setup` as the activation path for schema changes.
5. Re-run `npm run db:inspect` and confirm the runtime target still reports the required tables.
6. Verify `https://moosqa-ci4e.vercel.app/api/health?scope=ready`.
7. Run `npm run smoke:prod`.
8. Check `/ops?secret=<DEBUG_SECRET>` for workflow freshness, sync health, alerts, latest production smoke status, and notification delivery totals.

## Database Activation

Current operational expectation:

- `DATABASE_URL` may not resolve from this workstation or CI environment.
- `DATABASE_RUNTIME_URL` is the canonical reachable target for `db push` plus hardening in this repo.
- `npm run db:setup` is the safe reproducible path because it attempts the direct target first, then falls back to the runtime pooled target and re-applies grants.

Use this sequence for schema-bearing deploys:

1. `npm run db:inspect`
2. `npm run db:setup`
3. `npm run db:inspect`
4. `npm run build`
5. deploy and smoke test

Do not claim migration success unless `db:inspect` shows the required tables on the runtime target.

## Rollback

1. Promote the last known good Vercel deployment.
2. Run `npm run smoke:prod` against production.
3. Check `/api/health?scope=ready` and `/api/health`.
4. Confirm workflow status reporting recovers in `/ops`.
5. If a schema-bearing change partially applied, re-run `npm run db:inspect` before making additional DB changes.

## Failed Sync

1. Check the `sync` workflow run and `/ops`.
2. Confirm `CRON_SECRET` is present in GitHub Actions and Vercel.
3. Run the workflow manually from GitHub Actions.
4. If Reddit is unavailable, wait for the next scheduled run; the app should keep serving the latest stored releases.
5. If cards are stale or weak after sync recovers, run the repair workflow.

## Failed Enrichment Or Repair

1. Check `quality` and `repair` workflow rows in `/ops`.
2. Confirm `OPENAI_API_KEY` is present if AI summaries are expected.
3. Confirm outbound metadata fetches are not blocked by source websites.
4. Run `Repair weak cards` manually.
5. Use `/debug?secret=<DEBUG_SECRET>` to inspect weak-card reasons before broad code changes.

## YouTube Metadata Refresh

- Public cards read stored `Release.youtubeViewCount` and `Release.youtubePublishedAt`; they must not fetch YouTube data during page or card rendering.
- `Release.youtubeMetadataUpdatedAt` records the last pipeline/manual attempt to refresh YouTube metadata.
- Front-card metric badges use persisted public signals only. YouTube-source releases prefer YouTube views when available; other cards prefer a relative Popularity percentage from Reddit response (`round((upvotes + comments) / max(upvotes + comments in the current visible set) * 100)`), then Reddit upvotes, YouTube views, Reddit comments, trusted/editor-entered Bandcamp supporter/follower counts, and a small release-type fallback when no numeric metric exists. Treat this as a MooSQA/Reddit-relative signal, not universal internet popularity.
- Bandcamp supporter/follower fields are manual/editorial overrides unless a reliable provider is added later. Do not add runtime Bandcamp scraping to page renders.
- Sync, enrichment, artwork repair, and admin overrides may update the stored YouTube fields. Complete metadata is considered fresh for about one week; incomplete metadata retries after a short cooldown to avoid quota or source-fetch storms. Admin coverage includes YouTube gap counts so recent YouTube-linked releases without view counts are visible.
- If source metadata fetching fails or YouTube data is missing, preserve the last known stored values and keep cards renderable with omitted metrics.
- If YouTube extraction behavior changes, fix the metadata parser or repair/enrichment job first, then run the normal smoke flow.

## External Reviews And Sources

- Release detail pages can show curated `ReleaseExternalSource` links under "Reviews & sources".
- Sources are editorial/admin controlled: review, feature, interview, news, official, or curated source.
- Public pages show only visible rows with valid public HTTP(S) URLs.
- The first implementation is not a crawler. Do not add Google scraping, broad review-site scraping, hidden browser scraping, or copyrighted full-text ingestion.
- Use short editor-written summaries or trusted metadata only, and keep internal/hidden sources private.

## Failed Notification Processing

1. Check `/ops?secret=<DEBUG_SECRET>` for queued, sent, failed, and skipped notification totals.
2. Verify `CRON_SECRET`, `RESEND_API_KEY`, and `ALERT_EMAIL_FROM` are present in Vercel.
3. Hit `/api/notifications` without a secret and confirm it still returns `401`.
4. Trigger `/api/notifications?phase=enqueue&mode=all` with a valid bearer or query secret.
5. If jobs remain skipped, inspect missing profile emails, disabled preferences, or transport configuration before retrying.
6. Re-run `npm run db:inspect` if the route unexpectedly returns `503`.

## GitHub Actions Cancellation Noise

- `Production smoke test` runs on push and manual dispatch only; it is not scheduled hourly because GitHub scheduled jobs can be cancelled before the first step during runner-queue delays.
- `Notification digests` are scheduled by daily Vercel Cron and the GitHub workflow is manual-only for endpoint verification. Do not use an hourly Vercel cron on Hobby-tier projects; it can block deployment.
- If a GitHub workflow is cancelled before any step starts, treat it as CI scheduler noise unless `/ops`, `/api/health`, or endpoint-level checks also show a product failure.

## Secret Rotation

Rotate these after any credential exposure, provider incident, teammate offboarding, or suspicious activity:

- `DATABASE_URL`
- `DATABASE_RUNTIME_URL`
- `CRON_SECRET`
- `DEBUG_SECRET`
- `OPENAI_API_KEY`
- `DISCORD_ALERT_WEBHOOK_URL`
- `SLACK_ALERT_WEBHOOK_URL`
- `RESEND_API_KEY`
- `ALERT_EMAIL_FROM`
- `ALERT_EMAIL_TO`

Rotation order:

1. Create new values in the provider.
2. Update Vercel environment variables and mark secret values as sensitive.
3. Update GitHub Actions secrets, especially `CRON_SECRET`.
4. Redeploy production.
5. Run `npm run smoke:prod`.
6. Manually trigger `Sync Reddit feed`, `Quality enrichment`, `Repair weak cards`, and `Production smoke test`.
7. Revoke the old values after the new values are verified.

## Security Checks

- Protected cron/internal endpoints must fail closed when `CRON_SECRET` is missing.
- Debug pages and debug APIs must fail closed when `DEBUG_SECRET` is missing.
- Never expose database URLs, API keys, webhooks, or debug secrets in client components.
- Keep source/artwork metadata fetches limited to public HTTP(S) URLs.
- Keep `/api/`, `/debug`, and `/ops` excluded from robots indexing.

## Launch Checklist

- `npm run lint`
- `npm run test:unit`
- `npm run build`
- `npm run db:inspect`
- `npm run smoke:prod`
- Known release URL works: `/releases/laufey-1spov0b?from=%2F%23latest`
- Homepage release-card return restores `/#latest` without duplicate hashes.
- `/ops` shows recent successful workflow reports.
- `/api/notifications` returns `401` without secret and `200` with secret.
- `/admin` resolves to sign-in-required or access-denied instead of a server error.
