import assert from "node:assert/strict";
import test from "node:test";

import { FollowTargetType } from "@/generated/prisma/enums";
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
      labelName: "AWAL",
      genreName: "Chamber pop",
      genreOverride: null,
      publishedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      qualityScore: 84,
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
