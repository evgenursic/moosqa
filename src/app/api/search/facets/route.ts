import { getSearchOverlayPayload } from "@/lib/search-overlay";

export async function GET() {
  const payload = await getSearchOverlayPayload();

  return Response.json({
    genres: payload.genres,
  });
}
