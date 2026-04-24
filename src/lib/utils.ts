import { clsx, type ClassValue } from "clsx";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ReleaseType } from "@/generated/prisma/enums";

const UTC_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

const UTC_COMPACT_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const UTC_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

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

export function formatPubDate(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return "Date unavailable";
  }

  return format(safeDate, "MMM dd, yyyy");
}

export function formatDetailedUtcDate(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return "Date unavailable";
  }

  return UTC_DATE_ONLY_FORMATTER.format(safeDate);
}

export function formatDetailedUtcTimestamp(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return "Date unavailable";
  }

  return `${formatDetailedUtcDate(safeDate)} at ${UTC_TIME_FORMATTER.format(safeDate)} UTC`;
}

export function formatRelative(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return "Unknown time";
  }

  return formatDistanceToNowStrict(safeDate, { addSuffix: true });
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
  releaseDate: Date | string | null | undefined,
) {
  const safeDate = coerceDateValue(releaseDate);
  if (!safeDate) {
    return null;
  }

  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return `Performance ${formatReleaseMoment(safeDate)}`;
  }

  return `Release ${formatReleaseMoment(safeDate)}`;
}

export function formatContextualReleaseDateLabel(
  releaseType: ReleaseType,
  releaseDate: Date | string | null | undefined,
  outletName: string | null | undefined,
) {
  const safeDate = coerceDateValue(releaseDate);
  if (!safeDate) {
    return null;
  }

  const outlet = (outletName || "").trim().toLowerCase();
  if (outlet === "youtube") {
    return `YouTube ${formatReleaseMoment(safeDate)}`;
  }

  if (outlet === "youtube music") {
    return `YouTube Music ${formatReleaseMoment(safeDate)}`;
  }

  if (outlet === "bandcamp") {
    return `Bandcamp ${formatReleaseMoment(safeDate)}`;
  }

  return formatPrimaryReleaseDateLabel(releaseType, safeDate);
}

export function formatRedditDateLabel(publishedAt: Date | string | null | undefined) {
  const safeDate = coerceDateValue(publishedAt);
  if (!safeDate) {
    return null;
  }

  return `Published ${formatDetailedUtcTimestamp(safeDate)}`;
}

export function formatYouTubeViewsLabel(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return `YouTube ${COMPACT_NUMBER_FORMATTER.format(Math.round(value))} views`;
}

export function formatCompactWholeCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return COMPACT_NUMBER_FORMATTER.format(Math.round(value));
}

export function formatCompactUtcDate(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return null;
  }

  return UTC_COMPACT_DATE_FORMATTER.format(safeDate);
}

export function formatWholeCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return WHOLE_NUMBER_FORMATTER.format(Math.max(0, Math.round(value)));
}

export function formatDiscussionShare(score: number | null | undefined, comments: number | null | undefined) {
  const safeScore = Math.max(0, Math.round(score ?? 0));
  const safeComments = Math.max(0, Math.round(comments ?? 0));
  const total = safeScore + safeComments;

  if (total <= 0) {
    return null;
  }

  return Math.round((safeComments / total) * 100);
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
  const seed = hashSummaryValue(
    [
      input.artistName || "",
      input.projectTitle || "",
      input.title || "",
      input.releaseType || "",
      genre,
      texture,
      mood,
    ].join("|"),
  );

  if (input.releaseType === ReleaseType.PERFORMANCE || input.releaseType === ReleaseType.LIVE_SESSION) {
    return chooseSummaryVariant(seed, [
      `The live setting puts ${texture} close enough to the room for its ${mood} edge to come through plainly.`,
      `${texture} does most of the talking here, while the live frame leaves the ${mood} character unvarnished.`,
      `What carries this performance is how ${texture} and its ${mood} pull stay exposed without studio smoothing.`,
    ]);
  }

  if (input.releaseType === ReleaseType.ALBUM) {
    return chooseSummaryVariant(seed, [
      `This album works inside a ${genre} frame, with ${texture} giving the broader ${mood} atmosphere real shape.`,
      `${texture} keeps the album coherent, while its ${mood} tone stops the larger set from blurring together.`,
      `The strongest thread here is how ${texture} carries a ${mood} ${genre} identity across the full set.`,
    ]);
  }

  if (input.releaseType === ReleaseType.EP) {
    return chooseSummaryVariant(seed, [
      `This EP keeps its footprint compact, letting ${texture} define the release's ${mood} ${genre} center.`,
      `${texture} gives the EP a clear spine, while the ${mood} tone keeps the shorter runtime purposeful.`,
      `The EP moves quickly, but ${texture} still gives its ${mood} ${genre} outline enough weight to hold.`,
    ]);
  }

  return chooseSummaryVariant(seed, [
    `${texture} gives the single its clearest profile, while the ${mood} tone shapes how that ${genre} frame lands.`,
    `What defines the single is the balance between ${texture} and a ${mood} ${genre} atmosphere.`,
    `${texture} keeps the release grounded, and the ${mood} ${genre} pull does the rest of the scene-setting.`,
  ]);
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

function chooseSummaryVariant(seed: number, variants: string[]) {
  return variants[Math.abs(seed) % variants.length];
}

function hashSummaryValue(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash;
}

function formatReleaseMoment(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return "Date unavailable";
  }

  return hasMeaningfulUtcTime(date)
    ? formatDetailedUtcTimestamp(safeDate)
    : formatDetailedUtcDate(safeDate);
}

function hasMeaningfulUtcTime(date: Date | string | null | undefined) {
  const safeDate = coerceDateValue(date);
  if (!safeDate) {
    return false;
  }

  return safeDate.getUTCHours() !== 0 || safeDate.getUTCMinutes() !== 0;
}

function coerceDateValue(date: Date | string | null | undefined) {
  if (!date) {
    return null;
  }

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof date !== "string" || !date.trim()) {
    return null;
  }

  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
