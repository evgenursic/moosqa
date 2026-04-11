"use client";

import {
  safeLocalStorageGet,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "@/lib/browser-storage";

type TrackableAction =
  | "OPEN"
  | "LISTEN_CLICK"
  | "VOTE"
  | "SHARE"
  | "REACTION_POSITIVE"
  | "REACTION_NEGATIVE";

type AnalyticsPayload = {
  releaseId?: string | null;
  action: TrackableAction;
  platform?: string | null;
  href?: string | null;
  sourcePath?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEVICE_STORAGE_KEY = "moosqa:device-key";

export function getClientDeviceKey() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = safeLocalStorageGet(DEVICE_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  safeLocalStorageSet(DEVICE_STORAGE_KEY, nextValue);
  return nextValue;
}

export function trackClientAnalyticsEvent(payload: AnalyticsPayload) {
  if (typeof window === "undefined") {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    sourcePath: payload.sourcePath || `${window.location.pathname}${window.location.search}${window.location.hash}`,
    deviceKey: getClientDeviceKey(),
  });

  if ("sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/analytics", blob);
    return;
  }

  void fetch("/api/analytics", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function rememberScrollPosition(targetHref?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const key = buildScrollStorageKey(targetHref);
  safeSessionStorageSet(key, String(window.scrollY));
}

export function restoreScrollPositionForCurrentPage() {
  if (typeof window === "undefined") {
    return false;
  }

  const key = buildScrollStorageKey(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  const rawValue = safeSessionStorageGet(key);
  if (!rawValue) {
    return false;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    safeSessionStorageRemove(key);
    return false;
  }

  window.requestAnimationFrame(() => {
    window.scrollTo({ top: parsed, behavior: "auto" });
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: parsed, behavior: "auto" });
    });
  });
  safeSessionStorageRemove(key);
  return true;
}

function buildScrollStorageKey(targetHref?: string | null) {
  const rawValue = targetHref?.trim()
    || (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : "/");

  return `moosqa:scroll:${rawValue}`;
}
