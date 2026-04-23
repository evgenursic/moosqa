import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getRequiredCronSecret,
  isValidRequestSecret,
  readRequestSecret,
} from "../../src/lib/admin-auth";

describe("admin auth helpers", () => {
  it("prefers bearer credentials over query and custom header secrets", () => {
    const request = new Request("https://example.com/api/sync?secret=query-secret", {
      headers: {
        authorization: "Bearer bearer-secret",
        "x-cron-secret": "header-secret",
      },
    });

    assert.equal(readRequestSecret(request, { headerName: "x-cron-secret" }), "bearer-secret");
  });

  it("reads custom secret headers when no bearer or query secret is present", () => {
    const request = new Request("https://example.com/api/sync", {
      headers: {
        "x-cron-secret": "header-secret",
      },
    });

    assert.equal(readRequestSecret(request, { headerName: "x-cron-secret" }), "header-secret");
  });

  it("requires configured cron secrets and validates exact matches", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "expected-secret";

    try {
      assert.equal(getRequiredCronSecret(), "expected-secret");
      assert.equal(isValidRequestSecret("expected-secret", getRequiredCronSecret()), true);
      assert.equal(isValidRequestSecret("wrong-secret", getRequiredCronSecret()), false);
      assert.equal(isValidRequestSecret(null, getRequiredCronSecret()), false);
      assert.equal(isValidRequestSecret("expected-secret", ""), false);
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });
});
