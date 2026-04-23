import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractYouTubeViewCountFromHtml } from "../../src/lib/source-metadata";
import {
  formatDetailedUtcTimestamp,
  formatDiscussionShare,
  formatPrimaryReleaseDateLabel,
  formatRedditDateLabel,
  formatYouTubeViewsLabel,
} from "../../src/lib/utils";
import { ReleaseType } from "../../src/generated/prisma/enums";

describe("presentation metadata helpers", () => {
  it("formats published timestamps with weekday, full date, and UTC time", () => {
    const publishedAt = new Date("2026-04-24T14:00:00.000Z");

    assert.equal(
      formatDetailedUtcTimestamp(publishedAt),
      "Friday, April 24, 2026 at 14:00 UTC",
    );
    assert.equal(
      formatRedditDateLabel(publishedAt),
      "Published Friday, April 24, 2026 at 14:00 UTC",
    );
  });

  it("formats youtube views compactly and discussion share cleanly", () => {
    assert.equal(formatYouTubeViewsLabel(24321), "YouTube 24.3K views");
    assert.equal(formatDiscussionShare(120, 30), 20);
    assert.equal(formatDiscussionShare(0, 0), null);
  });

  it("fails safe for invalid or string-based cached date values", () => {
    assert.equal(
      formatRedditDateLabel("2026-04-24T14:00:00.000Z"),
      "Published Friday, April 24, 2026 at 14:00 UTC",
    );
    assert.equal(formatRedditDateLabel("not-a-date"), null);
    assert.equal(
      formatPrimaryReleaseDateLabel(ReleaseType.SINGLE, "2026-04-24T00:00:00.000Z"),
      "Release Friday, April 24, 2026",
    );
  });

  it("extracts youtube view count from source html", () => {
    const html = `
      <html>
        <head>
          <meta itemprop="interactionCount" content="34567" />
          <script type="application/ld+json">
            {"@type":"VideoObject","interactionCount":"34567","name":"Test"}
          </script>
        </head>
      </html>
    `;

    assert.equal(extractYouTubeViewCountFromHtml(html), 34567);
  });
});
