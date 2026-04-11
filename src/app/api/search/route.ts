import { filterAndRankReleaseListings } from "@/lib/release-search";
import { getSearchReleases } from "@/lib/release-sections";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 16;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";
  const type = searchParams.get("type") || "";
  const genre = searchParams.get("genre") || "";
  const platform = searchParams.get("platform") || "";
  const directOnly = searchParams.get("direct") === "1";
  const limit = clampLimit(searchParams.get("limit"));

  const releases = await getSearchReleases();
  const filtered = filterAndRankReleaseListings(releases, {
    query,
    type,
    genre,
    platform,
    directOnly,
  });

  return Response.json({
    total: filtered.length,
    results: filtered.slice(0, limit).map((release) => ({
      ...release,
      publishedAt: release.publishedAt.toISOString(),
    })),
  });
}

function clampLimit(value: string | null) {
  const parsed = Number.parseInt(value || "", 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}
