import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildReleaseSitemapEntry,
  buildStaticSitemapEntries,
  buildTrendingGenreSitemapEntries,
  SITEMAP_RELEASE_LIMIT,
} from "../../src/lib/sitemap";

describe("sitemap entries", () => {
  it("includes the public discovery archives users can land on directly", () => {
    const entries = buildStaticSitemapEntries("https://example.com", new Date("2026-04-21T00:00:00Z"));
    const urls = entries.map((entry) => entry.url);

    assert.equal(new Set(urls).size, urls.length);
    assert.ok(urls.includes("https://example.com"));
    assert.ok(urls.includes("https://example.com/browse/latest"));
    assert.ok(urls.includes("https://example.com/browse/top-engaged?view=trending"));
    assert.ok(urls.includes("https://example.com/browse/albums"));
    assert.ok(urls.includes("https://example.com/platform/youtube-music"));
    assert.ok(urls.includes("https://example.com/signals/opened?window=today"));
    assert.ok(urls.includes("https://example.com/signals/listened"));
    assert.ok(urls.includes("https://example.com/scene/night-drive"));
  });

  it("dedupes trending genre URLs after slugification", () => {
    const entries = buildTrendingGenreSitemapEntries(
      "https://example.com",
      ["Dream Pop", "dream-pop", "Post-Punk"],
      new Date("2026-04-21T00:00:00Z"),
    );

    assert.deepEqual(
      entries.map((entry) => entry.url),
      [
        "https://example.com/trending/dream-pop",
        "https://example.com/trending/post-punk",
      ],
    );
  });

  it("keeps release canonicals clean and only includes valid absolute artwork", () => {
    const entry = buildReleaseSitemapEntry("https://example.com", {
      slug: "artist-song",
      updatedAt: new Date("2026-04-21T10:00:00Z"),
      publishedAt: new Date("2026-04-20T10:00:00Z"),
      imageUrl: "https://cdn.example.com/cover.jpg",
      thumbnailUrl: "not-a-url",
    });

    assert.equal(entry.url, "https://example.com/releases/artist-song");
    assert.deepEqual(entry.images, ["https://cdn.example.com/cover.jpg"]);
  });

  it("documents the production release sitemap cap", () => {
    assert.equal(SITEMAP_RELEASE_LIMIT, 2000);
  });
});
