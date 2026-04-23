# Admin and editorial runbook

## Access model

- `/admin` is private and marked `noindex`.
- Access requires a signed-in Supabase user whose `UserProfile.role` is `EDITOR` or `ADMIN`.
- Unconfigured auth shows a setup state instead of a broken page.

## Core uses

- search releases by slug, artist, title, or label
- override public genre, summary, cover URL, and primary source URL
- hide irrelevant cards without deleting the release row
- feature priority releases with `isFeatured` plus `editorialRank`
- create lightweight editorial collections and attach releases to them
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

## Operational notes

- use hide only for junk, moderation, or editorial exclusion; prefer overrides for quality correction
- keep summaries short and specific; do not reintroduce generic fallback copy
- use `editorialNotes` for internal reasoning that should survive future repairs
- collections are intentionally lightweight; they are not a full CMS

## Debugging

- if `/admin` errors, verify Supabase auth env first
- if actions redirect back to `/account`, confirm the session and `UserProfile.role`
- if a release still appears publicly after a hide, verify revalidation succeeded and re-check the release through `/releases/[slug]`
