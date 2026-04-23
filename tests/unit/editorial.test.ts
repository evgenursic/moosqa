import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyReleaseEditorialFields, buildVisibleReleaseWhere } from "../../src/lib/editorial";

describe("editorial helpers", () => {
  it("applies release overrides onto the public-facing release fields", () => {
    const release = applyReleaseEditorialFields({
      id: "release-1",
      title: "Original title",
      genreName: "indie pop",
      genreOverride: "dream pop",
      summary: "Original summary",
      summaryOverride: "Editor summary",
      imageUrl: "https://images.example/original.jpg",
      imageUrlOverride: "https://images.example/override.jpg",
      sourceUrl: "https://source.example/original",
      sourceUrlOverride: "https://source.example/override",
    });

    assert.equal(release.genreName, "dream pop");
    assert.equal(release.summary, "Editor summary");
    assert.equal(release.imageUrl, "https://images.example/override.jpg");
    assert.equal(release.sourceUrl, "https://source.example/override");
  });

  it("forces public release queries to exclude hidden cards", () => {
    assert.deepEqual(buildVisibleReleaseWhere({ slug: "visible-release" }), {
      AND: [{ isHidden: false }, { slug: "visible-release" }],
    });
  });
});
