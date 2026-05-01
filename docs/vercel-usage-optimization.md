# Vercel Usage Optimization

Last updated: 2026-05-01

## Goal

Reduce Vercel Function Active CPU, invocations, runtime database calls, and request-time external fetching without changing user-facing behavior.

## Current Route Audit

### Public pages

- `/` now reads cached homepage sections, cached search facets, and cached public analytics. It no longer triggers Reddit/feed refresh from the public render path.
- `/browse/[section]` uses cached archive data with a 30 minute revalidation window.
- `/browse/albums` is covered by `/browse/[section]` and uses the same cached archive path.
- `/picks` and `/collections/[slug]` use cached editorial data with a 1 hour revalidation window.
- `/releases/[slug]` uses cached release detail data with a 1 hour revalidation window.
- `/signals/[signal]`, `/platform/[platform]`, `/scene/[scene]`, and `/trending/[genre]` use cached analytics/archive data and no longer force request-time rendering with `connection()`.

### Dynamic pages that should stay dynamic

- `/account` reads Supabase auth cookies and user-specific state.
- `/admin` reads auth/role state and private admin data.
- `/radar` is personalized and auth-dependent.
- `/debug` and `/ops` are secret-gated operational views.

These routes are blocked in `robots.txt` and/or expose `robots: { index: false, follow: false }`.

## API Route Cost Notes

### Higher CPU routes

- `/api/sync`: cron/manual sync, Reddit ingestion, quality enrichment, cache revalidation, optional cache warming. Secret protected.
- `/api/notifications`: digest enqueue/send work. Secret protected.
- `/api/artwork`: public artwork proxy and bounded repair path. Uses persisted/cached release metadata and now has memory rate limiting.
- `/api/analytics` and `/api/vote`: public write endpoints. They still write to the database by design, but no longer add extra DB writes for rate limiting.

### Lower CPU public routes

- `/api/health`: memory rate limited; public summary remains cached.
- `/api/search`, `/api/search/index`, `/api/search/facets`: memory rate limited and cacheable with HTTP cache headers. Search data comes from cached release/index helpers.

## External API Policy

- Public page renders must not call YouTube, Reddit, Bandcamp, MusicBrainz, OpenAI, or arbitrary source metadata fetches.
- YouTube/Reddit metrics on cards come from persisted database fields.
- Missing metrics degrade to stored fallback badge labels.
- External source/artwork metadata refresh belongs in sync, enrichment, repair, or bounded `/api/artwork` behavior, not the main page render path.

## Database Optimization Notes

- Public release lists use selected fields instead of full rows.
- Public list sizes are bounded.
- Common release filters/sorts already have Prisma indexes for `publishedAt`, `releaseType + publishedAt`, `isHidden + publishedAt`, quality, and featured editorial ordering.
- Prisma uses a single-connection `pg` pool per function instance to avoid connection fan-out.
- Public API rate limits that do not need persistent enforcement use memory buckets to avoid one DB write per request.

## Cache Windows

- Homepage sections: 15 minutes.
- Search index/facets: 15 minutes, plus short in-process cache.
- Browse archives: 30 minutes.
- Public analytics archives: 30 minutes.
- Public editorial hub/collections: 1 hour.
- Release details: 1 hour.
- Public health summary: 5 minutes.
- Artwork proxy responses: browser/CDN cache for 1 hour with stale-while-revalidate.

## Vercel Function Settings

`vercel.json` sets `maxDuration` for the highest-risk functions:

- Public lightweight APIs: 5 seconds.
- Artwork proxy: 10 seconds.
- Notifications: 30 seconds.
- Sync/enrichment: 60 seconds.

This prevents accidental long-running public functions while still allowing scheduled jobs enough time to complete.

## How To Verify Impact

1. Deploy to Vercel.
2. In Vercel Usage Dashboard, compare Function Active CPU and Function Invocations against the previous 24 hour period.
3. Check top functions by CPU. Expected reduction should be most visible on `/`, `/browse/[section]`, `/api/health`, `/api/search*`, and bot/crawler traffic to public pages.
4. Confirm `/api/sync` and `/api/notifications` remain low-frequency cron/manual work.
5. Run `npm run smoke:prod` and verify `/api/notifications` without a secret returns `401`.

## Known Limitations

- Vercel serverless memory rate limits are per warm instance, not globally strict.
- Analytics and votes still require DB writes because they are product events.
- `/api/artwork` can still fetch external images when requested; keep this endpoint monitored in Vercel usage if image traffic spikes.
- Public pages can still invoke functions on cache misses or revalidation boundaries, but they should not refresh Reddit/YouTube data directly.
