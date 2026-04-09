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

export function formatReleaseTypeLabel(releaseType: ReleaseType) {
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "Live performance";
  }

  if (releaseType === ReleaseType.SINGLE) {
    return "Single release";
  }

  if (releaseType === ReleaseType.ALBUM) {
    return "Album release";
  }

  if (releaseType === ReleaseType.EP) {
    return "EP release";
  }

  return releaseType.replace("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatPrimaryReleaseDateLabel(
  releaseType: ReleaseType,
  releaseDate: Date | null | undefined,
) {
  if (!releaseDate) {
    return null;
  }

  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return `Performance ${formatPubDate(releaseDate)}`;
  }

  return `Release ${formatPubDate(releaseDate)}`;
}

export function formatContextualReleaseDateLabel(
  releaseType: ReleaseType,
  releaseDate: Date | null | undefined,
  outletName: string | null | undefined,
) {
  if (!releaseDate) {
    return null;
  }

  const outlet = (outletName || "").trim().toLowerCase();
  if (outlet === "youtube") {
    return `YouTube ${formatPubDate(releaseDate)}`;
  }

  if (outlet === "youtube music") {
    return `YouTube Music ${formatPubDate(releaseDate)}`;
  }

  if (outlet === "bandcamp") {
    return `Bandcamp ${formatPubDate(releaseDate)}`;
  }

  return formatPrimaryReleaseDateLabel(releaseType, releaseDate);
}

export function formatRedditDateLabel(publishedAt: Date | null | undefined) {
  if (!publishedAt) {
    return null;
  }

  return `Reddit ${formatPubDate(publishedAt)}`;
}

export function getDisplayGenre(
  genreName: string | null | undefined,
  releaseType: ReleaseType,
) {
  const normalizedGenre = genreName?.trim() || null;
  if (normalizedGenre && isMeaningfulDisplayGenre(normalizedGenre)) {
    const prefix = getDisplayReleasePrefix(releaseType);
    return prefix ? `${prefix} / ${normalizedGenre}` : normalizedGenre;
  }

  return getFallbackReleaseLabel(releaseType);
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

function getDisplayReleasePrefix(releaseType: ReleaseType) {
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "Live performance";
  }

  if (releaseType === ReleaseType.SINGLE) {
    return "Single release";
  }

  return null;
}

function getFallbackReleaseLabel(releaseType: ReleaseType) {
  return formatReleaseTypeLabel(releaseType);
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
  if (normalizedAiSummary && !mentionsReleaseIdentity(normalizedAiSummary, input)) {
    return normalizedAiSummary;
  }

  const normalizedSummary = trimText(input.summary, 220);
  if (!normalizedSummary) {
    return buildStaticSummaryFallback(input);
  }

  const loweredSummary = normalizedSummary.toLowerCase();
  if (
    loweredSummary.includes("spotted on r/indieheads") ||
    loweredSummary.includes("synced ") ||
    mentionsReleaseIdentity(normalizedSummary, input)
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
  const genre = getSummaryGenreLabel(input.genreName, input.releaseType || ReleaseType.OTHER).toLowerCase();
  const texture = inferFallbackTexture(genre, input.releaseType || ReleaseType.OTHER);
  const mood = inferFallbackMood(genre, input.releaseType || ReleaseType.OTHER);

  if (input.releaseType === ReleaseType.PERFORMANCE || input.releaseType === ReleaseType.LIVE_SESSION) {
    return `The live take keeps ${texture} close to the room, with ${mood} detail replacing studio polish.`;
  }

  if (input.releaseType === ReleaseType.ALBUM) {
    return `This album leans into ${genre}, with ${texture} and ${mood} doing most of the scene-setting.`;
  }

  if (input.releaseType === ReleaseType.EP) {
    return `This EP sketches a compact ${genre} frame, letting ${texture} carry the weight.`;
  }

  return `The single leans on ${texture}, with ${mood} giving its ${genre} shape a more defined contour.`;
}

function mentionsReleaseIdentity(
  value: string,
  input: {
    artistName?: string | null | undefined;
    projectTitle?: string | null | undefined;
    title?: string | null | undefined;
  },
) {
  const normalizedValue = normalizeIdentityText(value);
  const candidates = [input.artistName, input.projectTitle, input.title]
    .map((candidate) => normalizeIdentityText(candidate || ""))
    .filter((candidate) => candidate.length >= 4);

  return candidates.some((candidate) => normalizedValue.includes(candidate));
}

function normalizeIdentityText(value: string) {
  return decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFallbackTexture(genre: string, releaseType: ReleaseType) {
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "room sound";
  }

  if (genre.includes("dream") || genre.includes("shoegaze")) {
    return "hazy layers";
  }

  if (genre.includes("folk") || genre.includes("americana")) {
    return "acoustic detail";
  }

  if (genre.includes("synth") || genre.includes("electronic")) {
    return "electronic texture";
  }

  if (genre.includes("punk") || genre.includes("post-punk")) {
    return "ragged momentum";
  }

  if (genre.includes("ambient") || genre.includes("drone")) {
    return "slow-moving atmosphere";
  }

  return "the arrangement";
}

function inferFallbackMood(genre: string, releaseType: ReleaseType) {
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "closer-mic";
  }

  if (genre.includes("dream") || genre.includes("shoegaze")) {
    return "dreamy";
  }

  if (genre.includes("slowcore") || genre.includes("ambient")) {
    return "slow-burn";
  }

  if (genre.includes("punk") || genre.includes("hardcore")) {
    return "urgent";
  }

  if (genre.includes("folk") || genre.includes("americana")) {
    return "earthbound";
  }

  if (genre.includes("synth") || genre.includes("electronic")) {
    return "futurist";
  }

  return "tonal";
}

function getSummaryGenreLabel(
  genreName: string | null | undefined,
  releaseType: ReleaseType,
) {
  const normalizedGenre = genreName?.trim() || null;
  if (normalizedGenre && isMeaningfulDisplayGenre(normalizedGenre)) {
    return normalizedGenre;
  }

  return getFallbackReleaseLabel(releaseType);
}
