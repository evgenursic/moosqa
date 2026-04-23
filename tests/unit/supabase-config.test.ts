import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getSupabaseAuthConfig,
  isSupabaseAuthConfigured,
  requireSupabaseAuthConfig,
} from "../../src/lib/supabase/config";

describe("Supabase auth config", () => {
  it("returns null when auth env vars are missing", () => {
    assert.equal(getSupabaseAuthConfig({}), null);
    assert.equal(isSupabaseAuthConfigured({}), false);
  });

  it("uses the publishable key when configured", () => {
    assert.deepEqual(
      getSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: " https://project.supabase.co/ ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " publishable-key ",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "legacy-anon-key",
      }),
      {
        url: "https://project.supabase.co",
        publishableKey: "publishable-key",
      },
    );
  });

  it("falls back to the legacy anon key name for current deployments", () => {
    assert.deepEqual(
      getSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      }),
      {
        url: "https://project.supabase.co",
        publishableKey: "anon-key",
      },
    );
  });

  it("rejects invalid and non-https remote urls", () => {
    assert.equal(
      getSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      }),
      null,
    );
    assert.equal(
      getSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      }),
      null,
    );
  });

  it("allows local Supabase development urls", () => {
    assert.deepEqual(
      getSupabaseAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      }),
      {
        url: "http://localhost:54321",
        publishableKey: "key",
      },
    );
  });

  it("throws a targeted setup error when required config is missing", () => {
    assert.throws(
      () => requireSupabaseAuthConfig({}),
      /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
