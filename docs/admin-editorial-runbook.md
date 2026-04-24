# Admin and editorial runbook

## Access model

- `/admin` is private and marked `noindex`.
- Access requires a signed-in Supabase user whose `UserProfile.role` is `EDITOR` or `ADMIN`.
- Unconfigured auth shows a setup state instead of a broken page.
- If no `ADMIN` exists yet, `/admin` exposes a one-time bootstrap form gated by `DEBUG_SECRET`.

## Role assignment

- First admin bootstrap:
  - sign in with the account that should become the first admin
  - open `/admin`
  - submit the current `DEBUG_SECRET` plus a short reason
  - MooSQA upgrades that exact signed-in user to `ADMIN` and records an audit row
- Ongoing role changes:
  - only current `ADMIN` users can assign `EDITOR`, `ADMIN`, or revert to `USER`
  - granting `ADMIN` or reverting a user to `USER` requires typing the target email in the confirmation field and providing a short reason
  - every role change writes `UserRoleAssignmentAudit`
  - the last remaining admin cannot demote themselves out of `ADMIN`
- If role changes fail, check:
  - the target user already has a local `UserProfile`
  - the acting user is still `ADMIN`
  - `DEBUG_SECRET` is present only for bootstrap, not routine role edits

## Core uses

- search releases by slug, artist, title, or label
- override public genre, summary, cover URL, and primary source URL
- edit persisted YouTube metadata and official/Bandcamp links when source enrichment needs a manual correction
- hide irrelevant cards without deleting the release row
- feature priority releases with `isFeatured` plus `editorialRank`
- create or edit lightweight editorial collections and attach releases to them
- run a bounded weak-card repair pass from admin after reviewing the repair queue
- publish editor-facing work through `/picks` and `/collections/[slug]`
- inspect recent editorial audit history and weak-card repair candidates

## Release override rules

- overrides replace the public-facing field but preserve the source value in the database
- hidden releases are excluded from:
  - homepage and archive queries
  - release detail fetches
  - sitemap output
  - notification digest selection
  - recommendation candidates
- editorial changes revalidate the homepage, radar, admin surface, and the affected release detail path
- published collections and picks are revalidated through the shared `editorial` tag and public editorial routes

## Operational notes

- use hide only for junk, moderation, or editorial exclusion; prefer overrides for quality correction
- keep summaries short and specific; do not reintroduce generic fallback copy
- use `editorialNotes` for internal reasoning that should survive future repairs
- collections are intentionally lightweight; they are not a full CMS
- run admin-triggered repair in small batches; use the scheduled repair workflow for routine background maintenance

## Debugging

- if `/admin` errors, verify Supabase auth env first
- if actions redirect back to `/account`, confirm the session and `UserProfile.role`
- if a release still appears publicly after a hide, verify revalidation succeeded and re-check the release through `/releases/[slug]`
