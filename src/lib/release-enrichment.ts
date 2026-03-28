import { prisma } from "@/lib/prisma";
import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { searchBandcampRelease } from "@/lib/bandcamp-search";
import { getGenreOverride } from "@/lib/genre-overrides";
import {
  buildGenreProfile,
  countGenreProfileSegments,
  isSpecificGenreProfile,
  pickPreferredGenreProfile,
} from "@/lib/genre-profile";
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

  if (shouldUpgradeGenreProfile(release)) {
    return true;
  }

  if (shouldRegenerateAiSummary(release.aiSummary)) {
    return true;
  }

  return false;
}

export async function buildReleaseEnrichment(release: EnrichableRelease) {
  const sourceMetadata = await resolveSourceMetadata(release.sourceUrl, {
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
  });
  const canonicalArtistName: string | null =
    shouldUseArtistHint(release.artistName, sourceMetadata.artistNameHint)
      ? (sourceMetadata.artistNameHint ?? null)
      : (release.artistName ?? null);
  const musicMetadata = await fetchMusicMetadata({
    artistName: canonicalArtistName,
    projectTitle: release.projectTitle,
    title: release.title,
    releaseType: release.releaseType,
    sourceUrl: release.sourceUrl,
  }).catch(() => ({}) as MusicMetadata);
  const fallbackBandcampMetadata =
    musicMetadata.bandcampUrl &&
    musicMetadata.bandcampUrl !== release.sourceUrl &&
    (
      !sourceMetadata.sourceImageUrl ||
      !sourceMetadata.genreName ||
      !isSpecificGenreProfile(sourceMetadata.genreName)
    )
      ? await resolveSourceMetadata(musicMetadata.bandcampUrl, {
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
        })
      : null;
  const hasSpecificResolvedGenre =
    isSpecificGenreProfile(sourceMetadata.genreName) ||
    isSpecificGenreProfile(fallbackBandcampMetadata?.genreName);
  const hasResolvedArtwork =
    Boolean(sourceMetadata.sourceImageUrl) || Boolean(fallbackBandcampMetadata?.sourceImageUrl);
  const shouldSearchBandcampRelease =
    detectPlatform(release.sourceUrl) !== "bandcamp" &&
    (!hasResolvedArtwork || !hasSpecificResolvedGenre);
  const searchedBandcampResult =
    shouldSearchBandcampRelease
      ? await searchBandcampRelease({
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
          releaseType: release.releaseType,
        })
      : null;
  const searchedBandcampMetadata =
    searchedBandcampResult?.url &&
    searchedBandcampResult.url !== release.sourceUrl &&
    searchedBandcampResult.url !== musicMetadata.bandcampUrl
      ? await resolveSourceMetadata(searchedBandcampResult.url, {
          artistName: release.artistName,
          projectTitle: release.projectTitle,
          title: release.title,
        })
      : null;

  const sourcePlatform = detectPlatform(release.sourceUrl);

  const directYouTube =
    sourcePlatform === "youtube" ? release.sourceUrl : null;
  const directYouTubeMusic =
    sourcePlatform === "youtube-music" ? release.sourceUrl : null;
  const directBandcamp =
    sourcePlatform === "bandcamp" ? release.sourceUrl : null;

  const genreCandidates = [
    normalizeGenre(musicMetadata.genreName),
    normalizeGenre(sourceMetadata.genreName),
    normalizeGenre(fallbackBandcampMetadata?.genreName),
    normalizeGenre(searchedBandcampMetadata?.genreName),
    normalizeGenre(release.genreName),
  ];
  const overrideGenre = getGenreOverride(release);
  const specificGenreCandidate = genreCandidates.find((candidate) =>
    candidate ? isSpecificGenreProfile(candidate) : false,
  );
  const profiledGenre =
    buildGenreProfile({
      explicitGenres: genreCandidates,
      text: [
        sourceMetadata.sourceTitle,
        sourceMetadata.sourceExcerpt,
        fallbackBandcampMetadata?.sourceTitle,
        fallbackBandcampMetadata?.sourceExcerpt,
        searchedBandcampMetadata?.sourceTitle,
        searchedBandcampMetadata?.sourceExcerpt,
        release.summary,
        release.aiSummary,
        release.title,
        release.projectTitle,
      ]
        .filter(Boolean)
        .join(". "),
      artistName: canonicalArtistName || release.artistName,
      projectTitle: release.projectTitle,
      title: release.title,
      labelName: normalizeLabel(musicMetadata.labelName) || normalizeLabel(sourceMetadata.labelName),
      limit: 3,
    }) || null;
  const genreName =
    overrideGenre ||
    pickPreferredGenreProfile(
      profiledGenre && isSpecificGenreProfile(profiledGenre) ? profiledGenre : null,
      specificGenreCandidate,
    ) ||
    genreCandidates.find(Boolean) ||
    inferGenreFromRelease(release) ||
    release.genreName ||
    null;
  const labelName =
    normalizeLabel(musicMetadata.labelName) ||
    normalizeLabel(sourceMetadata.labelName) ||
    normalizeLabel(fallbackBandcampMetadata?.labelName) ||
    normalizeLabel(searchedBandcampMetadata?.labelName) ||
    release.labelName ||
    null;
  const summaryNeedsRefresh = shouldRegenerateAiSummary(release.aiSummary);
  const summaryContext = [
    sourceMetadata.sourceTitle,
    sourceMetadata.sourceExcerpt,
    fallbackBandcampMetadata?.sourceTitle,
    fallbackBandcampMetadata?.sourceExcerpt,
    searchedBandcampMetadata?.sourceTitle,
    searchedBandcampMetadata?.sourceExcerpt,
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
      fallbackBandcampMetadata?.youtubeUrl ||
      searchedBandcampMetadata?.youtubeUrl ||
      musicMetadata.youtubeUrl ||
      release.youtubeUrl ||
      null,
    youtubeMusicUrl:
      directYouTubeMusic ||
      sourceMetadata.youtubeMusicUrl ||
      fallbackBandcampMetadata?.youtubeMusicUrl ||
      searchedBandcampMetadata?.youtubeMusicUrl ||
      musicMetadata.youtubeMusicUrl ||
      release.youtubeMusicUrl ||
      null,
    bandcampUrl:
      directBandcamp ||
      sourceMetadata.bandcampUrl ||
      fallbackBandcampMetadata?.bandcampUrl ||
      searchedBandcampMetadata?.bandcampUrl ||
      searchedBandcampResult?.url ||
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
      fallbackBandcampMetadata?.sourceImageUrl ||
      searchedBandcampMetadata?.sourceImageUrl ||
      release.thumbnailUrl ||
      null,
    thumbnailUrl:
      release.thumbnailUrl ||
      musicMetadata.thumbnailArtUrl ||
      musicMetadata.coverArtUrl ||
      sourceMetadata.sourceImageUrl ||
      fallbackBandcampMetadata?.sourceImageUrl ||
      searchedBandcampMetadata?.sourceImageUrl ||
      null,
  };
}

function normalizeGenre(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/,/g, " / ").replace(/\s+/g, " ").trim();

  if (normalized.toLowerCase().startsWith("http")) {
    const parsedGenre = extractGenreFromUrl(normalized);
    return parsedGenre ? parsedGenre.replace(/-/g, " ") : null;
  }

  const meaningfulGenres = normalized
    .split(/\s*\/\s*/)
    .map((genre) => genre.trim())
    .filter((genre) => genre && isMeaningfulGenre(genre));

  if (meaningfulGenres.length === 0) {
    return null;
  }

  const joined = [...new Set(meaningfulGenres)].slice(0, 3).join(" / ");
  return joined.length > 80 ? joined.slice(0, 80).trim() : joined;
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

  return isMeaningfulGenre(value.trim()) && isSpecificGenreProfile(value.trim());
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
  const overrideGenre = getGenreOverride(release);
  if (overrideGenre) {
    return overrideGenre;
  }

  const haystack = `${release.title} ${release.projectTitle || ""} ${release.artistName || ""}`.toLowerCase();

  const inferredGenre = buildGenreProfile({
    text: haystack,
    artistName: release.artistName,
    projectTitle: release.projectTitle,
    title: release.title,
    limit: 2,
  });
  if (inferredGenre) {
    return inferredGenre;
  }

  return null;
}

function shouldUseArtistHint(
  currentArtistName: string | null | undefined,
  artistHint: string | null | undefined,
) {
  if (!artistHint) {
    return false;
  }

  const normalizedHint = artistHint.trim().toLowerCase();
  if (!normalizedHint) {
    return false;
  }

  if (
    /\b(vevo|official|records|recordings|music|tv|channel)\b/i.test(normalizedHint) ||
    normalizedHint.endsWith("vevo")
  ) {
    return false;
  }

  if (!currentArtistName) {
    return true;
  }

  return !currentArtistName.toLowerCase().includes(normalizedHint);
}

function shouldUpgradeGenreProfile(release: EnrichableRelease) {
  const currentGenre = release.genreName?.trim() || null;
  if (!currentGenre || !isSpecificGenreProfile(currentGenre)) {
    return false;
  }

  if (countGenreProfileSegments(currentGenre) > 1) {
    return false;
  }

  const hintText = `${release.title} ${release.projectTitle || ""} ${release.summary || ""}`;
  return /\b(math rock|post-rock|post-punk|shoegaze|dream pop|slowcore|noise rock|garage rock|indietronica|electronic|ambient|hardcore punk|singer-songwriter|chamber pop|art pop|synth-pop|psych(?:edelic)? rock|folk rock)\b/i.test(
    hintText,
  );
}
