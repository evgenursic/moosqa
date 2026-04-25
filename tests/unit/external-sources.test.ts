import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ReleaseExternalSourceType } from "../../src/generated/prisma/enums";
import {
  formatExternalSourceTypeLabel,
  getVisibleExternalSources,
} from "../../src/lib/external-sources";

describe("external source presentation helpers", () => {
  it("keeps only visible public source links", () => {
    const sources = getVisibleExternalSources([
      {
        id: "visible",
        sourceName: " Example ",
        sourceUrl: "https://example.com/review",
        title: " Review title ",
        summary: " Short editor note ",
        sourceType: ReleaseExternalSourceType.REVIEW,
        isVisible: true,
      },
      {
        id: "hidden",
        sourceName: "Hidden",
        sourceUrl: "https://example.com/hidden",
        title: "Hidden title",
        sourceType: ReleaseExternalSourceType.NEWS,
        isVisible: false,
      },
      {
        id: "invalid",
        sourceName: "Internal",
        sourceUrl: "http://localhost/review",
        title: "Invalid title",
        sourceType: ReleaseExternalSourceType.FEATURE,
        isVisible: true,
      },
    ]);

    assert.equal(sources.length, 1);
    assert.equal(sources[0]?.id, "visible");
    assert.equal(sources[0]?.sourceName, "Example");
    assert.equal(sources[0]?.title, "Review title");
    assert.equal(sources[0]?.summary, "Short editor note");
  });

  it("uses plain public labels for source types", () => {
    assert.equal(formatExternalSourceTypeLabel(ReleaseExternalSourceType.REVIEW), "Review");
    assert.equal(formatExternalSourceTypeLabel(ReleaseExternalSourceType.USER_CURATED), "Curated source");
  });
});
