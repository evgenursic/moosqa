import { getSearchGenreFacets } from "@/lib/release-sections";

export const dynamic = "force-dynamic";

export async function GET() {
  const genres = await getSearchGenreFacets();

  return Response.json({
    genres,
  });
}
