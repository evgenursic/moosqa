import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildCanonicalYouTubeWatchUrl,
  extractYouTubeVideoId,
  sanitizeYouTubeVideoId,
} from "@/lib/youtube-video";

describe("youtube video helpers", () => {
  it("extracts video ids from common YouTube URL shapes", () => {
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/watch?v=abc_123-XYZ"), "abc_123-XYZ");
    assert.equal(extractYouTubeVideoId("https://youtu.be/abc_123-XYZ?si=test"), "abc_123-XYZ");
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/live/abc_123-XYZ"), "abc_123-XYZ");
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/shorts/abc_123-XYZ"), "abc_123-XYZ");
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/abc_123-XYZ"), "abc_123-XYZ");
  });

  it("rejects invalid or non-YouTube ids", () => {
    assert.equal(extractYouTubeVideoId("https://example.com/watch?v=abc_123-XYZ"), null);
    assert.equal(sanitizeYouTubeVideoId("bad id"), null);
    assert.equal(buildCanonicalYouTubeWatchUrl("bad id"), null);
  });
});
