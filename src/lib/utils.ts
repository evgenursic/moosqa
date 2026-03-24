import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { ReleaseType } from "@/generated/prisma/enums";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function trimText(value: string | null | undefined, maxLength = 220) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export function formatPubDate(date: Date) {
  if (isToday(date)) {
    return `Today, ${format(date, "HH:mm")}`;
  }

  if (isYesterday(date)) {
    return `Yesterday, ${format(date, "HH:mm")}`;
  }

  return format(date, "MMM dd, yyyy");
}

export function formatRelative(date: Date) {
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function formatScore(score: number) {
  return `${Math.round(score)}%`;
}

export function getDisplayGenre(
  genreName: string | null | undefined,
  releaseType: ReleaseType,
) {
  const normalizedGenre = genreName?.trim() || null;
  if (normalizedGenre && isMeaningfulDisplayGenre(normalizedGenre)) {
    return normalizedGenre;
  }

  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "Live / Session";
  }

  if (releaseType === ReleaseType.ALBUM || releaseType === ReleaseType.EP || releaseType === ReleaseType.SINGLE) {
    return "Indie / Alternative";
  }

  return "Alternative";
}

function isMeaningfulDisplayGenre(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.startsWith("http") ||
    normalized.includes("schema.org") ||
    normalized === "https:" ||
    normalized === "http:" ||
    normalized === "musicrecording" ||
    normalized === "singlerelease" ||
    normalized === "albumrelease" ||
    normalized === "eprelease"
  ) {
    return false;
  }

  return true;
}

export function getDisplaySummary(
  aiSummary: string | null | undefined,
  summary: string | null | undefined,
) {
  const normalizedAiSummary = aiSummary?.trim();
  if (normalizedAiSummary) {
    return normalizedAiSummary;
  }

  const normalizedSummary = trimText(summary, 220);
  if (!normalizedSummary) {
    return "Summary coming soon.";
  }

  const loweredSummary = normalizedSummary.toLowerCase();
  if (
    loweredSummary.includes("spotted on r/indieheads") ||
    loweredSummary.includes("synced ")
  ) {
    return "Summary coming soon.";
  }

  return normalizedSummary;
}
