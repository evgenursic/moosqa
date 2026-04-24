# Recommendation scoring notes

## Current goal

Recommendations are a pragmatic radar extension, not a full ranking system. The current layer is designed to stay explainable and cheap to run.

## Inputs

- followed artists
- followed labels
- followed genres
- artists and labels inferred from recently saved releases
- genres inferred from recently saved releases
- recency
- release type
- release quality score
- public engagement signals:
  - opens
  - listen clicks
  - shares
  - positive reactions
  - Reddit upvotes
  - Reddit comments
  - persisted YouTube views
- editorial boost through featured state and editorial rank
- diversity penalty for repeated artist, label, and genre slots inside the same radar list

## Current behavior

- only recent visible releases are eligible
- already-saved releases are excluded
- hidden releases are excluded
- editorial overrides are applied before scoring
- weak low-signal items are dropped instead of filling the list with noise
- each recommendation returns a short reason list for UI explainability
- save-derived artist and label affinity can surface relevant releases even when the user has not explicitly followed them yet
- final ranking is greedy and diversity-aware, so one strong artist does not monopolize the entire radar column

## Tuning expectations

- followed artist is the strongest signal
- followed label is secondary
- followed genre is useful, but weaker than artist and label intent
- saved artist, label, and genre affinity are useful but weaker than explicit follows
- editorial boost should surface meaningful picks without overpowering user signals
- recency should help discovery, not bury stronger matches
- album and EP bonuses are modest format nudges, not hard preferences
- aggregate product, Reddit, and YouTube traction should help break ties, not become the primary ranking driver
- YouTube views must come from persisted enrichment metadata, never from live card or radar rendering

## Next evolution path

- blend notification eligibility into scoring
- add lightweight per-user exposure decay once recommendation impressions are stored explicitly
- incorporate published collection membership as a softer editorial prior if it proves useful
- add click/save feedback loops before considering heavier ranking logic
