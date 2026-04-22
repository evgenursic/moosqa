import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export const APP_MANIFEST_DESCRIPTION =
  "Editorial music radar for fresh indie songs, albums, EPs and live sessions from r/indieheads.";

function toOrigin(siteUrl: string) {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return "https://moosqa-ci4e.vercel.app";
  }
}

export function buildAppManifest(siteUrl = getSiteUrl()): MetadataRoute.Manifest {
  const origin = toOrigin(siteUrl);

  return {
    name: "MooSQA | Music Radar",
    short_name: "MooSQA",
    description: APP_MANIFEST_DESCRIPTION,
    id: origin,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#dbe4f1",
    theme_color: "#526eaa",
    categories: ["music", "entertainment", "news"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
