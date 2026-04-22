import type { MetadataRoute } from "next";

import { buildAppManifest } from "@/lib/app-manifest";

export default function manifest(): MetadataRoute.Manifest {
  return buildAppManifest();
}
