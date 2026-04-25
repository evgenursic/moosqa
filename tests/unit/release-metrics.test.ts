import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildBestReleaseMetricSignal } from "../../src/lib/release-metrics";

describe("release metric badge helpers", () => {
  it("prefers persisted YouTube views over Reddit and Bandcamp signals", () => {
    assert.deepEqual(
      buildBestReleaseMetricSignal({
        youtubeViewCount: 12400,
        redditUpvotes: 84,
        redditComments: 16,
        bandcampSupporterCount: 320,
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
        redditUpvotes: "84",
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
