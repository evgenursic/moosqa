import assert from "node:assert/strict";
import { describe, it } from "node:test";

import robots from "../../src/app/robots";

describe("robots policy", () => {
  it("allows public discovery pages while excluding API and private dashboards", () => {
    const policy = robots();
    const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules;

    assert.equal(rule.allow, "/");
    assert.deepEqual(rule.disallow, ["/api/", "/debug", "/ops"]);
    assert.match(String(policy.sitemap), /\/sitemap\.xml$/);
  });
});
