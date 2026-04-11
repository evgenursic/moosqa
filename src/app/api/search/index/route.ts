import { getSearchOverlayPayload } from "@/lib/search-overlay";

const SEARCH_INDEX_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=3600";

export async function GET() {
  const payload = await getSearchOverlayPayload();

  return Response.json(payload, {
    headers: {
      "Cache-Control": SEARCH_INDEX_CACHE_CONTROL,
    },
  });
}
