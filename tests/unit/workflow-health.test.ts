import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatWorkflowAgeMinutes,
  getWorkflowStaleness,
  parseWorkflowDetails,
} from "../../src/lib/workflow-health";

describe("workflow health helpers", () => {
  it("parses endpoint details into display-safe metrics", () => {
    const details = parseWorkflowDetails(
      "scanned=90, matched=12, qualityImproved=4, syncedAt=2026-04-22T05:00:00.000Z",
    );

    assert.deepEqual(details, [
      { key: "scanned", label: "scanned", value: "90" },
      { key: "matched", label: "matched", value: "12" },
      { key: "qualityImproved", label: "improved", value: "4" },
      { key: "syncedAt", label: "synced", value: "2026-04-22T05:00:00.000Z" },
    ]);
  });

  it("ignores malformed detail fragments", () => {
    assert.deepEqual(parseWorkflowDetails("queued=8, bad fragment, =empty, <script>=x"), [
      { key: "queued", label: "queued", value: "8" },
    ]);
  });

  it("uses the daily Vercel cron grace window for sync workflow health", () => {
    const now = new Date("2026-04-22T06:00:00.000Z");
    const stale = getWorkflowStaleness("sync", new Date("2026-04-20T23:00:00.000Z"), now);
    const fresh = getWorkflowStaleness("sync", new Date("2026-04-21T06:30:00.000Z"), now);

    assert.equal(stale?.isStale, true);
    assert.equal(formatWorkflowAgeMinutes(stale?.ageMs ?? null), "1860 min");
    assert.equal(fresh?.isStale, false);
  });

  it("uses daily grace windows for quality and repair workflows", () => {
    const now = new Date("2026-04-22T06:00:00.000Z");

    assert.equal(
      getWorkflowStaleness("quality", new Date("2026-04-21T06:15:00.000Z"), now)?.isStale,
      false,
    );
    assert.equal(
      getWorkflowStaleness("repair", new Date("2026-04-20T23:30:00.000Z"), now)?.isStale,
      true,
    );
  });

  it("does not flag unknown or manual-only workflows", () => {
    assert.equal(getWorkflowStaleness("manual-debug", null), null);
    assert.equal(getWorkflowStaleness("production-smoke", null), null);
    assert.equal(getWorkflowStaleness("notifications", null), null);
  });
});
