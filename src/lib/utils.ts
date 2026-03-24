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

export function getDisplaySummary(input: {
  aiSummary: string | null | undefined;
  summary: string | null | undefined;
  artistName?: string | null | undefined;
  projectTitle?: string | null | undefined;
  title?: string | null | undefined;
  releaseType?: ReleaseType | undefined;
  genreName?: string | null | undefined;
}) {
  const normalizedAiSummary = input.aiSummary?.trim();
  if (normalizedAiSummary) {
    return normalizedAiSummary;
  }

  const normalizedSummary = trimText(input.summary, 220);
  if (!normalizedSummary) {
    return buildStaticSummaryFallback(input);
  }

  const loweredSummary = normalizedSummary.toLowerCase();
  if (
    loweredSummary.includes("spotted on r/indieheads") ||
    loweredSummary.includes("synced ")
  ) {
    return buildStaticSummaryFallback(input);
  }

  return normalizedSummary;
}

function buildStaticSummaryFallback(input: {
  artistName?: string | null | undefined;
  projectTitle?: string | null | undefined;
  title?: string | null | undefined;
  releaseType?: ReleaseType | undefined;
  genreName?: string | null | undefined;
}) {
  const subject = input.artistName?.trim() || input.projectTitle?.trim() || input.title?.trim() || "This release";
  const workTitle =
    input.artistName?.trim() && input.projectTitle?.trim()
      ? input.projectTitle.trim()
      : input.title?.trim() || input.projectTitle?.trim() || subject;
  const genre = getDisplayGenre(input.genreName, input.releaseType || ReleaseType.OTHER).toLowerCase();

  if (input.releaseType === ReleaseType.PERFORMANCE || input.releaseType === ReleaseType.LIVE_SESSION) {
    if (workTitle !== subject) {
      return `${subject} brings ${workTitle} into a live frame here, with ${genre} detail pushed closer to the room.`;
    }

    return `${subject} is captured in a live setting here, with ${genre} detail replacing studio polish.`;
  }

  if (input.releaseType === ReleaseType.ALBUM) {
    return `${subject} is front and center on ${workTitle}, shaped around a ${genre} palette rather than a placeholder rollout blurb.`;
  }

  if (input.releaseType === ReleaseType.EP) {
    return `${subject} uses ${workTitle} to sketch a compact ${genre} statement with enough detail to stand on its own.`;
  }

  return `${subject} pushes ${workTitle} forward through a ${genre} angle that still gives the card something concrete to say.`;
}
