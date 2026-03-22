type LinkableRelease = {
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  sourceUrl: string;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
};

type ListeningPlatform = "youtube" | "youtube-music" | "bandcamp";

export type ListeningLink = {
  label: string;
  href: string;
  isDirect: boolean;
};

export function getListeningLinks(release: LinkableRelease): ListeningLink[] {
  const query = encodeURIComponent(buildSearchQuery(release));

  return [
    {
      label: "YouTube",
      href: release.youtubeUrl || fallbackPlatformUrl("youtube", release.sourceUrl, query),
      isDirect: Boolean(release.youtubeUrl || detectPlatform(release.sourceUrl) === "youtube"),
    },
    {
      label: "YouTube Music",
      href:
        release.youtubeMusicUrl ||
        fallbackPlatformUrl("youtube-music", release.sourceUrl, query),
      isDirect: Boolean(
        release.youtubeMusicUrl || detectPlatform(release.sourceUrl) === "youtube-music",
      ),
    },
    {
      label: "Bandcamp",
      href: release.bandcampUrl || fallbackPlatformUrl("bandcamp", release.sourceUrl, query),
      isDirect: Boolean(release.bandcampUrl || detectPlatform(release.sourceUrl) === "bandcamp"),
    },
  ].sort((left, right) => Number(right.isDirect) - Number(left.isDirect));
}

export function detectPlatform(url: string): ListeningPlatform | null {
  try {
    const { hostname } = new URL(url);

    if (hostname === "music.youtube.com") {
      return "youtube-music";
    }

    if (hostname.includes("youtube.com") || hostname === "youtu.be") {
      return "youtube";
    }

    if (hostname.endsWith("bandcamp.com")) {
      return "bandcamp";
    }
  } catch {
    return null;
  }

  return null;
}

function buildSearchQuery(release: LinkableRelease) {
  const parts = [
    release.artistName,
    release.projectTitle,
    !release.artistName ? release.title : null,
  ].filter(Boolean);

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function fallbackPlatformUrl(
  platform: ListeningPlatform,
  sourceUrl: string,
  query: string,
) {
  const sourcePlatform = detectPlatform(sourceUrl);
  if (sourcePlatform === platform) {
    return sourceUrl;
  }

  if (platform === "youtube") {
    return `https://www.youtube.com/results?search_query=${query}`;
  }

  if (platform === "youtube-music") {
    return `https://music.youtube.com/search?q=${query}`;
  }

  return `https://bandcamp.com/search?q=${query}`;
}
