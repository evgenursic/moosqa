import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_USER_PREFERENCES,
  buildUserProfileSeed,
  normalizeDisplayName,
  normalizeFollowTargetValue,
  normalizeUserEmail,
} from "../../src/lib/user-product";

describe("user product foundations", () => {
  it("normalizes auth profile identity without leaking provider-specific fields", () => {
    assert.deepEqual(
      buildUserProfileSeed({
        id: " user-123 ",
        email: "  MUSIC@EXAMPLE.COM ",
        displayName: "  New   Listener  ",
      }),
      {
        id: "user-123",
        email: "music@example.com",
        displayName: "New Listener",
      },
    );
  });

  it("keeps empty optional profile fields as null", () => {
    assert.equal(normalizeUserEmail(" "), null);
    assert.equal(normalizeDisplayName(" "), null);
  });

  it("normalizes follow targets for idempotent artist, label and genre follows", () => {
    assert.equal(normalizeFollowTargetValue("  Déhd & Friends!! "), "dehd & friends");
    assert.equal(normalizeFollowTargetValue("Dream   Pop"), "dream pop");
    assert.equal(normalizeFollowTargetValue(""), "");
  });

  it("defaults notifications to a low-noise product posture", () => {
    assert.deepEqual(DEFAULT_USER_PREFERENCES, {
      emailNotifications: false,
      dailyDigest: false,
      weeklyDigest: true,
      instantAlerts: false,
      preferredGenres: [],
    });
  });

  it("requires a Supabase auth user id before creating local profile state", () => {
    assert.throws(() => buildUserProfileSeed({ id: " " }), /User id is required/);
  });
});
