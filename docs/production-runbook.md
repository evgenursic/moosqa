# MooSQA Production Runbook

## Deploy

1. Merge or push to `main`.
2. Wait for the Vercel production deployment to finish.
3. Verify `https://moosqa-ci4e.vercel.app/api/health?scope=ready`.
4. Run `npm run smoke:prod`.
5. Check `/ops?secret=<DEBUG_SECRET>` for workflow freshness, sync health, alerts, and production smoke status.

## Rollback

1. Promote the last known good Vercel deployment.
2. Run `npm run smoke:prod` against production.
3. Check `/api/health?scope=ready` and `/api/health`.
4. Confirm GitHub workflow status reporting recovers in `/ops`.

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
- `npm run smoke:prod`
- Known release URL works: `/releases/laufey-1spov0b?from=%2F%23latest`
- Homepage release-card return restores `/#latest` without duplicate hashes.
- `/ops` shows recent successful workflow reports.
