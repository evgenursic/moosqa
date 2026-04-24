import assert from "node:assert/strict";
import test from "node:test";

import { FollowTargetType, ReleaseType } from "@/generated/prisma/enums";
import {
  buildRecommendationSignals,
  scoreRecommendationCandidate,
  selectDiverseRecommendations,
} from "@/lib/recommendations";

test("recommendation scoring prefers strong follow and save signals", () => {
  const signals = buildRecommendationSignals({
    follows: [
      {
        targetType: FollowTargetType.ARTIST,
        targetValue: "Laufey",
      },
    ],
    savedReleases: [
      {
        artistName: "Laufey",
        labelName: "AWAL",
        genreName: "Chamber pop",
        genreOverride: null,
      },
      {
        artistName: "Laufey",
        labelName: "AWAL",
        genreName: "Chamber pop",
        genreOverride: null,
      },
    ],
  });

  const recommendation = scoreRecommendationCandidate(
    {
      id: "release-1",
      slug: "laufey-example",
      title: "Example",
      artistName: "Laufey",
      projectTitle: "A Matter of Time",
      releaseType: ReleaseType.ALBUM,
      labelName: "AWAL",
      genreName: "Chamber pop",
      genreOverride: null,
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      qualityScore: 84,
      score: 80,
      youtubeViewCount: 120_000,
      openCount: 28,
      shareCount: 5,
      listenClickCount: 9,
      positiveReactionCount: 6,
      commentCount: 14,
      isFeatured: true,
      editorialRank: 6,
    },
    signals,
  );

  assert.ok(recommendation);
  assert.equal(recommendation?.reasons.includes("followed artist"), true);
  assert.equal(recommendation?.reasons.includes("saved artist lane"), true);
  assert.equal(recommendation?.score > 500, true);
});

test("recommendation scoring uses genre follows and external traction without requiring runtime fetches", () => {
  const signals = buildRecommendationSignals({
    follows: [
      {
        targetType: FollowTargetType.GENRE,
        targetValue: "Dream pop",
      },
    ],
    savedReleases: [],
  });

  const recommendation = scoreRecommendationCandidate(
    {
      id: "release-genre",
      slug: "dream-pop-example",
      title: "Example",
      artistName: "New Artist",
      projectTitle: "New Album",
      releaseType: ReleaseType.EP,
      labelName: null,
      genreName: "Dream pop",
      genreOverride: null,
      publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      qualityScore: 76,
      score: 38,
      youtubeViewCount: 52_000,
      openCount: 6,
      shareCount: 0,
      listenClickCount: 3,
      positiveReactionCount: 1,
      commentCount: 11,
      isFeatured: false,
      editorialRank: 0,
    },
    signals,
  );

  assert.ok(recommendation);
  assert.equal(recommendation?.reasons.includes("followed genre"), true);
  assert.equal(recommendation?.reasons.includes("Reddit traction"), true);
  assert.equal(recommendation?.reasons.includes("YouTube traction"), true);
});

test("recommendation diversity avoids repeating the same artist when a strong alternative exists", () => {
  const selected = selectDiverseRecommendations(
    [
      {
        id: "1",
        slug: "alpha",
        title: "Alpha",
        artistName: "Artist A",
        projectTitle: null,
        labelName: "Label 1",
        genreName: "Dream pop",
        publishedAt: new Date("2026-04-23T08:00:00.000Z"),
        reasons: ["followed artist"],
        score: 340,
      },
      {
        id: "2",
        slug: "beta",
        title: "Beta",
        artistName: "Artist A",
        projectTitle: null,
        labelName: "Label 1",
        genreName: "Dream pop",
        publishedAt: new Date("2026-04-23T07:00:00.000Z"),
        reasons: ["reader traction"],
        score: 320,
      },
      {
        id: "3",
        slug: "gamma",
        title: "Gamma",
        artistName: "Artist B",
        projectTitle: null,
        labelName: "Label 2",
        genreName: "Art pop",
        publishedAt: new Date("2026-04-23T06:00:00.000Z"),
        reasons: ["saved genre"],
        score: 255,
      },
    ],
    2,
  );

  assert.deepEqual(
    selected.map((entry) => entry.slug),
    ["alpha", "gamma"],
  );
});
