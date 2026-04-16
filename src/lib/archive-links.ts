import type { ReleaseSectionKey } from "@/lib/release-sections";

export type ArchiveViewMode = "latest" | "trending";
export type PlatformArchiveSlug = "bandcamp" | "youtube" | "youtube-music";
export type ArchiveTimeframe = "today" | "7d" | "30d";
export type SignalArchiveSlug =
  | "opened"
  | "shared"
  | "listened"
  | "liked"
  | "disliked"
  | "discussed";
export type SignalArchiveTimeframe = ArchiveTimeframe;
export type PlatformArchiveTimeframe = ArchiveTimeframe;

export function buildArchiveHref(
  section: ReleaseSectionKey | string,
  options?: {
    page?: number;
    genre?: string | null;
    view?: ArchiveViewMode | null;
  },
) {
  const params = new URLSearchParams();

  if (options?.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  if (options?.genre) {
    params.set("genre", options.genre);
  }

  if (options?.view && options.view !== "latest") {
    params.set("view", options.view);
  }

  const query = params.toString();
  return query ? `/browse/${section}?${query}` : `/browse/${section}`;
}

export function parseArchiveViewMode(value: string | string[] | undefined): ArchiveViewMode {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "trending" ? "trending" : "latest";
}

export function buildTrendingGenreHref(genre: string) {
  return `/trending/${slugifyGenre(genre)}`;
}

export function buildPlatformArchiveHref(
  platform: PlatformArchiveSlug,
  page?: number,
  timeframe?: PlatformArchiveTimeframe | null,
) {
  const params = new URLSearchParams();
  if (page && page > 1) {
    params.set("page", String(page));
  }
  if (timeframe && timeframe !== "7d") {
    params.set("window", timeframe);
  }

  const query = params.toString();
  return query ? `/platform/${platform}?${query}` : `/platform/${platform}`;
}

export function buildSignalArchiveHref(
  signal: SignalArchiveSlug,
  page?: number,
  timeframe?: SignalArchiveTimeframe | null,
) {
  const params = new URLSearchParams();
  if (page && page > 1) {
    params.set("page", String(page));
  }
  if (timeframe && timeframe !== "7d") {
    params.set("window", timeframe);
  }

  const query = params.toString();
  return query ? `/signals/${signal}?${query}` : `/signals/${signal}`;
}

export function parseSignalArchiveTimeframe(
  value: string | string[] | undefined,
  fallback: SignalArchiveTimeframe = "7d",
): SignalArchiveTimeframe {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "today" || raw === "7d" || raw === "30d") {
    return raw;
  }

  return fallback;
}

export function parsePlatformArchiveTimeframe(
  value: string | string[] | undefined,
  fallback: PlatformArchiveTimeframe = "7d",
): PlatformArchiveTimeframe {
  return parseSignalArchiveTimeframe(value, fallback);
}

export function buildSceneArchiveHref(scene: string, page?: number) {
  const params = new URLSearchParams();
  if (page && page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();
  return query ? `/scene/${scene}?${query}` : `/scene/${scene}`;
}

export function slugifyGenre(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replaceAll("&", " and ")
    .replaceAll("/", " ")
    .replaceAll("+", " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
