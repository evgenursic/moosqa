import { detectPlatform } from "@/lib/listening-links";

type ArtworkCandidateInput = {
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  sourceUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
};

export function getArtworkCandidateUrls(input: ArtworkCandidateInput) {
  const candidates = [
    input.imageUrl,
    input.thumbnailUrl,
    ...getDerivedArtworkUrls(input.youtubeUrl || input.youtubeMusicUrl || input.sourceUrl || null),
  ];

  return [...new Set(candidates.map(normalizeUrl).filter((value): value is string => Boolean(value)))];
}

function getDerivedArtworkUrls(url: string | null) {
  if (!url || (detectPlatform(url) !== "youtube" && detectPlatform(url) !== "youtube-music")) {
    return [] as string[];
  }

  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return [] as string[];
  }

  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

function extractYouTubeId(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }

    if (hostname.includes("youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v");
      }

      const segments = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = segments.findIndex((segment) => segment === "embed" || segment === "shorts");
      if (embedIndex >= 0) {
        return segments[embedIndex + 1] || null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeUrl(value: string | null | undefined) {
  const normalized = value?.trim() || "";
  return normalized || null;
}
