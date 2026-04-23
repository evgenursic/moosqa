"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { FollowTargetType } from "@/generated/prisma/enums";
import { normalizeAuthNextPath } from "@/lib/auth-flow";
import { isSupabaseAuthConfigured } from "@/lib/supabase/config";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import {
  ensureUserProfile,
  followTargetForUser,
  saveReleaseForUser,
  unfollowTargetForUser,
  unsaveReleaseForUser,
} from "@/lib/user-product";

export async function saveReleaseAction(formData: FormData) {
  const returnPath = readReturnPath(formData);
  const releaseId = readRequiredString(formData, "releaseId");
  const user = await requireActionUser(returnPath);

  await saveReleaseForUser(user.id, releaseId);
  revalidateAndReturn(returnPath);
}

export async function unsaveReleaseAction(formData: FormData) {
  const returnPath = readReturnPath(formData);
  const releaseId = readRequiredString(formData, "releaseId");
  const user = await requireActionUser(returnPath);

  await unsaveReleaseForUser(user.id, releaseId);
  revalidateAndReturn(returnPath);
}

export async function followReleaseTargetAction(formData: FormData) {
  const returnPath = readReturnPath(formData);
  const targetType = readFollowTargetType(formData);
  const targetValue = readRequiredString(formData, "targetValue");
  const user = await requireActionUser(returnPath);

  await followTargetForUser(user.id, targetType, targetValue);
  revalidateAndReturn(returnPath);
}

export async function unfollowReleaseTargetAction(formData: FormData) {
  const returnPath = readReturnPath(formData);
  const targetType = readFollowTargetType(formData);
  const targetValue = readRequiredString(formData, "targetValue");
  const user = await requireActionUser(returnPath);

  await unfollowTargetForUser(user.id, targetType, targetValue);
  revalidateAndReturn(returnPath);
}

async function requireActionUser(returnPath: string) {
  if (!isSupabaseAuthConfigured()) {
    redirect(`/account?auth=unconfigured&next=${encodeURIComponent(returnPath)}`);
  }

  const authState = await getSupabaseServerUser();

  if (!authState.user) {
    redirect(`/account?next=${encodeURIComponent(returnPath)}`);
  }

  await ensureUserProfile({
    id: authState.user.id,
    email: authState.user.email,
    displayName: getDisplayName(authState.user.user_metadata),
  });

  return authState.user;
}

function readReturnPath(formData: FormData) {
  return normalizeAuthNextPath(formData.get("returnPath"), "/");
}

function readRequiredString(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

function readFollowTargetType(formData: FormData) {
  const value = formData.get("targetType");

  if (value === FollowTargetType.ARTIST || value === FollowTargetType.LABEL) {
    return value;
  }

  throw new Error("Unsupported follow target type.");
}

function revalidateAndReturn(returnPath: string): never {
  revalidatePath(new URL(returnPath, "https://moosqa.local").pathname);
  redirect(returnPath);
}

function getDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const displayName = record.display_name || record.full_name || record.name;

  return typeof displayName === "string" ? displayName : null;
}
