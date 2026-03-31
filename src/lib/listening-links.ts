import { ReleaseType } from "@/generated/prisma/enums";

type LinkableRelease = {
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  sourceUrl: string;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  officialWebsiteUrl?: string | null;
  officialStoreUrl?: string | null;
};

type ListeningPlatform = "youtube" | "youtube-music" | "bandcamp";

export type ListeningLink = {
  label: string;
  href: string;
  isDirect: boolean;
};

export type PurchaseLink = {
  label: string;
  href: string;
  isDirect: boolean;
};

export function getListeningLinks(release: LinkableRelease): ListeningLink[] {
  const query = encodeURIComponent(buildSearchQuery(release));
  const sourcePlatform = detectPlatform(release.sourceUrl);
  const youtubeHref = release.youtubeUrl || fallbackPlatformUrl("youtube", release.sourceUrl, query);
  const youtubeMusicHref =
    release.youtubeMusicUrl || fallbackPlatformUrl("youtube-music", release.sourceUrl, query);
  const bandcampHref = release.bandcampUrl || fallbackPlatformUrl("bandcamp", release.sourceUrl, query);

  return [
    {
      label: "YouTube",
      href: youtubeHref,
      isDirect: isVerifiedListeningLink("youtube", youtubeHref, release.youtubeUrl, sourcePlatform),
    },
    {
      label: "YouTube Music",
      href: youtubeMusicHref,
      isDirect: isVerifiedListeningLink(
        "youtube-music",
        youtubeMusicHref,
        release.youtubeMusicUrl,
        sourcePlatform,
      ),
    },
    {
      label: "Bandcamp",
      href: bandcampHref,
      isDirect: isVerifiedListeningLink("bandcamp", bandcampHref, release.bandcampUrl, sourcePlatform),
    },
  ].sort((left, right) => Number(right.isDirect) - Number(left.isDirect));
}

export function getPurchaseLink(release: LinkableRelease): PurchaseLink | null {
  if (!isPurchasableRelease(release.releaseType)) {
    return null;
  }

  const sourcePlatform = detectPlatform(release.sourceUrl);

  if (release.bandcampUrl) {
    return {
      label: "Buy on Bandcamp",
      href: release.bandcampUrl,
      isDirect: true,
    };
  }

  if (sourcePlatform === "bandcamp") {
    return {
      label: "Buy on Bandcamp",
      href: release.sourceUrl,
      isDirect: true,
    };
  }

  if (release.officialStoreUrl && looksOfficialWebsiteUrl(release.officialStoreUrl)) {
    return {
      label: "Artist store",
      href: release.officialStoreUrl,
      isDirect: true,
    };
  }

  if (release.officialWebsiteUrl && looksOfficialWebsiteUrl(release.officialWebsiteUrl)) {
    return {
      label: "Artist site",
      href: release.officialWebsiteUrl,
      isDirect: true,
    };
  }

  if (looksOfficialWebsiteUrl(release.sourceUrl)) {
    return {
      label: "Artist site",
      href: release.sourceUrl,
      isDirect: true,
    };
  }

  return null;
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

function isPurchasableRelease(releaseType: ReleaseType) {
  return (
    releaseType === ReleaseType.SINGLE ||
    releaseType === ReleaseType.ALBUM ||
    releaseType === ReleaseType.EP
  );
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

function isVerifiedListeningLink(
  platform: ListeningPlatform,
  href: string,
  storedUrl: string | null | undefined,
  sourcePlatform: ListeningPlatform | null,
) {
  if (storedUrl && detectPlatform(storedUrl) === platform) {
    return true;
  }

  if (sourcePlatform === platform && detectPlatform(href) === platform) {
    return true;
  }

  return false;
}

function looksOfficialWebsiteUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const blockedHosts = [
      "reddit.com",
      "www.reddit.com",
      "instagram.com",
      "www.instagram.com",
      "facebook.com",
      "www.facebook.com",
      "x.com",
      "www.x.com",
      "twitter.com",
      "www.twitter.com",
      "bsky.app",
      "youtube.com",
      "youtu.be",
      "music.youtube.com",
      "bandcamp.com",
      "spotify.com",
      "open.spotify.com",
      "qobuz.com",
      "tidal.com",
      "amazon.com",
      "discogs.com",
      "musicbrainz.org",
      "genius.com",
      "linktr.ee",
      "lnk.to",
      "ffm.to",
      "ffm.bio",
    ];

    return !blockedHosts.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`));
  } catch {
    return false;
  }
}
