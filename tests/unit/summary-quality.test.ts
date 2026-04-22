import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldRegenerateAiSummary } from "../../src/lib/ai-summary";
import {
  buildSummaryAudit,
  scoreSummaryQuality,
} from "../../src/lib/summary-quality";

describe("summary quality audit", () => {
  it("keeps concrete editorial blurbs above the weak-card threshold", () => {
    const score = scoreSummaryQuality({
      summary:
        "A KEXP room take pulls the guitar haze close, letting the chorus land with a more exposed live feel.",
      artistName: "Fixture Artist",
      projectTitle: "Fixture Song",
      title: "Fixture Artist - Fixture Song",
    });

    assert.ok(score >= 72);
  });

  it("penalizes abstract fallback templates that make cards feel repetitive", () => {
    const score = scoreSummaryQuality({
      summary:
        "The strongest detail is how guitar texture rubs against its central tension, leaving the song with a memorable silhouette.",
      artistName: "Fixture Artist",
      projectTitle: "Fixture Song",
      title: "Fixture Artist - Fixture Song",
    });

    assert.ok(score < 72);
    assert.equal(shouldRegenerateAiSummary("The album gets a steady center of gravity from guitar texture."), true);
  });

  it("groups repeated summary scaffolds for the dashboard audit", () => {
    const rows = [
      summaryRow("one", "First", "The set gets a steady center of gravity from room sound."),
      summaryRow("two", "Second", "The album gets a steady center of gravity from guitar texture."),
      summaryRow("three", "Third", "The EP gets a steady center of gravity from hazy layers."),
    ];
    const audit = buildSummaryAudit(rows);

    assert.equal(audit.repetitive, 3);
    assert.equal(audit.repeatedPatterns.length, 1);
    assert.deepEqual(
      audit.flaggedCards.map((row) => row.slug),
      ["one", "two", "three"],
    );
  });
});

function summaryRow(slug: string, projectTitle: string, aiSummary: string) {
  return {
    id: slug,
    slug,
    title: `Fixture Artist - ${projectTitle}`,
    artistName: "Fixture Artist",
    projectTitle,
    aiSummary,
    publishedAt: new Date("2026-04-22T00:00:00Z"),
  };
}
