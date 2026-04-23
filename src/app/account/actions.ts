"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  isValidAuthEmail,
  normalizeAuthEmail,
  normalizeAuthNextPath,
} from "@/lib/auth-flow";
import {
  buildNotificationPreferencePatch,
  isValidDigestTimezone,
  updateUserNotificationPreferences,
} from "@/lib/notifications";
import { getSiteUrl } from "@/lib/site";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient, getSupabaseServerUser } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/lib/user-product";

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

export async function updateNotificationPreferencesAction(formData: FormData) {
  const user = await requireAccountUser();
  const digestTimezone = readOptionalString(formData, "digestTimezone");

  if (digestTimezone && !isValidDigestTimezone(digestTimezone)) {
    redirect("/account?notifications=invalid-timezone#notifications");
  }

  const preferences = buildNotificationPreferencePatch({
    emailNotifications: readBooleanField(formData, "emailNotifications"),
    dailyDigest: readBooleanField(formData, "dailyDigest"),
    weeklyDigest: readBooleanField(formData, "weeklyDigest"),
    instantAlerts: readBooleanField(formData, "instantAlerts"),
    digestTimezone,
    digestHourLocal: readOptionalString(formData, "digestHourLocal"),
  });

  await updateUserNotificationPreferences(user.id, preferences);
  revalidatePath("/account");
  revalidatePath("/radar");
  revalidateTag("ops-dashboard", "max");
  redirect("/account?notifications=saved#notifications");
}

async function requireAccountUser() {
  if (!isSupabaseAuthConfigured()) {
    redirect("/account?auth=unconfigured");
  }

  const authState = await getSupabaseServerUser();
  if (!authState.user) {
    redirect("/account");
  }

  await ensureUserProfile({
    id: authState.user.id,
    email: authState.user.email,
    displayName: getDisplayName(authState.user.user_metadata),
  });

  return authState.user;
}

function readBooleanField(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
