import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasYouTubeMetadataSource,
  shouldRefreshYouTubeMetadata,
} from "../../src/lib/youtube-metadata";

describe("youtube metadata refresh helpers", () => {
  const now = new Date("2026-04-24T12:00:00.000Z");

  it("detects reliable youtube metadata sources", () => {
    assert.equal(hasYouTubeMetadataSource({ sourceUrl: "https://youtu.be/example" }), true);
    assert.equal(
      hasYouTubeMetadataSource({ youtubeUrl: "https://www.youtube.com/watch?v=abc123" }),
      true,
    );
    assert.equal(
      hasYouTubeMetadataSource({ youtubeMusicUrl: "https://music.youtube.com/watch?v=abc123" }),
      true,
    );
    assert.equal(hasYouTubeMetadataSource({ sourceUrl: "https://bandcamp.com/album/test" }), false);
  });

  it("refreshes missing youtube metadata once the retry window has passed", () => {
    assert.equal(
      shouldRefreshYouTubeMetadata(
        {
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          youtubeMetadataUpdatedAt: "2026-04-24T11:40:00.000Z",
        },
        now,
      ),
      true,
    );
    assert.equal(
      shouldRefreshYouTubeMetadata(
        {
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          youtubeMetadataUpdatedAt: "2026-04-24T11:50:00.000Z",
        },
        now,
      ),
      false,
    );
  });

  it("refreshes complete youtube metadata weekly instead of every render", () => {
    assert.equal(
      shouldRefreshYouTubeMetadata(
        {
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          youtubeViewCount: 42_800,
          youtubePublishedAt: "2026-04-01T00:00:00.000Z",
          youtubeMetadataUpdatedAt: "2026-04-16T12:00:00.000Z",
        },
        now,
      ),
      true,
    );
    assert.equal(
      shouldRefreshYouTubeMetadata(
        {
          youtubeUrl: "https://www.youtube.com/watch?v=abc123",
          youtubeViewCount: 42_800,
          youtubePublishedAt: "2026-04-01T00:00:00.000Z",
          youtubeMetadataUpdatedAt: "2026-04-23T12:00:00.000Z",
        },
        now,
      ),
      false,
    );
  });
});
