import { ReleaseType } from "@/generated/prisma/enums";
import { decodeHtmlEntities, slugify, trimText } from "@/lib/utils";

const REDDIT_URLS = [
  "https://www.reddit.com/r/indieheads/new.json?limit=100&raw_json=1",
  "https://api.reddit.com/r/indieheads/new?limit=100&raw_json=1",
  "https://www.reddit.com/r/indieheads/.json?limit=100&raw_json=1",
];
const REDDIT_RSS_URL = "https://www.reddit.com/r/indieheads/new.rss";
const USER_AGENT = "moosqa/0.1 (+https://moosqa.local)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

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
  const headerVariants = getRedditHeaderVariants();
  let jsonPosts: RedditPost[] = [];

  for (const redditUrl of REDDIT_URLS) {
    for (const headers of headerVariants) {
      try {
        const response = await fetch(redditUrl, {
          headers,
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
          jsonPosts = posts;
          break;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (jsonPosts.length > 0) {
      break;
    }
  }

  try {
    const rssPosts = await fetchRedditPostsFromRss(headerVariants);
    if (rssPosts.length > 0) {
      if (jsonPosts.length > 0) {
        return mergeRedditPostLists(jsonPosts, rssPosts);
      }

      return rssPosts;
    }
  } catch (error) {
    lastError = error instanceof Error ? error : new Error(String(error));
  }

  if (jsonPosts.length > 0) {
    return jsonPosts;
  }

  throw lastError || new Error("Reddit sync failed for all endpoints.");
}

function getRedditHeaderVariants() {
  const configuredAgent = process.env.REDDIT_USER_AGENT || USER_AGENT;
  const commonHeaders = {
    Accept: "application/json,text/plain,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.reddit.com/",
  };

  const variants = [
    {
      "User-Agent": configuredAgent,
      ...commonHeaders,
    },
  ];

  if (configuredAgent !== BROWSER_USER_AGENT) {
    variants.push({
      "User-Agent": BROWSER_USER_AGENT,
      ...commonHeaders,
    });
  }

  return variants;
}

async function fetchRedditPostsFromRss(headerVariants: Array<Record<string, string>>) {
  let lastError: Error | null = null;

  for (const headers of headerVariants) {
    try {
      const response = await fetch(REDDIT_RSS_URL, {
        headers: {
          ...headers,
          Accept: "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        lastError = new Error(`Reddit RSS sync failed with status ${response.status}`);
        continue;
      }

      const xml = await response.text();
      const posts = parseRedditRssFeed(xml);
      if (posts.length > 0) {
        return posts;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("Reddit RSS sync failed.");
}

function parseRedditRssFeed(xml: string) {
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
  return entries
    .map((match) => parseRedditRssEntry(match[1]))
    .filter((item): item is RedditPost => item !== null);
}

function parseRedditRssEntry(entryXml: string): RedditPost | null {
  const title = decodeRssValue(extractXmlContent(entryXml, "title") || "").trim();
  const permalinkUrl = decodeRssValue(extractXmlAttribute(entryXml, "link", "href") || "");
  const publishedRaw =
    extractXmlContent(entryXml, "published") || extractXmlContent(entryXml, "updated");
  const contentHtml = decodeRssValue(extractXmlContent(entryXml, "content") || "");
  const postId =
    extractXmlContent(entryXml, "id")?.match(/t3_([a-z0-9]+)/i)?.[1] ||
    permalinkUrl.match(/comments\/([a-z0-9]+)\//i)?.[1] ||
    null;

  if (!title || !publishedRaw || !postId || !permalinkUrl) {
    return null;
  }

  const publishedAt = new Date(publishedRaw);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  const contentLinks = extractRssLinks(contentHtml);
  const sourceUrl = contentLinks.find((url) => !isRedditUrl(url)) || permalinkUrl;
  const thumbnailUrl =
    decodeRssValue(extractXmlAttribute(entryXml, "media:thumbnail", "url") || "") ||
    extractRssImageUrl(contentHtml) ||
    undefined;

  return {
    id: postId,
    title,
    created_utc: Math.floor(publishedAt.getTime() / 1000),
    permalink: toRedditPermalink(permalinkUrl),
    url: sourceUrl,
    thumbnail: thumbnailUrl,
    link_flair_text: null,
    selftext: undefined,
    domain: inferDomain(sourceUrl),
    score: undefined,
    num_comments: undefined,
    preview: thumbnailUrl
      ? {
          images: [
            {
              source: {
                url: thumbnailUrl,
              },
            },
          ],
        }
      : undefined,
  };
}

function extractXmlContent(xml: string, tagName: string) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escapedTagName}[^>]*>([\\s\\S]*?)<\\/${escapedTagName}>`, "i"));
  return match?.[1] ?? null;
}

function extractXmlAttribute(xml: string, tagName: string, attributeName: string) {
  const escapedTagName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedAttributeName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(
    new RegExp(`<${escapedTagName}[^>]*\\s${escapedAttributeName}="([^"]+)"[^>]*/?>`, "i"),
  );
  return match?.[1] ?? null;
}

function extractRssLinks(contentHtml: string) {
  return [...contentHtml.matchAll(/href="([^"]+)"/gi)]
    .map((match) => decodeRssValue(match[1]))
    .filter(Boolean);
}

function extractRssImageUrl(contentHtml: string) {
  const match = contentHtml.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] ? decodeRssValue(match[1]) : null;
}

function decodeRssValue(value: string) {
  let decoded = value;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = decodeHtmlEntities(decoded).replace(/&#32;/g, " ").replace(/&#x2F;/gi, "/");
    if (next === decoded) {
      break;
    }
    decoded = next;
  }
  return decoded.trim();
}

function isRedditUrl(url: string) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return hostname === "reddit.com" || hostname.endsWith(".reddit.com");
  } catch {
    return false;
  }
}

function toRedditPermalink(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function inferDomain(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function mergeRedditPostLists(primary: RedditPost[], secondary: RedditPost[]) {
  const merged = new Map<string, RedditPost>();

  for (const post of secondary) {
    merged.set(post.id, post);
  }

  for (const post of primary) {
    merged.set(post.id, {
      ...merged.get(post.id),
      ...post,
    });
  }

  return [...merged.values()].sort((left, right) => right.created_utc - left.created_utc);
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
