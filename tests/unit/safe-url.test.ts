import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fetchPublicHttpUrl, normalizePublicHttpUrl } from "../../src/lib/safe-url";

describe("safe outbound URLs", () => {
  it("allows normal public http and https URLs", () => {
    assert.equal(normalizePublicHttpUrl("https://bandcamp.com/album/demo"), "https://bandcamp.com/album/demo");
    assert.equal(normalizePublicHttpUrl("http://example.com/path"), "http://example.com/path");
  });

  it("blocks non-http protocols and private host targets", () => {
    const blocked = [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "http://localhost:3000",
      "http://localhost./",
      "http://127.0.0.1",
      "http://2130706433",
      "http://10.0.0.4",
      "http://172.16.10.2",
      "http://192.168.1.20",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://metadata.google.internal/",
    ];

    for (const url of blocked) {
      assert.equal(normalizePublicHttpUrl(url), null, url);
    }
  });

  it("refuses redirects into private targets before following them", async () => {
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(null, {
        status: 302,
        headers: {
          location: "http://127.0.0.1/private",
        },
      });
    }) as typeof fetch;

    try {
      const response = await fetchPublicHttpUrl("https://example.com/start");

      assert.equal(response, null);
      assert.deepEqual(calls, ["https://example.com/start"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
