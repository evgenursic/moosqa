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

Apply the Prisma schema change before enabling the workflow in production.

## Runtime flow

1. `/account` stores notification preferences through a protected server action.
2. `GET /api/notifications` is protected by `CRON_SECRET`.
3. The route enqueues due daily and weekly digest jobs, then processes pending jobs.
4. `NotificationJob` provides idempotent per-user per-period dedupe.
5. `NotificationDeliveryLog` records sent, failed, and skipped outcomes for ops review.

## GitHub Actions

- Workflow: `.github/workflows/notifications.yml`
- Recommended cadence: hourly

The workflow reports status to `/api/internal/workflow-status` under the `notifications` workflow name so ops staleness alerts can detect missed runs.

## Ops debugging

Private ops view now includes:

- preference adoption counts
- pending/processing/sent/failed/skipped totals
- recent notification jobs
- recent notification delivery attempts

## Safe re-run behavior

- Re-running the same digest window does not create duplicate jobs because of the unique key on `(userId, type, channel, periodKey)`.
- Email sends also use a Resend idempotency key derived from the job id and period key.
- Missing transport config results in `SKIPPED`, not repeated failing sends.
