import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { NotificationJobType, ReleaseType } from "../../src/generated/prisma/enums";
import {
  buildNotificationPreferencePatch,
  getDigestScheduleContext,
  normalizeDigestHourLocal,
  normalizeDigestTimezone,
  selectDigestItems,
} from "../../src/lib/notifications";

describe("notification helpers", () => {
  it("normalizes digest preference inputs without coupling child toggles to the master switch", () => {
    assert.deepEqual(
      buildNotificationPreferencePatch({
        emailNotifications: false,
        dailyDigest: true,
        weeklyDigest: true,
        instantAlerts: true,
        digestTimezone: " Europe/Ljubljana ",
        digestHourLocal: "21",
      }),
      {
        emailNotifications: false,
        dailyDigest: true,
        weeklyDigest: true,
        instantAlerts: true,
        digestTimezone: "Europe/Ljubljana",
        digestHourLocal: 21,
      },
    );
  });

  it("falls back to safe digest timezone and hour defaults", () => {
    assert.equal(normalizeDigestTimezone("Mars/Olympus"), "UTC");
    assert.equal(normalizeDigestHourLocal("99"), 23);
    assert.equal(normalizeDigestHourLocal("-4"), 0);
  });

  it("builds daily and weekly digest windows only when the local send slot is due", () => {
    const monday = new Date("2026-04-20T09:10:00.000Z");
    const tuesday = new Date("2026-04-21T09:10:00.000Z");

    assert.equal(
      getDigestScheduleContext(NotificationJobType.DAILY_DIGEST, "UTC", 9, monday)?.periodKey,
      "daily:2026-04-20",
    );
    assert.equal(
      getDigestScheduleContext(NotificationJobType.WEEKLY_DIGEST, "UTC", 9, monday)?.periodKey,
      "weekly:2026-04-20",
    );
    assert.equal(
      getDigestScheduleContext(NotificationJobType.WEEKLY_DIGEST, "UTC", 9, tuesday),
      null,
    );
    assert.equal(
      getDigestScheduleContext(NotificationJobType.DAILY_DIGEST, "UTC", 8, monday),
      null,
    );
  });

  it("ranks digest items by signal strength and quality", () => {
    const items = selectDigestItems({
      type: NotificationJobType.DAILY_DIGEST,
      signals: {
        followedArtists: ["Laufey"],
        followedLabels: ["Jagjaguwar"],
        savedGenres: ["dream pop"],
      },
      candidates: [
        {
          id: "a",
          slug: "laufey-a",
          title: "Fresh single",
          artistName: "Laufey",
          projectTitle: "Moon Song",
          labelName: "Jagjaguwar",
          genreName: "dream pop",
          releaseType: ReleaseType.SINGLE,
          publishedAt: new Date("2026-04-20T08:00:00.000Z"),
          qualityScore: 82,
          aiSummary: null,
          summary: "A detailed, warm single with strong strings.",
        },
        {
          id: "b",
          slug: "label-b",
          title: "Label pick",
          artistName: "Other Artist",
          projectTitle: "Label Bloom",
          labelName: "Jagjaguwar",
          genreName: "dream pop",
          releaseType: ReleaseType.EP,
          publishedAt: new Date("2026-04-20T08:30:00.000Z"),
          qualityScore: 90,
          aiSummary: null,
          summary: "A lush EP with bright hooks.",
        },
        {
          id: "c",
          slug: "miss-c",
          title: "No signal",
          artistName: "Unknown",
          projectTitle: "No Match",
          labelName: "Elsewhere",
          genreName: "noise rock",
          releaseType: ReleaseType.ALBUM,
          publishedAt: new Date("2026-04-20T09:00:00.000Z"),
          qualityScore: 99,
          aiSummary: null,
          summary: "Should not appear because no signal matches.",
        },
      ],
    });

    assert.equal(items.length, 2);
    assert.equal(items[0]?.slug, "laufey-a");
    assert.deepEqual(items[0]?.matchReasons, ["followed artist", "followed label", "saved genre"]);
    assert.equal(items[1]?.slug, "label-b");
  });
});
