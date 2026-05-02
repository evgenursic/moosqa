import { ReleaseType } from "@/generated/prisma/enums";
import { decodeHtmlEntities } from "@/lib/utils";

const BANDCAMP_SEARCH_URL = "https://bandcamp.com/search";
const BANDCAMP_SEARCH_TIMEOUT_MS = 6_000;
const BANDCAMP_SEARCH_BUDGET_MS = 10_000;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

type SearchInput = {
  artistName: string | null;
  projectTitle: string | null;
  title: string;
  releaseType: ReleaseType;
};

export async function searchBandcampRelease(input: SearchInput) {
  const queries = buildBandcampQueries(input);
  const deadline = Date.now() + BANDCAMP_SEARCH_BUDGET_MS;

  for (const { query, itemType, strictTitleMatch } of queries) {
    if (Date.now() >= deadline) {
      return null;
    }

    const result = await fetchBandcampSearchResult(input, query, itemType, strictTitleMatch);
    if (result) {
      return result;
    }
  }

  return null;
}

async function fetchBandcampSearchResult(
  input: SearchInput,
  query: string,
  itemType: "t" | "a",
  strictTitleMatch: boolean,
) {
  const searchUrl = `${BANDCAMP_SEARCH_URL}?q=${encodeURIComponent(query)}&item_type=${itemType}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BANDCAMP_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const results = parseBandcampSearchResults(html, input, itemType, strictTitleMatch);
    return results[0] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseBandcampSearchResults(
  html: string,
  input: SearchInput,
  preferredItemType: "t" | "a",
  strictTitleMatch: boolean,
) {
  const blocks = [...html.matchAll(/<li class="searchresult[\s\S]*?<\/li>/gi)];
  const results: Array<{ url: string; score: number }> = [];
  const normalizedArtist = normalizeText(cleanArtistName(input.artistName || ""));
  const normalizedTitle = normalizeText(cleanProjectTitle(input.projectTitle || input.title));

  for (const match of blocks) {
    const block = match[0];
    const href = decodeHtmlEntities(
      block.match(/<a class="artcont" href="([^"]+)"/i)?.[1] ||
        block.match(/<div class="heading">\s*<a href="([^"]+)"/i)?.[1] ||
        "",
    );
    const heading = sanitizeText(
      block.match(/<div class="heading">\s*<a[^>]*>([\s\S]*?)<\/a>/i)?.[1] || "",
    );
    const subhead = sanitizeText(
      block.match(/<div class="subhead">\s*([\s\S]*?)<\/div>/i)?.[1] || "",
    );
    const itemType = sanitizeText(
      block.match(/<div class="itemtype">\s*([\s\S]*?)<\/div>/i)?.[1] || "",
    );

    if (!href || !heading) {
      continue;
    }

    const score = scoreSearchResult(
      href,
      heading,
      subhead,
      itemType,
      preferredItemType,
      normalizedArtist,
      normalizedTitle,
      strictTitleMatch,
    );
    results.push({ url: stripBandcampSearchParams(href), score });
  }

  return results
    .sort((left, right) => right.score - left.score)
    .filter((result) => result.score > 0);
}

function scoreSearchResult(
  href: string,
  heading: string,
  subhead: string,
  itemType: string,
  preferredItemType: "t" | "a",
  normalizedArtist: string,
  normalizedTitle: string,
  strictTitleMatch: boolean,
) {
  const normalizedHref = normalizeText(href);
  const normalizedHeading = normalizeText(heading);
  const normalizedSubhead = normalizeText(subhead);
  const normalizedSubheadArtist = normalizedSubhead.match(/\bby\s+(.+)$/)?.[1] || "";
  const normalizedHost = normalizeText(getBandcampHostLabel(href));
  const normalizedItemType = normalizeText(itemType);
  let score = 0;

  if (
    strictTitleMatch &&
    normalizedTitle &&
    !normalizedHeading.includes(normalizedTitle) &&
    !normalizedHref.includes(normalizedTitle)
  ) {
    return 0;
  }

  if (normalizedTitle && normalizedHeading === normalizedTitle) {
    score += 12;
  } else if (normalizedTitle && normalizedTitle.includes(normalizedHeading)) {
    score += 8;
  } else if (normalizedTitle && normalizedHeading.includes(normalizedTitle)) {
    score += 6;
  }

  if (normalizedArtist && normalizedSubheadArtist.includes(normalizedArtist)) {
    score += 10;
  } else if (normalizedArtist && normalizedHost.includes(normalizedArtist)) {
    score += 8;
  } else if (normalizedArtist) {
    score -= 20;
  }

  if (normalizedHref.includes(normalizedHeading)) {
    score += 3;
  }

  if (normalizedSubhead) {
    score += 2;
  }

  if (
    (preferredItemType === "t" && normalizedItemType === "track") ||
    (preferredItemType === "a" && normalizedItemType === "album")
  ) {
    score += 4;
  } else if (normalizedItemType === "track" || normalizedItemType === "album") {
    score += 2;
  }

  return score;
}

function buildBandcampQueries(input: SearchInput) {
  const artistName = cleanArtistName(input.artistName || "");
  const projectTitle = cleanProjectTitle(input.projectTitle || input.title);
  const primaryItemType =
    input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP ? "a" : "t";
  const fallbackItemType = primaryItemType === "a" ? "t" : "a";
  const baseQuery = [artistName, projectTitle].filter(Boolean).join(" ").trim();
  const projectSegments = projectTitle
    .split(/\s*\/\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 3);

  return [
    { query: baseQuery, itemType: primaryItemType as "t" | "a", strictTitleMatch: true },
    { query: baseQuery, itemType: fallbackItemType as "t" | "a", strictTitleMatch: true },
    ...projectSegments.flatMap((segment) => [
      {
        query: [artistName, segment].filter(Boolean).join(" ").trim(),
        itemType: primaryItemType as "t" | "a",
        strictTitleMatch: true,
      },
      {
        query: [artistName, segment].filter(Boolean).join(" ").trim(),
        itemType: fallbackItemType as "t" | "a",
        strictTitleMatch: true,
      },
    ]),
    { query: artistName, itemType: primaryItemType as "t" | "a", strictTitleMatch: false },
    { query: artistName, itemType: fallbackItemType as "t" | "a", strictTitleMatch: false },
  ].filter((entry, index, entries) =>
    Boolean(entry.query) &&
    entries.findIndex(
      (candidate) =>
        candidate.query === entry.query &&
        candidate.itemType === entry.itemType &&
        candidate.strictTitleMatch === entry.strictTitleMatch,
    ) === index,
  );
}

function cleanArtistName(value: string) {
  return value
    .replace(/\b(feat\.?|featuring|ft\.?)\b.*$/i, "")
    .replace(/,.+$/, "")
    .replace(/\s+(?:&|and)\s+.+$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanProjectTitle(value: string) {
  return value
    .replace(/\((official|music|lyric|visualizer|audio|video)[^)]+\)/gi, " ")
    .replace(/\b(official music video|official video|lyric video|visualizer|official audio)\b/gi, " ")
    .replace(/\((19|20)\d{2}\)/g, " ")
    .replace(/\s+\/\s+['"].*?\bout\b.*$/i, " ")
    .replace(/\bout\s+[a-z]+\s+\d{1,2}.*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripBandcampSearchParams(value: string) {
  try {
    const parsed = new URL(value);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return value;
  }
}

function getBandcampHostLabel(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}
