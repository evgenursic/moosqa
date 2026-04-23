import { fetchPublicHttpUrl } from "@/lib/safe-url";

export async function resolveSocialImageDataUrl(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  try {
    const response = await fetchPublicHttpUrl(sourceUrl, {
      cache: "force-cache",
      headers: {
        "user-agent": "MooSQA/1.0 (+https://moosqa-ci4e.vercel.app)",
      },
    });

    if (!response?.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
