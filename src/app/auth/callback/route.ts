import { NextResponse } from "next/server";

import { normalizeAuthNextPath } from "@/lib/auth-flow";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = normalizeAuthNextPath(requestUrl.searchParams.get("next"));

  if (!isSupabaseAuthConfigured()) {
    return redirectToAccount(requestUrl, "unconfigured");
  }

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return redirectToAccount(requestUrl, "callback-failed");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Supabase auth callback failed.", error);
    return redirectToAccount(requestUrl, "callback-failed");
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}

function redirectToAccount(requestUrl: URL, code: string) {
  const redirectUrl = new URL("/account", requestUrl.origin);
  redirectUrl.searchParams.set("auth", code);
  return NextResponse.redirect(redirectUrl);
}
