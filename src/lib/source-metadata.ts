import { detectPlatform } from "@/lib/listening-links";

const USER_AGENT =
  process.env.SOURCE_FETCH_USER_AGENT ||
  `MooSQA/0.3 (${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`;

type SourceMetadata = {
  sourceTitle?: string | null;
  sourceExcerpt?: string | null;
  genreName?: string | null;
  labelName?: string | null;
  sourceImageUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
};

export async function resolveSourceMetadata(sourceUrl: string): Promise<SourceMetadata> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
      cache: "no-store",
    });

    const finalUrl = response.url;
    const contentType = response.headers.get("content-type") || "";
    const platformLinks = detectDirectPlatformUrls([finalUrl]);
    const sourcePlatform = detectPlatform(finalUrl);
    const fallbackSourceImage = resolveSourceArtworkFromUrl(finalUrl);

    if (!contentType.includes("text/html")) {
      return {
        ...platformLinks,
        sourceImageUrl: fallbackSourceImage,
      };
    }

    const html = await response.text();
    const hrefCandidates = extractAnchorCandidates(html, finalUrl);
    const platformLinkCandidates = await resolvePlatformCandidates(hrefCandidates);
    const jsonLd = parseJsonLd(html);
    const sourceTitle =
      sanitizeText(
        getMetaContent(html, "og:title") ||
          getMetaContent(html, "twitter:title") ||
          findStringValue(jsonLd, ["headline"]) ||
          findStringValue(jsonLd, ["name"]) ||
          getDocumentTitle(html),
      ) || null;
    const sourceExcerpt =
      sanitizeText(
        getMetaContent(html, "description") ||
          getMetaContent(html, "og:description") ||
          findStringValue(jsonLd, ["description"]) ||
          extractBodyExcerpt(html),
      ) || null;

    return {
      sourceTitle,
      sourceExcerpt,
      genreName:
        findStringValue(jsonLd, ["genre"]) ||
        (sourcePlatform === "youtube" || sourcePlatform === "youtube-music"
          ? null
          : getMetaContent(html, "keywords")) ||
        findStringValue(jsonLd, ["keywords"]) ||
        null,
      labelName:
        findStringValue(jsonLd, ["recordLabel", "name"]) ||
        findStringValue(jsonLd, ["publisher", "name"]) ||
        null,
      sourceImageUrl:
        resolveUrl(
          getMetaContent(html, "og:image") || getMetaContent(html, "twitter:image") || "",
          finalUrl,
        ) ||
        fallbackSourceImage ||
        null,
      youtubeUrl: platformLinkCandidates.youtubeUrl || platformLinks.youtubeUrl || null,
      youtubeMusicUrl:
        platformLinkCandidates.youtubeMusicUrl || platformLinks.youtubeMusicUrl || null,
      bandcampUrl: platformLinkCandidates.bandcampUrl || platformLinks.bandcampUrl || null,
    };
  } catch {
    return {};
  }
}

function getMetaContent(html: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escapedName}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function extractAnchorCandidates(html: string, baseUrl: string) {
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates: Array<{ href: string; text: string }> = [];

  for (const match of html.matchAll(anchorPattern)) {
    const href = resolveUrl(match[1], baseUrl);
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    if (href) {
      candidates.push({ href, text });
    }
  }

  return candidates;
}

async function resolvePlatformCandidates(candidates: Array<{ href: string; text: string }>) {
  const result: {
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
  } = {};

  const prioritized = candidates.filter((candidate) =>
    /(youtube music|youtube|bandcamp)/i.test(candidate.text) ||
    /(yt|youtube|bandcamp)/i.test(candidate.href),
  );

  for (const candidate of prioritized.slice(0, 8)) {
    const resolvedUrl = await resolveFinalUrl(candidate.href);
    const directLinks = detectDirectPlatformUrls([candidate.href, resolvedUrl]);

    result.youtubeUrl = result.youtubeUrl || directLinks.youtubeUrl || null;
    result.youtubeMusicUrl = result.youtubeMusicUrl || directLinks.youtubeMusicUrl || null;
    result.bandcampUrl = result.bandcampUrl || directLinks.bandcampUrl || null;
  }

  return result;
}

async function resolveFinalUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });
    return response.url;
  } catch {
    return url;
  }
}

function detectDirectPlatformUrls(urls: string[]) {
  const result: {
    youtubeUrl?: string | null;
    youtubeMusicUrl?: string | null;
    bandcampUrl?: string | null;
  } = {};

  for (const url of urls) {
    const platform = detectPlatform(url);
    if (platform === "youtube") {
      result.youtubeUrl = result.youtubeUrl || url;
    }
    if (platform === "youtube-music") {
      result.youtubeMusicUrl = result.youtubeMusicUrl || url;
    }
    if (platform === "bandcamp") {
      result.bandcampUrl = result.bandcampUrl || url;
    }
  }

  return result;
}

function parseJsonLd(html: string) {
  const scriptPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const parsed: unknown[] = [];

  for (const match of html.matchAll(scriptPattern)) {
    try {
      parsed.push(JSON.parse(match[1].trim()));
    } catch {
      continue;
    }
  }

  return parsed;
}

function findStringValue(input: unknown, path: string[]): string | null {
  if (input === null || input === undefined) {
    return null;
  }

  if (path.length === 0) {
    if (typeof input === "string") {
      return input;
    }

    if (Array.isArray(input)) {
      for (const item of input) {
        const found = findStringValue(item, []);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findStringValue(item, path);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (typeof input !== "object") {
    return null;
  }

  const current = input as Record<string, unknown>;
  const [head, ...tail] = path;
  const next = current[head];

  if (tail.length === 0) {
    if (typeof next === "string") {
      return next;
    }

    if (Array.isArray(next)) {
      const match = next.find((item) => typeof item === "string");
      return typeof match === "string" ? match : null;
    }
  }

  if (next) {
    const direct = findStringValue(next, tail);
    if (direct) {
      return direct;
    }
  }

  for (const value of Object.values(current)) {
    const nested = findStringValue(value, path);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function getDocumentTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function extractBodyExcerpt(html: string) {
  const matches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const paragraphs = matches
    .map((match) => sanitizeText(match[1]))
    .filter((value): value is string => Boolean(value))
    .filter((value) => isMeaningfulExcerpt(value));

  if (paragraphs.length === 0) {
    return null;
  }

  return paragraphs.slice(0, 2).join(" ").slice(0, 320).trim();
}

function sanitizeText(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(read more|subscribe|newsletter|cookie policy|privacy policy|all rights reserved)\b/gi, " ")
    .trim();
}

function isMeaningfulExcerpt(value: string) {
  if (value.length < 70) {
    return false;
  }

  const normalized = value.toLowerCase();
  const blocked = [
    "javascript",
    "newsletter",
    "subscribe",
    "cookie",
    "privacy policy",
    "advertisement",
    "sign up",
    "log in",
    "accept all",
  ];

  return !blocked.some((term) => normalized.includes(term));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function resolveUrl(href: string, baseUrl: string) {
  if (!href) {
    return null;
  }

  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function resolveSourceArtworkFromUrl(url: string) {
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  return null;
}

function extractYouTubeId(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace(/^\/+/, "") || null;
    }

    if (!parsed.hostname.includes("youtube.com")) {
      return null;
    }

    const directVideoId = parsed.searchParams.get("v");
    if (directVideoId) {
      return directVideoId;
    }

    const segments = parsed.pathname.split("/").filter(Boolean);
    const liveIndex = segments.findIndex((segment) => segment === "live");
    if (liveIndex >= 0 && segments[liveIndex + 1]) {
      return segments[liveIndex + 1];
    }

    const shortIndex = segments.findIndex((segment) => segment === "shorts");
    if (shortIndex >= 0 && segments[shortIndex + 1]) {
      return segments[shortIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
}
