import type { ReleaseSectionKey } from "@/lib/release-sections";

export type ArchiveViewMode = "latest" | "trending";

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
