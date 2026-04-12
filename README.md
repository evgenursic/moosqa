# MooSQA Music Radar

Editorial music discovery app that pulls fresh posts from `r/indieheads`, enriches them with artwork and metadata, and lets listeners rate releases from 1 to 100.

## Stack

- `Next.js 16`
- `Prisma`
- `Supabase Postgres`
- `Vercel`

## What already works

- automatic ingest from `https://www.reddit.com/r/indieheads/.json`
- filtering to keep music releases and live performances
- homepage with oversized latest cards and grouped follow-up sections
- release detail pages
- anonymous voting with device cookie tracking
- metadata enrichment for artwork, genre, label, release links, and release dates
- one-line AI summary with OpenAI or local fallback logic
- search and listening links
- `GET /api/sync` endpoint for cron-based refresh

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file:

```bash
copy .env.example .env
```

3. Fill in your Supabase connection strings:

- `DATABASE_URL`: direct Postgres connection string for Prisma CLI
- `DATABASE_RUNTIME_URL`: pooled Postgres connection string for the deployed app
- `CRON_SECRET`: long random secret
- `DEBUG_SECRET`: separate long random secret for private debug and reprocess endpoints
- `DISCORD_ALERT_WEBHOOK_URL`: optional Discord webhook for production alerts
- `SLACK_ALERT_WEBHOOK_URL`: optional Slack webhook for production alerts
- `NEXT_PUBLIC_SITE_URL`: local or deployed site URL

4. Push the schema and generate Prisma client:

```bash
npm run db:setup
```

5. Start development:

```bash
npm run dev
```

6. Open `http://localhost:3000`.

## Production setup: Vercel + Supabase

### 1. Create Supabase project

Create one Postgres project in Supabase and copy:

- direct connection string into `DATABASE_URL`
- pooled connection string into `DATABASE_RUNTIME_URL`

### 2. Prepare the database

Run once against the Supabase database:

```bash
npm run db:setup
```

This uses `prisma db push` and `prisma generate`.

### 3. Import the repo into Vercel

Import this GitHub repository into Vercel and add these environment variables:

- `DATABASE_URL`
- `DATABASE_RUNTIME_URL`
- `CRON_SECRET`
- `DEBUG_SECRET`
- `DISCORD_ALERT_WEBHOOK_URL` (optional)
- `SLACK_ALERT_WEBHOOK_URL` (optional)
- `NEXT_PUBLIC_SITE_URL`
- `OPENAI_API_KEY` (optional)
- `OPENAI_MODEL` (optional, defaults to `gpt-5-nano`)

### 4. Deploy

Vercel runs the app as a full Next.js project. Production syncing is designed around GitHub Actions because Vercel Hobby cron is limited.

The sync endpoint accepts:

- Vercel Cron `Authorization: Bearer <CRON_SECRET>`
- manual query usage: `/api/sync?secret=<CRON_SECRET>`

The private debug reprocess endpoint accepts:

- `Authorization: Bearer <DEBUG_SECRET>`
- manual query usage: `/api/debug/reprocess?secret=<DEBUG_SECRET>`

### 5. GitHub Actions refresh

Add the same `CRON_SECRET` as a GitHub Actions repository secret. The repository includes:

- a frequent Reddit sync workflow
- a separate quality enrichment workflow
- a repair workflow for weak cards
- workflow status reporting back into the app ops page

## Notes on hosting choice

`GitHub Pages` is not the right host for this app. MooSQA uses dynamic server rendering, route handlers, cookies, voting, search, and sync logic that require a server runtime.

For the fastest launch path:

- use `Vercel` for the app
- use `Supabase` for Postgres
- keep `Prisma`

## Public beta recommendation

Do not overbuild before launch.

Ship this first:

- latest release feed
- release detail page
- anonymous ratings
- search
- genre badges

Add later only if users ask for it:

- genre filter
- newsletter signup
- registration and saved favorites

## Suggested next product steps

1. Launch a public beta and collect real usage.
2. Add genre filtering on top of the current dataset.
3. Add simple analytics so you can see what people open, rate, and click.
4. Add newsletter signup only after you see repeat visitors.
5. Add registration only when you need favorites, follow lists, or abuse protection.

## When traffic grows

When the project outgrows managed serverless hosting, move to:

- `Hetzner` if you want better price/performance and are comfortable managing infra
- `Hostinger VPS` if you want a simpler panel-based setup

At that point the usual upgrade path is:

- VPS for app runtime
- managed Postgres or self-hosted Postgres
- background cron worker for sync jobs
- object storage / CDN if assets grow
