"use server";

import { redirect } from "next/navigation";

import {
  isValidAuthEmail,
  normalizeAuthEmail,
  normalizeAuthNextPath,
} from "@/lib/auth-flow";
import { getSiteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requestSignInLink(formData: FormData) {
  if (!isSupabaseAuthConfigured()) {
    redirect("/account?auth=unconfigured");
  }

  const email = normalizeAuthEmail(formData.get("email"));
  const next = normalizeAuthNextPath(formData.get("next"));

  if (!isValidAuthEmail(email)) {
    redirect("/account?auth=invalid-email");
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", getSiteUrl());
  redirectTo.searchParams.set("next", next);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo.toString(),
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("Supabase sign-in link request failed.", error);
    redirect("/account?auth=send-failed");
  }

  redirect("/account?auth=check-email");
}

export async function signOut() {
  if (isSupabaseAuthConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase sign-out failed.", error);
    }
  }

  redirect("/account?signedOut=1");
}
