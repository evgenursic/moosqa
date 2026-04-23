"use client";

import { createBrowserClient } from "@supabase/ssr";

import { requireSupabaseAuthConfig } from "@/lib/supabase/config";

export function createSupabaseBrowserClient() {
  const { url, publishableKey } = requireSupabaseAuthConfig();

  return createBrowserClient(url, publishableKey);
}
