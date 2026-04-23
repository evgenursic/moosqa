import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  const host = new URL(siteUrl).host;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/debug", "/ops", "/account", "/auth/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host,
  };
}
