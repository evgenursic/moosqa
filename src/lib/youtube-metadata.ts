import { detectPlatform } from "@/lib/listening-links";

export const YOUTUBE_METADATA_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 24 * 7;
export const YOUTUBE_METADATA_RETRY_INTERVAL_MS = 1000 * 60 * 15;
export const YOUTUBE_VISIBLE_STATS_REFRESH_INTERVAL_MS = readRefreshIntervalMs(
  process.env.YOUTUBE_VISIBLE_STATS_REFRESH_MINUTES,
  30,
);

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

export function shouldRefreshVisibleYouTubeStats(
  input: YouTubeMetadataState,
  now: Date = new Date(),
) {
  if (!hasYouTubeMetadataSource(input)) {
    return false;
  }

  const lastAttempt = coerceMetadataDate(input.youtubeMetadataUpdatedAt);
  if (!lastAttempt || !input.youtubeViewCount || !input.youtubePublishedAt) {
    return true;
  }

  return now.getTime() - lastAttempt.getTime() > YOUTUBE_VISIBLE_STATS_REFRESH_INTERVAL_MS;
}

function readRefreshIntervalMs(value: string | undefined, fallbackMinutes: number) {
  const parsed = Number.parseInt(value || "", 10);
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes;
  return Math.max(10, minutes) * 60 * 1000;
}
