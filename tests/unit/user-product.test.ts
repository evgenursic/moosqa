import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_USER_PREFERENCES,
  buildUserProfileSeed,
  buildReleaseFollowTargets,
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

  it("builds release follow targets without empty or duplicate entries", () => {
    assert.deepEqual(
      buildReleaseFollowTargets({
        artistName: "  Dehd  ",
        labelName: "DEHD",
      }),
      [
        {
          targetType: "ARTIST",
          targetValue: "Dehd",
          normalizedValue: "dehd",
        },
        {
          targetType: "LABEL",
          targetValue: "DEHD",
          normalizedValue: "dehd",
        },
      ],
    );
    assert.deepEqual(buildReleaseFollowTargets({ artistName: "", labelName: " " }), []);
  });

  it("defaults notifications to a low-noise product posture", () => {
    assert.deepEqual(DEFAULT_USER_PREFERENCES, {
      emailNotifications: false,
      dailyDigest: false,
      weeklyDigest: true,
      instantAlerts: false,
      digestTimezone: "UTC",
      digestHourLocal: 9,
      preferredGenres: [],
    });
  });

  it("requires a Supabase auth user id before creating local profile state", () => {
    assert.throws(() => buildUserProfileSeed({ id: " " }), /User id is required/);
  });
});
