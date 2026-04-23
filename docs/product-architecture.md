# MooSQA Product Architecture Notes

## User State Foundation

MooSQA keeps public discovery anonymous by default. User-aware features are layered on top of the release feed through a small local profile model keyed by the Supabase Auth user id.

Current foundation:

- `UserProfile.id` stores the Supabase Auth user id.
- `UserPreference` stores notification and personalization defaults.
- `UserSavedRelease` stores bookmarked releases with a unique `(userId, releaseId)` key.
- `UserFollow` stores artist, label, and genre follows with a normalized unique target key.

This keeps saved items and follows queryable without denormalizing artists or labels too early. Artist and label names still come from release metadata until there is enough editorial need for canonical artist/label tables.

## Auth Integration Sequence

1. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
2. Keep `NEXT_PUBLIC_SUPABASE_ANON_KEY` only as a compatibility fallback for older deployments.
3. Use the Supabase SSR client boundary in `src/lib/supabase/`.
4. `/account` provides email-link sign-in, sign-out, and a setup-safe account shell.
5. `/auth/callback` exchanges Supabase auth codes and only redirects to sanitized local paths.
6. On first valid session, call `ensureUserProfile()` with the Supabase user id and safe profile fields.
7. Protect future `/radar` data at the data-access layer, not only in UI.

## Product Sequencing

The next safe slices are:

1. Save release and follow artist/label actions.
2. Personal radar page using saved releases and follows.
3. Notification preference editing.
4. Digest job and delivery idempotency.

## Security Notes

- Do not expose Supabase service-role credentials to client code.
- Do not use unverified cookie session data for authorization decisions; validate the Supabase user before user-owned writes.
- Keep user writes behind server actions or route handlers that verify the session.
- Treat save/follow/notification actions like public APIs: validate input, check ownership, and keep mutations idempotent.
- Internal editorial/admin tooling should remain separate from user account features and continue using scoped protection.
