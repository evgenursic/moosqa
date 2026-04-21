import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReleaseType } from "../../src/generated/prisma/enums";
import {
  assessReleaseQuality,
  getReleaseQualityIssuePriority,
  getReleaseQualityIssues,
} from "../../src/lib/release-quality";

describe("release quality repair priority", () => {
  it("reports actionable weak-card issue labels", () => {
    const issues = getReleaseQualityIssues({
      releaseType: ReleaseType.ALBUM,
      genreConfidence: 42,
      publishedAt: new Date(),
      summaryQualityScore: 55,
    }).map((issue) => issue.label);

    assert.deepEqual(issues, [
      "Missing artwork",
      "Missing genre",
      "Low genre confidence",
      "Missing listen/buy links",
      "Missing release date",
      "Low summary quality",
    ]);
  });

  it("prioritizes missing core metadata over partial cleanup", () => {
    const urgent = assessReleaseQuality({
      releaseType: ReleaseType.ALBUM,
      genreConfidence: 35,
      publishedAt: new Date(),
      summaryQualityScore: 50,
    });
    const partial = assessReleaseQuality({
      releaseType: ReleaseType.ALBUM,
      genreName: "dream pop / shoegaze",
      genreConfidence: 88,
      imageUrl: "https://example.com/cover.jpg",
      bandcampUrl: "https://artist.bandcamp.com/album/example",
      releaseDate: new Date(),
      publishedAt: new Date(),
      summaryQualityScore: 90,
    });

    assert.ok(urgent.priorityScore > partial.priorityScore);
    assert.ok(getReleaseQualityIssuePriority({
      releaseType: ReleaseType.ALBUM,
      genreConfidence: 35,
      publishedAt: new Date(),
      summaryQualityScore: 50,
    }) > getReleaseQualityIssuePriority({
      releaseType: ReleaseType.ALBUM,
      genreName: "dream pop / shoegaze",
      genreConfidence: 88,
      imageUrl: "https://example.com/cover.jpg",
      bandcampUrl: "https://artist.bandcamp.com/album/example",
      releaseDate: new Date(),
      publishedAt: new Date(),
      summaryQualityScore: 90,
    }));
  });
});
