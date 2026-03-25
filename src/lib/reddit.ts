import { ReleaseType } from "@/generated/prisma/enums";
import { decodeHtmlEntities, slugify, trimText } from "@/lib/utils";

const REDDIT_URLS = [
  "https://www.reddit.com/r/indieheads/new.json?limit=100&raw_json=1",
  "https://api.reddit.com/r/indieheads/new?limit=100&raw_json=1",
  "https://www.reddit.com/r/indieheads/.json?limit=100&raw_json=1",
];
const USER_AGENT = "moosqa/0.1 (+https://moosqa.local)";

type RedditListing = {
  data?: {
    children?: Array<{
      data: RedditPost;
    }>;
  };
};

type RedditPost = {
  id: string;
  title: string;
  created_utc: number;
  permalink: string;
  url: string;
  thumbnail?: string;
  link_flair_text?: string | null;
  selftext?: string;
  domain?: string;
  score?: number;
  num_comments?: number;
  preview?: {
    images?: Array<{
      source?: {
        url?: string;
      };
    }>;
  };
};

export type NormalizedRelease = {
  sourceItemId: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  flair: string | null;
  summary: string | null;
  outletName: string | null;
  releaseDate: Date | null;
  publishedAt: Date;
  redditPermalink: string;
  sourceUrl: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  domain: string | null;
  score: number | null;
  commentCount: number | null;
  rawJson: string;
};

export async function fetchRedditPosts() {
  let lastError: Error | null = null;

  for (const redditUrl of REDDIT_URLS) {
    try {
      const response = await fetch(redditUrl, {
        headers: {
          "User-Agent": process.env.REDDIT_USER_AGENT || USER_AGENT,
          Accept: "application/json",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        lastError = new Error(`Reddit sync failed with status ${response.status} for ${redditUrl}`);
        continue;
      }

      const payload = (await response.json()) as RedditListing;
      const posts = payload.data?.children?.map((child) => child.data) ?? [];
      if (posts.length > 0) {
        return posts;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("Reddit sync failed for all endpoints.");
}

export function normalizeRedditPost(post: RedditPost): NormalizedRelease | null {
  const releaseType = detectReleaseType(post.title, post.link_flair_text);
  const cleanTitle = stripTag(post.title);
  if (!shouldKeepReleaseRecord({
    title: cleanTitle,
    releaseType,
    sourceUrl: post.url,
    flair: post.link_flair_text ?? null,
  })) {
    return null;
  }

  const parsed = splitArtistAndProject(cleanTitle);
  const publishedAt = new Date(post.created_utc * 1000);
  const imageUrl = getImageUrl(post);
  const thumbnailUrl = getThumbnailUrl(post, imageUrl);

  return {
    sourceItemId: post.id,
    slug: `${slugify(parsed.artistName || parsed.projectTitle || cleanTitle)}-${post.id}`,
    title: cleanTitle,
    artistName: parsed.artistName,
    projectTitle: parsed.projectTitle,
    releaseType,
    flair: post.link_flair_text ?? extractTag(post.title),
    summary: trimText(post.selftext || buildSummary(cleanTitle, releaseType, publishedAt)),
    outletName: inferOutletName(post.domain),
    releaseDate: null,
    publishedAt,
    redditPermalink: `https://www.reddit.com${post.permalink}`,
    sourceUrl: post.url,
    imageUrl,
    thumbnailUrl,
    domain: post.domain ?? null,
    score: post.score ?? null,
    commentCount: post.num_comments ?? null,
    rawJson: JSON.stringify(post),
  };
}

function shouldInclude(type: ReleaseType) {
  const includedReleaseTypes: ReleaseType[] = [
    ReleaseType.SINGLE,
    ReleaseType.ALBUM,
    ReleaseType.EP,
    ReleaseType.PERFORMANCE,
  ];

  return includedReleaseTypes.includes(type);
}

function detectReleaseType(title: string, flair: string | null | undefined) {
  const raw = `${extractTag(title)} ${flair || ""}`.toUpperCase();
  if (raw.includes("CHART")) {
    return ReleaseType.CHART;
  }

  if (raw.includes("AMA") || raw.includes("ANNOUNCEMENT")) {
    return ReleaseType.ANNOUNCEMENT;
  }

  if (raw.includes("FRESH ALBUM") || raw.includes("ALBUM STREAM") || raw.includes("NEW MUSIC FRIDAY")) {
    return ReleaseType.ALBUM;
  }

  if (raw.includes("FRESH EP")) {
    return ReleaseType.EP;
  }

  if (raw.includes("FRESH PERFORMANCE")) {
    return ReleaseType.PERFORMANCE;
  }

  if (raw.includes("FRESH")) {
    return ReleaseType.SINGLE;
  }

  return ReleaseType.OTHER;
}

function extractTag(title: string) {
  const match = title.match(/^\[([^\]]+)\]/);
  return match?.[1] ?? "";
}

function stripTag(title: string) {
  return title.replace(/^\[[^\]]+\]\s*/, "").trim();
}

function splitArtistAndProject(title: string) {
  const parts = title.split(/\s(?:-|\u2013|\u2014)\s/);
  if (parts.length >= 2) {
    return {
      artistName: parts[0].trim(),
      projectTitle: parts.slice(1).join(" - ").trim(),
    };
  }

  return {
    artistName: null,
    projectTitle: title,
  };
}

function buildSummary(title: string, type: ReleaseType, publishedAt: Date) {
  const typeLabel = {
    [ReleaseType.SINGLE]: "New single",
    [ReleaseType.ALBUM]: "New album",
    [ReleaseType.EP]: "New EP",
    [ReleaseType.PERFORMANCE]: "Fresh performance",
    [ReleaseType.LIVE_SESSION]: "Live session",
    [ReleaseType.CHART]: "Chart update",
    [ReleaseType.ANNOUNCEMENT]: "Announcement",
    [ReleaseType.OTHER]: "New post",
  }[type];

  return `${typeLabel} spotted on r/indieheads: ${title}. Synced ${publishedAt.toISOString()}.`;
}

function getImageUrl(post: RedditPost) {
  const previewImage = post.preview?.images?.[0]?.source?.url;
  if (previewImage) {
    return decodeHtmlEntities(previewImage);
  }

  if (post.url.startsWith("https://i.redd.it") || post.url.match(/\.(jpg|jpeg|png|webp)$/i)) {
    return post.url;
  }

  if (post.thumbnail?.startsWith("http")) {
    return decodeHtmlEntities(post.thumbnail);
  }

  return null;
}

function getThumbnailUrl(post: RedditPost, imageUrl: string | null) {
  if (post.thumbnail?.startsWith("http")) {
    return decodeHtmlEntities(post.thumbnail);
  }

  return imageUrl;
}

function inferOutletName(domain: string | undefined) {
  if (!domain) {
    return null;
  }

  const normalized = domain.replace(/^www\./, "");
  const labels: Record<string, string> = {
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "music.youtube.com": "YouTube Music",
    "open.spotify.com": "Spotify",
    "soundcloud.com": "SoundCloud",
    "bandcamp.com": "Bandcamp",
    "music.apple.com": "Apple Music",
    "i.redd.it": "Reddit image",
  };

  return labels[normalized] ?? normalized;
}

export function shouldKeepReleaseRecord(input: {
  title: string;
  releaseType: ReleaseType;
  sourceUrl: string;
  flair: string | null;
}) {
  if (!shouldInclude(input.releaseType)) {
    return false;
  }

  if (isRedditHostedOnly(input.sourceUrl)) {
    return false;
  }

  const title = `${input.title} ${input.flair || ""}`.toLowerCase();
  const excludedContext = [
    "chart",
    "alternative 40",
    "discussion",
    "review",
    "playlist",
    "magazine",
    "podcast",
    "announcement",
    "announce",
    "ama",
  ];

  if (excludedContext.some((term) => title.includes(term))) {
    return false;
  }

  if (input.releaseType === ReleaseType.PERFORMANCE) {
    return true;
  }

  if (title.includes("interview")) {
    return false;
  }

  return true;
}

function isRedditHostedOnly(sourceUrl: string) {
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
    return hostname === "i.redd.it" || hostname === "reddit.com" || hostname.endsWith(".redd.it");
  } catch {
    return false;
  }
}
