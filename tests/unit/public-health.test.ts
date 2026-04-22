import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPublicHealthPayload, buildPublicReadinessPayload } from "../../src/lib/public-health";

describe("public health payload", () => {
  it("returns a database-independent readiness payload", () => {
    assert.deepEqual(buildPublicReadinessPayload(new Date("2026-04-22T05:02:00.000Z")), {
      ok: true,
      status: "ready",
      generatedAt: "2026-04-22T05:02:00.000Z",
      checks: {
        application: "ready",
      },
    });
  });

  it("returns a sanitized public health summary", () => {
    const payload = buildPublicHealthPayload(
      {
        sync: {
          level: "healthy",
          label: "Fresh",
          message: "Fresh Reddit releases are syncing on schedule.",
          isRunning: false,
          isStale: false,
          lastSource: "api",
          lastAttemptAt: new Date("2026-04-22T05:00:00.000Z"),
          lastSuccessAt: new Date("2026-04-22T05:00:01.000Z"),
          lastFailureAt: new Date("2026-04-22T04:00:00.000Z"),
          lastDurationMs: 1234,
          consecutiveFailures: 0,
          lastError: "internal failure detail",
          lastResult: {
            scanned: 10,
            matched: 9,
            created: 1,
            updated: 2,
            removed: 0,
            sanitized: 0,
            enriched: 3,
            qualityChecked: 4,
            qualityImproved: 1,
            syncedAt: new Date("2026-04-22T05:00:01.000Z").toISOString(),
          },
        },
        openAlertCount: 0,
        lastAlertDelivery: {
          channel: "DISCORD",
          success: true,
          createdAt: new Date("2026-04-22T05:01:00.000Z"),
          destination: "private-webhook.example",
        },
      },
      new Date("2026-04-22T05:02:00.000Z"),
    );

    assert.equal(payload.ok, true);
    assert.equal(payload.status, "healthy");
    assert.equal(payload.sync.lastSuccessAt, "2026-04-22T05:00:01.000Z");
    assert.equal(payload.lastAlertDelivery?.attemptedAt, "2026-04-22T05:01:00.000Z");

    const serialized = JSON.stringify(payload);
    assert.equal(serialized.includes("internal failure detail"), false);
    assert.equal(serialized.includes("private-webhook.example"), false);
    assert.equal(serialized.includes("lastResult"), false);
  });

  it("surfaces open alerts as a warning without exposing alert internals", () => {
    const payload = buildPublicHealthPayload(
      {
        sync: {
          level: "healthy",
          label: "Fresh",
          message: "Fresh Reddit releases are syncing on schedule.",
          isRunning: false,
          isStale: false,
          lastSource: null,
          lastAttemptAt: null,
          lastSuccessAt: null,
          lastFailureAt: null,
          lastDurationMs: null,
          consecutiveFailures: 0,
          lastError: null,
          lastResult: null,
        },
        openAlertCount: 2,
        lastAlertDelivery: null,
      },
      new Date("2026-04-22T05:02:00.000Z"),
    );

    assert.equal(payload.ok, false);
    assert.equal(payload.status, "warning");
    assert.deepEqual(payload.alerts, { open: 2 });
  });
});
