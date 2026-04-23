import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getAccountAuthMessage,
  isValidAuthEmail,
  normalizeAuthEmail,
  normalizeAuthNextPath,
} from "../../src/lib/auth-flow";

describe("auth flow helpers", () => {
  it("normalizes and validates sign-in email input", () => {
    assert.equal(normalizeAuthEmail("  MUSIC@EXAMPLE.COM "), "music@example.com");
    assert.equal(isValidAuthEmail("music@example.com"), true);
    assert.equal(isValidAuthEmail("not-email"), false);
  });

  it("keeps safe relative callback destinations", () => {
    assert.equal(normalizeAuthNextPath("/account?tab=saved#top"), "/account?tab=saved#top");
    assert.equal(normalizeAuthNextPath("/releases/laufey-1spov0b"), "/releases/laufey-1spov0b");
    assert.equal(normalizeAuthNextPath("/"), "/");
  });

  it("rejects open redirects and internal callback targets", () => {
    assert.equal(normalizeAuthNextPath("https://evil.example/account"), "/account");
    assert.equal(normalizeAuthNextPath("//evil.example/account"), "/account");
    assert.equal(normalizeAuthNextPath("/auth/callback?next=/account"), "/account");
    assert.equal(normalizeAuthNextPath("/api/sync"), "/account");
    assert.equal(normalizeAuthNextPath("\\account"), "/account");
  });

  it("maps account auth query codes to user-facing messages", () => {
    assert.match(String(getAccountAuthMessage("check-email")), /Check your email/);
    assert.equal(getAccountAuthMessage("unknown"), null);
  });
});
