import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildBestReleaseMetricSignal,
  getPopularityMaxForReleases,
  getPopularityRaw,
} from "../../src/lib/release-metrics";

describe("release metric badge helpers", () => {
  it("prefers Reddit upvotes over YouTube and Bandcamp signals", () => {
    assert.deepEqual(
      buildBestReleaseMetricSignal({
        sourceUrl: "https://www.reddit.com/r/indieheads/comments/test",
        youtubeViewCount: 12400,
        redditUpvotes: 84,
        redditComments: 16,
        bandcampSupporterCount: 320,
      }),
      {
        kind: "reddit-upvotes",
        label: "84 upvotes",
        ariaLabel: "84 Reddit upvotes",
      },
    );
  });

  it("shows relative popularity when a visible set max is available", () => {
    assert.deepEqual(
      buildBestReleaseMetricSignal({
        sourceUrl: "https://www.reddit.com/r/indieheads/comments/test",
        youtubeViewCount: 12400,
        redditUpvotes: 84,
        redditComments: 16,
        popularityMaxRaw: 200,
        bandcampSupporterCount: 320,
      }),
      {
        kind: "popularity",
        label: "50% popular",
        ariaLabel: "50% popular relative to this MooSQA set",
      },
    );
  });

  it("prefers YouTube views for YouTube-first source releases", () => {
    assert.deepEqual(
      buildBestReleaseMetricSignal({
        sourceUrl: "https://youtu.be/cCBh_X-tz6M",
        youtubeViewCount: 12400,
        redditUpvotes: 84,
        redditComments: 16,
      }),
      {
        kind: "youtube",
        label: "12.4K views",
        ariaLabel: "12.4K YouTube views",
      },
    );
  });

  it("coerces string metric values before deciding the primary signal", () => {
    assert.equal(
      buildBestReleaseMetricSignal({
        youtubeViewCount: "2,103",
        redditUpvotes: "0",
        redditComments: "16",
      })?.label,
      "2.1K views",
    );
  });

  it("falls back to Reddit upvotes and comments without showing fake zeroes", () => {
    assert.equal(
      buildBestReleaseMetricSignal({
        youtubeViewCount: null,
        redditUpvotes: 84,
        redditComments: 16,
      })?.label,
      "84 upvotes",
    );
    assert.equal(
      buildBestReleaseMetricSignal({
        youtubeViewCount: 0,
        redditUpvotes: 0,
        redditComments: 16,
      })?.label,
      "16 comments",
    );
    assert.equal(buildBestReleaseMetricSignal({ youtubeViewCount: 0, redditUpvotes: 0, redditComments: 0 }), null);
  });

  it("derives popularity max from safe Reddit response values", () => {
    assert.equal(getPopularityRaw({ score: "84", commentCount: "16" }), 100);
    assert.equal(getPopularityRaw({ redditUpvotes: -4, redditComments: Number.NaN }), 0);
    assert.equal(
      getPopularityMaxForReleases([
        { score: 84, commentCount: 16 },
        { redditUpvotes: "160", redditComments: "40" },
        { score: 0, commentCount: 0 },
      ]),
      200,
    );
    assert.equal(getPopularityMaxForReleases([{ score: 0, commentCount: 0 }]), null);
  });

  it("uses a safe non-numeric fallback when no trusted metric exists", () => {
    assert.deepEqual(
      buildBestReleaseMetricSignal({
        youtubeViewCount: 0,
        redditUpvotes: -4,
        redditComments: Number.NaN,
        fallbackLabel: "Album",
      }),
      {
        kind: "fallback",
        label: "Album",
        ariaLabel: "Album",
      },
    );
  });

  it("supports future trusted Bandcamp supporter or follower counts", () => {
    assert.equal(
      buildBestReleaseMetricSignal({
        bandcampSupporterCount: 320,
        bandcampFollowerCount: 990,
      })?.label,
      "320 supporters",
    );
    assert.equal(
      buildBestReleaseMetricSignal({
        bandcampFollowerCount: 990,
      })?.label,
      "990 followers",
    );
  });
});
