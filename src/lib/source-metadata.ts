import { detectPlatform } from "@/lib/listening-links";
import { buildGenreProfile } from "@/lib/genre-profile";

const USER_AGENT =
  process.env.SOURCE_FETCH_USER_AGENT ||
  `MooSQA/0.3 (${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`;

const MAX_SOURCE_METADATA_DEPTH = 2;

type SourceMetadata = {
  sourceTitle?: string | null;
  sourceExcerpt?: string | null;
  artistNameHint?: string | null;
  genreName?: string | null;
  labelName?: string | null;
  releaseDate?: Date | null;
  sourceImageUrl?: string | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  officialWebsiteUrl?: string | null;
  officialStoreUrl?: string | null;
};

type ResolveSourceOptions = {
  artistName?: string | null;
  projectTitle?: string | null;
  title?: string | null;
};

export async function resolveSourceMetadata(
  sourceUrl: string,
  options: ResolveSourceOptions = {},
): Promise<SourceMetadata> {
  return resolveSourceMetadataInternal(sourceUrl, options, 0);
}

async function resolveSourceMetadataInternal(
  sourceUrl: string,
  options: ResolveSourceOptions,
  depth: number,
): Promise<SourceMetadata> {
  if (depth > MAX_SOURCE_METADATA_DEPTH) {
    return {};
  }

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
    const youtubeOEmbed =
      sourcePlatform === "youtube" || sourcePlatform === "youtube-music"
        ? await resolveYouTubeOEmbedMetadata(finalUrl)
        : null;

    if (!contentType.includes("text/html")) {
      return {
        artistNameHint: youtubeOEmbed?.artistName || null,
        ...platformLinks,
        sourceTitle: youtubeOEmbed?.title || null,
        sourceImageUrl: youtubeOEmbed?.thumbnailUrl || fallbackSourceImage,
      };
    }

    const html = await response.text();
    const hrefCandidates = extractAnchorCandidates(html, finalUrl);
    const platformLinkCandidates = await resolvePlatformCandidates(hrefCandidates);
    const officialLinkCandidates = resolveOfficialSiteCandidates(hrefCandidates, finalUrl);
    const jsonLd = parseJsonLd(html);
    const rawLabelName =
      findStringValue(jsonLd, ["recordLabel", "name"]) ||
      findStringValue(jsonLd, ["publisher", "name"]) ||
      null;
    const descriptionCandidates = collectDescriptionCandidates(html, jsonLd);
    const sourceTitle =
      sanitizeText(
        getMetaContent(html, "og:title") ||
          getMetaContent(html, "twitter:title") ||
          findStringValue(jsonLd, ["headline"]) ||
          findStringValue(jsonLd, ["name"]) ||
          getDocumentTitle(html) ||
          youtubeOEmbed?.title ||
          "",
      ) || null;
    const sourceExcerpt =
      pickBestDescription(descriptionCandidates) || null;
    const releaseDate =
      extractStructuredReleaseDate(jsonLd, sourcePlatform) ||
      extractMetaReleaseDate(html) ||
      extractBandcampReleaseDate(html) ||
      extractTextualReleaseDate([sourceTitle, sourceExcerpt].filter(Boolean).join(". ")) ||
      null;
    const rawGenreCandidates = [
      sourcePlatform !== "youtube" && sourcePlatform !== "youtube-music"
        ? getMetaContent(html, "keywords")
        : null,
      ...findStringValues(jsonLd, ["keywords"]),
      ...findStringValues(jsonLd, ["genre"]),
      ...extractBandcampTags(html),
      ...extractBandcampJsonKeywords(html),
      ...extractBandcampStructuredGenres(html),
    ];
    const genreName =
      buildGenreProfile({
        explicitGenres: rawGenreCandidates,
        text: [sourceTitle, sourceExcerpt].filter(Boolean).join(". "),
        artistName: options.artistName || null,
        projectTitle: options.projectTitle || null,
        title: options.title || null,
        labelName: rawLabelName,
      }) || null;
    const sourceImageUrl =
      resolveUrl(
        getMetaContent(html, "og:image") ||
          getMetaContent(html, "twitter:image") ||
          getLinkHref(html, "image_src") ||
          findStringValue(jsonLd, ["image"]) ||
          "",
        finalUrl,
      ) ||
      youtubeOEmbed?.thumbnailUrl ||
      fallbackSourceImage ||
      null;

    const baseMetadata: SourceMetadata = {
      sourceTitle,
      sourceExcerpt,
      artistNameHint: youtubeOEmbed?.artistName || null,
      genreName,
      labelName: rawLabelName,
      releaseDate,
      sourceImageUrl,
      youtubeUrl: platformLinks.youtubeUrl || platformLinkCandidates.youtubeUrl || null,
      youtubeMusicUrl:
        platformLinks.youtubeMusicUrl || platformLinkCandidates.youtubeMusicUrl || null,
      bandcampUrl: platformLinks.bandcampUrl || platformLinkCandidates.bandcampUrl || null,
      officialWebsiteUrl:
        officialLinkCandidates.officialWebsiteUrl ||
        inferOfficialWebsiteFromSource(finalUrl) ||
        null,
      officialStoreUrl: officialLinkCandidates.officialStoreUrl || null,
    };

    if (
      sourcePlatform === "bandcamp" &&
      depth === 0 &&
      isBandcampCatalogUrl(finalUrl) &&
      needsDeeperBandcampMetadata(baseMetadata)
    ) {
      const matchedBandcampUrl = findBestBandcampDiscographyUrl(html, finalUrl, options);
      if (matchedBandcampUrl && matchedBandcampUrl !== finalUrl) {
        const deepMetadata = await resolveSourceMetadataInternal(matchedBandcampUrl, options, depth + 1);
        return mergeSourceMetadata(baseMetadata, deepMetadata);
      }
    }

    if (
      sourcePlatform === "youtube-music" &&
      depth === 0 &&
      (!baseMetadata.releaseDate || !baseMetadata.youtubeUrl)
    ) {
      const canonicalYouTubeUrl = buildCanonicalYouTubeWatchUrl(finalUrl);
      if (canonicalYouTubeUrl && canonicalYouTubeUrl !== finalUrl) {
        const deepMetadata = await resolveSourceMetadataInternal(
          canonicalYouTubeUrl,
          options,
          depth + 1,
        );
        return mergeSourceMetadata(baseMetadata, deepMetadata);
      }
    }

    return baseMetadata;
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

function extractBandcampTags(html: string) {
  return [...html.matchAll(/<a[^>]+class=["'][^"']*\btag\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => sanitizeText(match[1]))
    .filter((value): value is string => Boolean(value));
}

function extractBandcampJsonKeywords(html: string) {
  return [...html.matchAll(/"keywords"\s*:\s*\[(.*?)\]/gi)]
    .flatMap((match) =>
      [...match[1].matchAll(/"([^"]+)"/g)].map((keywordMatch) => sanitizeText(keywordMatch[1])),
    )
    .filter((value): value is string => Boolean(value));
}

function extractBandcampStructuredGenres(html: string) {
  return [...html.matchAll(/"genre"\s*:\s*"([^"]+)"/gi)]
    .map((match) => sanitizeText(match[1]))
    .filter((value): value is string => Boolean(value));
}

function findBestBandcampDiscographyUrl(
  html: string,
  baseUrl: string,
  options: ResolveSourceOptions,
) {
  const entries = [...html.matchAll(/<li[^>]+class="music-grid-item[\s\S]*?<\/li>/gi)]
    .map((match) => {
      const block = match[0];
      const href = resolveUrl(
        block.match(/<a[^>]+href="([^"]+)"/i)?.[1] || "",
        baseUrl,
      );
      const title = sanitizeText(
        block.match(/<p class="title">\s*([\s\S]*?)<\/p>/i)?.[1] || "",
      );

      return href && title ? { href, title } : null;
    })
    .filter((entry): entry is { href: string; title: string } => Boolean(entry));

  if (entries.length === 0) {
    return null;
  }

  const hints = buildBandcampTitleHints(options);
  let bestEntry = entries[0];
  let bestScore = -1;

  for (const entry of entries) {
    const score = scoreBandcampDiscographyEntry(entry.title, hints);
    if (score > bestScore) {
      bestEntry = entry;
      bestScore = score;
    }
  }

  return bestEntry.href;
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

function resolveOfficialSiteCandidates(
  candidates: Array<{ href: string; text: string }>,
  baseUrl: string,
) {
  const result: {
    officialWebsiteUrl?: string | null;
    officialStoreUrl?: string | null;
  } = {};

  for (const candidate of candidates.slice(0, 80)) {
    const href = candidate.href;
    const text = candidate.text;
    if (!href || !text) {
      continue;
    }

    if (isIgnoredOfficialDomain(href, baseUrl)) {
      continue;
    }

    if (
      !result.officialStoreUrl &&
      /\b(store|shop|merch|merchandise|vinyl|cd|cassette|buy|order)\b/i.test(text)
    ) {
      result.officialStoreUrl = href;
    }

    if (
      !result.officialWebsiteUrl &&
      /\b(official site|official website|website|homepage|home page|artist site|visit site)\b/i.test(text)
    ) {
      result.officialWebsiteUrl = href;
    }
  }

  if (!result.officialWebsiteUrl) {
    const likelyOfficial = candidates.find(
      (candidate) =>
        !isIgnoredOfficialDomain(candidate.href, baseUrl) &&
        !/\b(store|shop|merch|buy|order)\b/i.test(candidate.text) &&
        /\b(about|bio|contact|tour|music|home)\b/i.test(candidate.text),
    );
    result.officialWebsiteUrl = likelyOfficial?.href || null;
  }

  if (!result.officialWebsiteUrl && !isIgnoredOfficialDomain(baseUrl, baseUrl)) {
    result.officialWebsiteUrl = baseUrl;
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

function inferOfficialWebsiteFromSource(url: string) {
  if (isIgnoredOfficialDomain(url, url)) {
    return null;
  }

  return url;
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

function findStringValues(input: unknown, path: string[]): string[] {
  if (input === null || input === undefined) {
    return [];
  }

  if (path.length === 0) {
    if (typeof input === "string") {
      return [input];
    }

    if (Array.isArray(input)) {
      return input.flatMap((item) => findStringValues(item, []));
    }

    return [];
  }

  if (Array.isArray(input)) {
    return input.flatMap((item) => findStringValues(item, path));
  }

  if (typeof input !== "object") {
    return [];
  }

  const current = input as Record<string, unknown>;
  const [head, ...tail] = path;
  const next = current[head];

  if (next === null || next === undefined) {
    return Object.values(current).flatMap((value) => findStringValues(value, path));
  }

  return findStringValues(next, tail);
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

function collectDescriptionCandidates(html: string, jsonLd: unknown[]) {
  const candidates = [
    getMetaContent(html, "description"),
    getMetaContent(html, "og:description"),
    getMetaContent(html, "twitter:description"),
    ...findStringValues(jsonLd, ["description"]),
    extractBandcampAboutText(html),
    extractBodyExcerpt(html),
  ]
    .map((value) => sanitizeText(value))
    .filter((value): value is string => Boolean(value));

  return [...new Set(candidates)];
}

function pickBestDescription(candidates: string[]) {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreDescriptionCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.candidate || null;
}

function extractBandcampAboutText(html: string) {
  const patterns = [
    /<div[^>]+id=["']tralbum-about["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*\btralbumData\b[^"']*\btralbum-about\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*\btralbumData\b[^"']*\babout\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<meta[^>]+name=["']title["'][^>]+content=["'][^"']+["'][\s\S]*?<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const candidate = sanitizeText(match?.[1] || "");
    if (candidate && isMeaningfulExcerpt(candidate)) {
      return candidate;
    }
  }

  return null;
}

function scoreDescriptionCandidate(value: string) {
  const normalized = value.toLowerCase();
  let score = Math.min(value.length, 320);

  if (value.length < 60) {
    score -= 50;
  }

  if (/(released?|out now|debut|album|ep|single|track|collaboration|live|session)/i.test(value)) {
    score += 28;
  }

  if (
    /\b(ambient|electronic|shoegaze|dream pop|jangle pop|post-punk|math rock|slowcore|krautrock|jungle|drum and bass|neo-soul|folk|jazz|punk|hardcore|synth-pop|chamber pop|baroque pop|experimental)\b/i.test(
      value,
    )
  ) {
    score += 24;
  }

  if (/\d+\.\s/.test(value) || /\btracklist\b/i.test(value)) {
    score -= 35;
  }

  if (normalized.includes("listen on spotify") || normalized.includes("listen to ")) {
    score -= 12;
  }

  if (normalized.includes("browser is outdated") || normalized.includes("brskalnik")) {
    score -= 40;
  }

  return score;
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

function extractMetaReleaseDate(html: string) {
  const candidates = [
    getMetaContent(html, "music:release_date"),
    getMetaContent(html, "release_date"),
    getMetaContent(html, "article:published_time"),
    getMetaContent(html, "og:published_time"),
    getMetaContent(html, "video:release_date"),
    extractMetaItemPropDate(html, "datePublished"),
    extractMetaItemPropDate(html, "uploadDate"),
    extractJsonFieldDate(html, "uploadDate"),
    extractJsonFieldDate(html, "datePublished"),
  ];

  for (const candidate of candidates) {
    if (candidate instanceof Date) {
      return candidate;
    }

    const parsed = parseDateCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractBandcampReleaseDate(html: string) {
  const jsonMatch = html.match(/"album_release_date"\s*:\s*"([^"]+)"/i);
  const textMatch = html.match(/\breleased\s+([A-Z][a-z]+ \d{1,2}, \d{4})/i);
  const dataAttrMatch = html.match(/data-release-date=["']([^"']+)["']/i);

  return (
    parseDateCandidate(jsonMatch?.[1] || null) ||
    parseDateCandidate(textMatch?.[1] || null) ||
    parseDateCandidate(dataAttrMatch?.[1] || null) ||
    null
  );
}

function extractStructuredReleaseDate(jsonLd: unknown[], sourcePlatform: string | null) {
  const allowedMusicTypes = new Set([
    "MusicAlbum",
    "MusicRecording",
    "MusicRelease",
    "MusicComposition",
  ]);

  if (sourcePlatform === "youtube" || sourcePlatform === "youtube-music") {
    allowedMusicTypes.add("VideoObject");
  }

  for (const node of jsonLd) {
    const structuredDate = findReleaseDateInJsonLdNode(node, allowedMusicTypes, sourcePlatform);
    if (structuredDate) {
      return structuredDate;
    }
  }

  return null;
}

function extractMetaItemPropDate(html: string, itemProp: string) {
  const escaped = itemProp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+itemprop=["']${escaped}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']${escaped}["']`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const parsed = parseDateCandidate(match?.[1] || null);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractJsonFieldDate(html: string, fieldName: string) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`"${escaped}"\\s*:\\s*"([^"]+)"`, "i"));
  return parseDateCandidate(match?.[1] || null);
}

function findReleaseDateInJsonLdNode(
  node: unknown,
  allowedMusicTypes: Set<string>,
  sourcePlatform: string | null,
): Date | null {
  if (!node) {
    return null;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      const nested = findReleaseDateInJsonLdNode(item, allowedMusicTypes, sourcePlatform);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (typeof node !== "object") {
    return null;
  }

  const record = node as Record<string, unknown>;
  const rawType = record["@type"];
  const types = (Array.isArray(rawType) ? rawType : [rawType]).flatMap((value) =>
    typeof value === "string" ? [value] : [],
  );
  const isMusicNode = types.some((value) => allowedMusicTypes.has(value));
  const isBandcampLikeNode = sourcePlatform === "bandcamp" && types.length > 0;

  if (isMusicNode || isBandcampLikeNode) {
    const directDate =
      parseDateCandidate(asString(record.datePublished)) ||
      parseDateCandidate(asString(record.dateCreated)) ||
      parseDateCandidate(asString(record.releaseDate)) ||
      parseDateCandidate(asString(record.startDate));

    if (directDate) {
      return directDate;
    }
  }

  for (const value of Object.values(record)) {
    const nested = findReleaseDateInJsonLdNode(value, allowedMusicTypes, sourcePlatform);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractTextualReleaseDate(text: string) {
  if (!text) {
    return null;
  }

  const patterns = [
    /\b(?:released|release date|out|due|arrives|arriving|coming)\s+(?:on\s+)?([A-Z][a-z]+ \d{1,2}, \d{4})/i,
    /\b(?:released|release date|out|due|arrives|arriving|coming)\s+(?:on\s+)?(\d{4}-\d{2}-\d{2})/i,
    /\b([A-Z][a-z]+ \d{1,2}, \d{4})\s+(?:release|arrival|street date)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const parsed = parseDateCandidate(match?.[1] || null);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseDateCandidate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/GMT|UTC/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getLinkHref(html: string, relValue: string) {
  const escapedRel = relValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<link[^>]+rel=["']${escapedRel}["'][^>]+href=["']([^"']+)["']`, "i"),
    new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["']${escapedRel}["']`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return null;
}

function mergeSourceMetadata(base: SourceMetadata, deep: SourceMetadata): SourceMetadata {
  return {
    sourceTitle: deep.sourceTitle || base.sourceTitle || null,
    sourceExcerpt: deep.sourceExcerpt || base.sourceExcerpt || null,
    artistNameHint: deep.artistNameHint || base.artistNameHint || null,
    genreName:
      deep.genreName && deep.genreName !== "music"
        ? deep.genreName
        : base.genreName || null,
    labelName: deep.labelName || base.labelName || null,
    releaseDate: deep.releaseDate || base.releaseDate || null,
    sourceImageUrl: deep.sourceImageUrl || base.sourceImageUrl || null,
    youtubeUrl: deep.youtubeUrl || base.youtubeUrl || null,
    youtubeMusicUrl: deep.youtubeMusicUrl || base.youtubeMusicUrl || null,
    bandcampUrl: deep.bandcampUrl || base.bandcampUrl || null,
    officialWebsiteUrl: deep.officialWebsiteUrl || base.officialWebsiteUrl || null,
    officialStoreUrl: deep.officialStoreUrl || base.officialStoreUrl || null,
  };
}

function buildBandcampTitleHints(options: ResolveSourceOptions) {
  const candidates = [options.projectTitle, options.title]
    .flatMap((value) =>
      (value || "")
        .split(/\s*\/\s*/)
        .map((part) => cleanHint(part))
        .filter(Boolean),
    )
    .filter((value, index, values) => values.indexOf(value) === index);

  return candidates;
}

function cleanHint(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\((official|music|lyric|visualizer|audio|video)[^)]+\)/gi, " ")
      .replace(/\b(official music video|official video|lyric video|visualizer|official audio)\b/gi, " ")
      .replace(/\((19|20)\d{2}\)/g, " ")
      .replace(/\bout\s+[a-z]+\s+\d{1,2}.*$/i, " ")
      .replace(/[()[\]{}]/g, " ")
      .replace(/[!"'`]+/g, "")
      .trim(),
  ).toLowerCase();
}

function scoreBandcampDiscographyEntry(title: string, hints: string[]) {
  if (hints.length === 0) {
    return 0;
  }

  const normalizedTitle = cleanHint(title);
  let score = 0;

  for (const hint of hints) {
    if (!hint) {
      continue;
    }

    if (normalizedTitle === hint) {
      score += 12;
      continue;
    }

    if (normalizedTitle.includes(hint)) {
      score += 8;
      continue;
    }

    if (hint.includes(normalizedTitle) && normalizedTitle.length >= 4) {
      score += 6;
    }
  }

  return score;
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

function isBandcampCatalogUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("bandcamp.com")) {
      return false;
    }

    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return pathname === "/" || pathname === "/music";
  } catch {
    return false;
  }
}

function needsDeeperBandcampMetadata(metadata: SourceMetadata) {
  if (!metadata.sourceImageUrl) {
    return true;
  }

  if (!metadata.genreName) {
    return true;
  }

  const normalizedGenre = metadata.genreName.toLowerCase().trim();
  return normalizedGenre === "music" || normalizedGenre === "indie / alternative";
}

function resolveSourceArtworkFromUrl(url: string) {
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  }

  return null;
}

function isIgnoredOfficialDomain(url: string, baseUrl: string) {
  try {
    const parsed = new URL(url);
    const base = new URL(baseUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === base.hostname.toLowerCase() &&
      isPublicationLikeHost(hostname)
    ) {
      return true;
    }

    if (detectPlatform(url)) {
      return true;
    }

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
      "soundcloud.com",
      "open.spotify.com",
      "spotify.com",
      "music.apple.com",
      "apple.com",
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

    if (blockedHosts.some((blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`))) {
      return true;
    }

    return isPublicationLikeHost(hostname);
  } catch {
    return true;
  }
}

function isPublicationLikeHost(hostname: string) {
  const publicationHints = [
    "pitchfork.com",
    "floodmagazine.com",
    "stereogum.com",
    "nme.com",
    "rollingstone.com",
    "thelineofbestfit.com",
    "consequence.net",
    "brooklynvegan.com",
    "undertheradarmag.com",
    "clashmusic.com",
    "faroutmagazine.co.uk",
    "paste",
    "dork",
    "audiotree",
    "kexp",
    "npr.org",
    "bbc.co.uk",
    "youtube.com",
    "youtu.be",
  ];

  return publicationHints.some((hint) => hostname.includes(hint));
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

function buildCanonicalYouTubeWatchUrl(url: string) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    return null;
  }

  return `https://www.youtube.com/watch?v=${videoId}`;
}

async function resolveYouTubeOEmbedMetadata(url: string) {
  const youtubeId = extractYouTubeId(url);
  const normalizedUrl = youtubeId
    ? `https://www.youtube.com/watch?v=${youtubeId}`
    : url;

  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };

    return {
      title: sanitizeText(payload.title || "") || null,
      artistName:
        sanitizeText((payload.author_name || "").replace(/\s+-\s+Topic$/i, "")) || null,
      thumbnailUrl: payload.thumbnail_url || null,
    };
  } catch {
    return null;
  }
}
