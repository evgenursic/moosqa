import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReleaseType } from "../../src/generated/prisma/enums";
import { normalizeRedditPost, shouldKeepReleaseRecord } from "../../src/lib/reddit";

type RedditPostFixture = Parameters<typeof normalizeRedditPost>[0];

const baseCreatedUtc = 1_713_456_000;

describe("reddit ingest release matching", () => {
  it("keeps FRESH singles", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "fresh1",
        title: "[FRESH] Winter Names - Static Bloom",
        url: "https://winternames.bandcamp.com/track/static-bloom",
      }),
    );

    assert.ok(release);
    assert.equal(release.releaseType, ReleaseType.SINGLE);
    assert.equal(release.artistName, "Winter Names");
    assert.equal(release.projectTitle, "Static Bloom");
  });

  it("keeps FRESH ALBUM posts as albums", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "album1",
        title: "[FRESH ALBUM] Pale Harbor - Glass Weather",
        url: "https://paleharbor.bandcamp.com/album/glass-weather",
      }),
    );

    assert.ok(release);
    assert.equal(release.releaseType, ReleaseType.ALBUM);
  });

  it("keeps FRESH EP posts as EPs", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "ep1",
        title: "[FRESH EP] Meadow Circuit - Low Light",
        url: "https://meadowcircuit.bandcamp.com/album/low-light",
      }),
    );

    assert.ok(release);
    assert.equal(release.releaseType, ReleaseType.EP);
  });

  it("keeps FRESH PERFORMANCE posts as performances", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "perf1",
        title: "[FRESH PERFORMANCE] Silver Room - KEXP Session",
        url: "https://www.youtube.com/watch?v=abc123",
      }),
    );

    assert.ok(release);
    assert.equal(release.releaseType, ReleaseType.PERFORMANCE);
  });

  it("uses the first external selftext URL for Reddit self posts", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "self1",
        title: "[FRESH] The Branches - Window Map",
        url: "https://www.reddit.com/r/indieheads/comments/self1/fresh/",
        selftext: "Listen here: https://thebranches.bandcamp.com/track/window-map",
      }),
    );

    assert.ok(release);
    assert.equal(release.sourceUrl, "https://thebranches.bandcamp.com/track/window-map");
    assert.equal(release.outletName, "Bandcamp");
  });

  it("drops New Music Friday posts even when they look album-like", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "nmf1",
        title: "[FRESH ALBUM] New Music Friday: weekly release thread",
        url: "https://www.reddit.com/r/indieheads/comments/nmf1/new_music_friday/",
        selftext: "A roundup thread.",
      }),
    );

    assert.equal(release, null);
  });

  it("drops moderator-deleted or removed posts", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "removed1",
        title: "[FRESH] Hidden Artist - Hidden Song",
        url: "https://hiddenartist.bandcamp.com/track/hidden-song",
        removed_by_category: "moderator",
      }),
    );

    assert.equal(release, null);
  });

  it("drops Reddit-hosted-only image posts", () => {
    const release = normalizeRedditPost(
      redditPost({
        id: "image1",
        title: "[FRESH] Poster Artist - Poster Song",
        url: "https://i.redd.it/poster.jpg",
      }),
    );

    assert.equal(release, null);
  });

  it("drops discussion and interview posts", () => {
    assert.equal(
      shouldKeepReleaseRecord({
        title: "Discussion: what are you listening to?",
        releaseType: ReleaseType.SINGLE,
        sourceUrl: "https://example.com/song",
        flair: "FRESH",
      }),
      false,
    );
    assert.equal(
      shouldKeepReleaseRecord({
        title: "Artist interview after the new single",
        releaseType: ReleaseType.SINGLE,
        sourceUrl: "https://example.com/interview",
        flair: "FRESH",
      }),
      false,
    );
  });
});

function redditPost(overrides: Partial<RedditPostFixture>): RedditPostFixture {
  return {
    id: "fixture",
    title: "[FRESH] Fixture Artist - Fixture Track",
    created_utc: baseCreatedUtc,
    permalink: "/r/indieheads/comments/fixture/fresh_fixture/",
    url: "https://fixture.bandcamp.com/track/fixture-track",
    thumbnail: "",
    link_flair_text: null,
    selftext: "",
    domain: "fixture.bandcamp.com",
    score: 42,
    num_comments: 7,
    upvote_ratio: 0.97,
    total_awards_received: 0,
    num_crossposts: 0,
    author: "fixture_user",
    is_robot_indexable: true,
    ...overrides,
  };
}
