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
