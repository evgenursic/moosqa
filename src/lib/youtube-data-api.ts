import { buildCanonicalYouTubeWatchUrl, sanitizeYouTubeVideoId } from "@/lib/youtube-video";

const YOUTUBE_API_TIMEOUT_MS = 4_500;
const YOUTUBE_API_MAX_IDS = 50;

export type YouTubeVideoMetric = {
  videoId: string;
  canonicalUrl: string;
  viewCount: number | null;
  publishedAt: Date | null;
};

export type YouTubeSearchInput = {
  title: string;
  artistName?: string | null;
  projectTitle?: string | null;
};

export function isYouTubeDataApiConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export async function fetchYouTubeVideoMetricsByIds(videoIds: string[]) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return [];
  }

  const ids = [...new Set(videoIds.map(sanitizeYouTubeVideoId).filter((id): id is string => Boolean(id)))]
    .slice(0, YOUTUBE_API_MAX_IDS);
  if (ids.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_API_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      part: "statistics,snippet",
      id: ids.join(","),
      key: apiKey,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("YouTube Data API request failed.", {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const payload = (await response.json()) as YouTubeVideosResponse;
    return (payload.items || []).flatMap((item): YouTubeVideoMetric[] => {
      const videoId = sanitizeYouTubeVideoId(item.id);
      const canonicalUrl = buildCanonicalYouTubeWatchUrl(videoId);
      if (!videoId || !canonicalUrl) {
        return [];
      }

      return [{
        videoId,
        canonicalUrl,
        viewCount: coerceYouTubeCount(item.statistics?.viewCount),
        publishedAt: coerceYouTubeDate(item.snippet?.publishedAt),
      }];
    });
  } catch (error) {
    console.warn("YouTube Data API metrics refresh failed.", error);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function discoverYouTubeVideoMetric(input: YouTubeSearchInput) {
  const videoId = await searchYouTubeVideoId(input);
  if (!videoId) {
    return null;
  }

  return (await fetchYouTubeVideoMetricsByIds([videoId]))[0] || null;
}

async function searchYouTubeVideoId(input: YouTubeSearchInput) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = buildYouTubeSearchQuery(input);
  if (!apiKey || !query) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_API_TIMEOUT_MS);

  try {
    const params = new URLSearchParams({
      part: "snippet",
      maxResults: "1",
      q: query,
      type: "video",
      videoEmbeddable: "true",
      key: apiKey,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn("YouTube Data API search failed.", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const payload = (await response.json()) as YouTubeSearchResponse;
    return sanitizeYouTubeVideoId(payload.items?.[0]?.id?.videoId);
  } catch (error) {
    console.warn("YouTube Data API discovery failed.", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    statistics?: {
      viewCount?: string;
    };
    snippet?: {
      publishedAt?: string;
    };
  }>;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
  }>;
};

function buildYouTubeSearchQuery(input: YouTubeSearchInput) {
  const artist = cleanSearchText(input.artistName || "");
  const title = cleanSearchText(input.projectTitle || input.title);
  const query = [artist, title].filter(Boolean).join(" ");
  return query.slice(0, 120);
}

function cleanSearchText(value: string) {
  return value
    .replace(/\s*\/\/.*$/g, " ")
    .replace(/\b(announces?|announce|new album|new ep|out now|official music video|official video|official audio)\b/gi, " ")
    .replace(/[()[\]{}"'`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function coerceYouTubeCount(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.min(parsed, 2_147_483_647);
}

function coerceYouTubeDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
