import { detectPlatform } from "@/lib/listening-links";

export const YOUTUBE_METADATA_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;
export const YOUTUBE_METADATA_RETRY_INTERVAL_MS = 1000 * 60 * 15;

type YouTubeMetadataState = {
  sourceUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  youtubeViewCount?: number | null;
  youtubePublishedAt?: Date | string | null;
  youtubeMetadataUpdatedAt?: Date | string | null;
  metadataEnrichedAt?: Date | string | null;
};

export function hasYouTubeMetadataSource(input: YouTubeMetadataState) {
  return (
    detectPlatform(input.sourceUrl || "") === "youtube" ||
    detectPlatform(input.sourceUrl || "") === "youtube-music" ||
    detectPlatform(input.youtubeUrl || "") === "youtube" ||
    detectPlatform(input.youtubeMusicUrl || "") === "youtube-music"
  );
}

export function shouldRefreshYouTubeMetadata(
  input: YouTubeMetadataState,
  now: Date = new Date(),
) {
  if (!hasYouTubeMetadataSource(input)) {
    return false;
  }

  const lastAttempt =
    coerceMetadataDate(input.youtubeMetadataUpdatedAt) ||
    coerceMetadataDate(input.metadataEnrichedAt);

  if (!lastAttempt) {
    return true;
  }

  const hasCompleteMetadata = Boolean(input.youtubeViewCount && input.youtubePublishedAt);
  const ageMs = now.getTime() - lastAttempt.getTime();

  return ageMs > (hasCompleteMetadata
    ? YOUTUBE_METADATA_REFRESH_INTERVAL_MS
    : YOUTUBE_METADATA_RETRY_INTERVAL_MS);
}

export function coerceMetadataDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
