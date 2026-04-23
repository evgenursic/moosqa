# Recommendation scoring notes

## Current goal

Recommendations are a pragmatic radar extension, not a full ranking system. The current layer is designed to stay explainable and cheap to run.

## Inputs

- followed artists
- followed labels
- genres inferred from recently saved releases
- recency
- release quality score
- public engagement signals:
  - opens
  - listen clicks
  - shares
  - positive reactions
- editorial boost through featured state and editorial rank

## Current behavior

- only recent visible releases are eligible
- already-saved releases are excluded
- hidden releases are excluded
- editorial overrides are applied before scoring
- weak low-signal items are dropped instead of filling the list with noise
- each recommendation returns a short reason list for UI explainability

## Tuning expectations

- followed artist is the strongest signal
- followed label is secondary
- saved-genre affinity is useful but weaker
- editorial boost should surface meaningful picks without overpowering user signals
- recency should help discovery, not bury stronger matches

## Next evolution path

- blend notification eligibility into scoring
- add lightweight decay on repeated exposure
- incorporate collection membership or editor picks as a softer prior
- add click/save feedback loops before considering heavier ranking logic
