# Notification runbook

## Scope

This flow covers listener notification preferences, digest job enqueueing, email delivery, and operational inspection.

## Required env

- `CRON_SECRET`
- `RESEND_API_KEY`
- `ALERT_EMAIL_FROM`

Digest delivery uses the signed-in account email stored on `UserProfile.email`. Missing email transport or missing profile email produces skipped jobs rather than hard failures.

## Database changes

Notification delivery adds:

- `UserPreference.digestTimezone`
- `UserPreference.digestHourLocal`
- `NotificationJob`
- `NotificationDeliveryLog`

Current operational path:

1. Run `npm run db:inspect`.
2. If `DATABASE_URL` is unreachable but `DATABASE_RUNTIME_URL` shows the required tables, treat the runtime pooled URL as the active schema target.
3. Run `npm run db:setup`.
4. Re-run `npm run db:inspect` and verify the required tables are present on `DATABASE_RUNTIME_URL`.
5. Only then enable or trust the notification workflow.

Current status:

- the reachable activation target in this environment is the pooled runtime database
- pre-migration fallbacks remain in place for any environment that has not run the setup path yet
- production should be treated as live-ready only after `/api/notifications` returns a protected `200` with the expected secret and `/ops` shows notification job activity

`migrate deploy` is not the primary activation path in this repo right now because the live database was behind earlier auth-era tables and the direct Supabase host is currently unresolved from this environment.

## Runtime flow

1. `/account` stores notification preferences through a protected server action.
2. `GET /api/notifications` is protected by `CRON_SECRET`.
3. The route enqueues due daily and weekly digest jobs, then processes pending jobs.
4. `NotificationJob` provides idempotent per-user per-period dedupe.
5. `NotificationDeliveryLog` records sent, failed, and skipped outcomes for ops review.

## Scheduled execution

- Primary schedule: Vercel Cron in `vercel.json` calls `/api/notifications` daily. Keep this daily unless the Vercel plan explicitly supports more frequent cron schedules.
- Manual retry/debug workflow: `.github/workflows/notifications.yml`

The GitHub workflow intentionally has no scheduled trigger. This avoids GitHub Actions runner-queue cancellations being reported as failed notification runs. Use it manually when Vercel Cron or the endpoint needs verification.

## Ops debugging

Private ops view now includes:

- preference adoption counts
- pending/processing/sent/failed/skipped totals
- recent notification jobs
- recent notification delivery attempts

Recommended first checks:

1. `npm run db:inspect`
2. `/api/notifications` without secret -> expect `401`
3. `/api/notifications?phase=enqueue&mode=all` with secret -> expect `200`
4. `/ops?secret=<DEBUG_SECRET>` -> inspect recent notification job rows
5. If Vercel Cron appears stale, run `.github/workflows/notifications.yml` manually to verify the endpoint outside the Vercel scheduler.

## Safe re-run behavior

- Re-running the same digest window does not create duplicate jobs because of the unique key on `(userId, type, channel, periodKey)`.
- Email sends also use a Resend idempotency key derived from the job id and period key.
- Missing transport config results in `SKIPPED`, not repeated failing sends.
