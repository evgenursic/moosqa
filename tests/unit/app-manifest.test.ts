import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_MANIFEST_DESCRIPTION, buildAppManifest } from "../../src/lib/app-manifest";

describe("app manifest", () => {
  it("describes MooSQA as an installable music radar", () => {
    const manifest = buildAppManifest("https://example.com/path?ignored=true");

    assert.equal(manifest.name, "MooSQA | Music Radar");
    assert.equal(manifest.short_name, "MooSQA");
    assert.equal(manifest.description, APP_MANIFEST_DESCRIPTION);
    assert.equal(manifest.id, "https://example.com");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.scope, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#526eaa");
  });

  it("declares generated app icons alongside the favicon", () => {
    const manifest = buildAppManifest("https://example.com");

    assert.deepEqual(manifest.icons, [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ]);
  });
});
