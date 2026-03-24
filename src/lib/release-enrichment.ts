import { ReleaseType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { fetchMusicMetadata, type MusicMetadata } from "@/lib/musicbrainz";
import { detectPlatform } from "@/lib/listening-links";
import { resolveSourceMetadata } from "@/lib/source-metadata";

type EnrichableRelease = Awaited<ReturnType<typeof prisma.release.findMany>>[number];

export async function enrichRecentReleases(limit = 8) {
  const latest = await prisma.release.findMany({
    orderBy: { publishedAt: "desc" },
    take: Math.max(limit * 4, 24),
  });

  const wantsAi = Boolean(process.env.OPENAI_API_KEY);
  const candidates = latest
    .filter((release) => needsEnrichment(release, wantsAi))
    .sort((left, right) => {
      const priorityDelta =
        scoreEnrichmentPriority(right, wantsAi) - scoreEnrichmentPriority(left, wantsAi);

      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      return right.publishedAt.getTime() - left.publishedAt.getTime();
    })
    .slice(0, limit);

  let enriched = 0;

  for (const release of candidates) {
    const metadata = await buildReleaseEnrichment(release);
    await prisma.release.update({
      where: { id: release.id },
      data: {
        ...metadata,
        metadataEnrichedAt: new Date(),
      },
    });
    enriched += 1;
  }

  return enriched;
}

function needsEnrichment(release: EnrichableRelease, wantsAi: boolean) {
  if (!release.imageUrl && !release.thumbnailUrl) {
    return true;
  }

  if (!isMeaningfulStoredGenre(release.genreName)) {
    return true;
  }

  if (!release.metadataEnrichedAt) {
    return true;
  }

  const lastAttemptMs = Date.now() - release.metadataEnrichedAt.getTime();
  const criticalRetryAfterMs = 1000 * 60 * 15;
  const retryAfterMs = 1000 * 60 * 60 * 24 * 7;
  const isCriticalStale = lastAttemptMs > criticalRetryAfterMs;
  const isStale = lastAttemptMs > retryAfterMs;

  if (
    isCriticalStale &&
    (
      (!release.imageUrl && !release.thumbnailUrl) ||
      !release.genreName ||
      !release.youtubeUrl ||
      !release.youtubeMusicUrl ||
      !release.bandcampUrl
    )
  ) {
    return true;
  }

  if (isStale && (!release.releaseDate || !release.genreName || !release.labelName)) {
    return true;
  }

  if (isStale && (!release.youtubeUrl || !release.youtubeMusicUrl || !release.bandcampUrl)) {
    return true;
  }

  if (isStale && !release.imageUrl) {
    return true;
  }

  if (wantsAi && !release.aiSummary) {
    return true;
  }

  if (shouldRegenerateAiSummary(release.aiSummary)) {
    return true;
  }

  return false;
}

async function buildReleaseEnrichment(release: EnrichableRelease) {
  const sourceMetadata = await resolveSourceMetadata(release.sourceUrl);
  const musicMetadata = await fetchMusicMetadata({
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    releaseType: release.releaseType,
    sourceUrl: release.sourceUrl,
  }).catch(() => ({}) as MusicMetadata);

  const sourcePlatform = detectPlatform(release.sourceUrl);

  const directYouTube =
    sourcePlatform === "youtube" ? release.sourceUrl : null;
  const directYouTubeMusic =
    sourcePlatform === "youtube-music" ? release.sourceUrl : null;
  const directBandcamp =
    sourcePlatform === "bandcamp" ? release.sourceUrl : null;

  const genreName =
    normalizeGenre(musicMetadata.genreName) ||
    normalizeGenre(sourceMetadata.genreName) ||
    inferGenreFromRelease(release) ||
    release.genreName ||
    null;
  const labelName =
    normalizeLabel(musicMetadata.labelName) ||
    normalizeLabel(sourceMetadata.labelName) ||
    release.labelName ||
    null;
  const summaryNeedsRefresh = shouldRegenerateAiSummary(release.aiSummary);
  const summaryContext = [
    sourceMetadata.sourceTitle,
    sourceMetadata.sourceExcerpt,
    release.summary,
  ]
    .filter(Boolean)
    .join(". ");

  const aiSummary =
    (!summaryNeedsRefresh && release.aiSummary) ||
    (await generateAiSummary({
      artistName: release.artistName,
      projectTitle: release.projectTitle,
      title: release.title,
      genreName,
      releaseType: release.releaseType,
      sourceExcerpt: summaryContext || null,
      sourceTitle: sourceMetadata.sourceTitle || null,
      outletName: release.outletName || null,
      labelName,
    }));

  return {
    aiSummary,
    labelName,
    genreName,
    releaseDate: musicMetadata.releaseDate || release.releaseDate || null,
    youtubeUrl:
      directYouTube ||
      sourceMetadata.youtubeUrl ||
      musicMetadata.youtubeUrl ||
      release.youtubeUrl ||
      null,
    youtubeMusicUrl:
      directYouTubeMusic ||
      sourceMetadata.youtubeMusicUrl ||
      musicMetadata.youtubeMusicUrl ||
      release.youtubeMusicUrl ||
      null,
    bandcampUrl:
      directBandcamp ||
      sourceMetadata.bandcampUrl ||
      musicMetadata.bandcampUrl ||
      release.bandcampUrl ||
      null,
    musicbrainzReleaseId:
      musicMetadata.musicbrainzReleaseId || release.musicbrainzReleaseId || null,
    musicbrainzArtistId:
      musicMetadata.musicbrainzArtistId || release.musicbrainzArtistId || null,
    imageUrl:
      release.imageUrl ||
      musicMetadata.coverArtUrl ||
      musicMetadata.thumbnailArtUrl ||
      sourceMetadata.sourceImageUrl ||
      release.thumbnailUrl ||
      null,
    thumbnailUrl:
      release.thumbnailUrl ||
      musicMetadata.thumbnailArtUrl ||
      musicMetadata.coverArtUrl ||
      sourceMetadata.sourceImageUrl ||
      null,
  };
}

function normalizeGenre(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/,/g, " / ")
    .replace(/\s+/g, " ")
    .trim();

  if (normalized.toLowerCase().startsWith("http")) {
    const parsedGenre = extractGenreFromUrl(normalized);
    return parsedGenre ? parsedGenre.replace(/-/g, " ") : null;
  }

  const firstMeaningfulGenre = normalized
    .split(/\s*\/\s*/)
    .map((genre) => genre.trim())
    .find((genre) => genre && isMeaningfulGenre(genre));

  if (!firstMeaningfulGenre) {
    return null;
  }

  return firstMeaningfulGenre.length > 48
    ? firstMeaningfulGenre.slice(0, 48).trim()
    : firstMeaningfulGenre;
}

function normalizeLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (
    normalized.toLowerCase().startsWith("http") ||
    normalized.toLowerCase().includes("schema.org") ||
    normalized.toLowerCase().includes("schema.googleapis.com")
  ) {
    return null;
  }

  return normalized;
}

function scoreEnrichmentPriority(release: EnrichableRelease, wantsAi: boolean) {
  let score = 0;

  if (!release.imageUrl && !release.thumbnailUrl) {
    score += 10;
  }

  if (!isMeaningfulStoredGenre(release.genreName)) {
    score += 8;
  }

  if (!release.youtubeUrl || !release.youtubeMusicUrl || !release.bandcampUrl) {
    score += 7;
  }

  if (!release.labelName || !release.releaseDate) {
    score += 4;
  }

  if (wantsAi && !release.aiSummary) {
    score += 2;
  }

  return score;
}

function isMeaningfulGenre(value: string) {
  const normalized = value.toLowerCase();

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized === "thing" ||
    normalized === "musicrecording" ||
    normalized === "singlerelease" ||
    normalized === "albumrelease" ||
    normalized === "eprelease" ||
    normalized === "video" ||
    normalized === "music" ||
    normalized === "artist" ||
    normalized === "album"
  ) {
    return false;
  }

  return !normalized.includes("schema.org");
}

function isMeaningfulStoredGenre(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return isMeaningfulGenre(value.trim());
}

function extractGenreFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function inferGenreFromRelease(release: EnrichableRelease) {
  const haystack = `${release.title} ${release.projectTitle || ""} ${release.artistName || ""}`.toLowerCase();

  if (release.releaseType === ReleaseType.PERFORMANCE) {
    return "Live / Session";
  }

  if (haystack.includes("shoegaze") || haystack.includes("dream pop")) {
    return "Dream Pop";
  }

  if (haystack.includes("post-punk") || haystack.includes("punk")) {
    return "Post-Punk";
  }

  if (haystack.includes("synth") || haystack.includes("electronic")) {
    return "Electronic";
  }

  if (haystack.includes("folk") || haystack.includes("americana")) {
    return "Indie Folk";
  }

  if (haystack.includes("metal")) {
    return "Metal";
  }

  if (haystack.includes("hip hop") || haystack.includes("rap")) {
    return "Hip-Hop";
  }

  if (
    release.releaseType === ReleaseType.ALBUM ||
    release.releaseType === ReleaseType.EP ||
    release.releaseType === ReleaseType.SINGLE
  ) {
    return "Indie / Alternative";
  }

  return null;
}
