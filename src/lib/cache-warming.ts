import { getSearchOverlayPayload } from "@/lib/search-overlay";
import { getPublicAnalyticsInsights } from "@/lib/analytics";
import {
  getHomepageSectionsData,
  getSearchReleases,
  getSectionArchivePage,
  type ReleaseListingItem,
  type ReleaseSectionKey,
} from "@/lib/release-sections";
import { prisma } from "@/lib/prisma";
import { getReleaseBySlug } from "@/lib/sync-releases";

const CRITICAL_SECTIONS: ReleaseSectionKey[] = [
  "latest",
  "top-rated",
  "top-engaged",
  "albums",
  "eps",
  "live",
];

export async function warmCriticalCaches() {
  const homepage = await getHomepageSectionsData();

  await Promise.all([
    getPublicAnalyticsInsights(),
    getSearchOverlayPayload(),
    getSearchReleases(),
    ...CRITICAL_SECTIONS.map((section) => getSectionArchivePage(section, 1)),
    ...homepage.latest.slice(0, 8).map((release) => getReleaseBySlug(release.slug)),
  ]);

  return {
    warmedSections: CRITICAL_SECTIONS.length,
    warmedReleases: homepage.latest.slice(0, 8).length,
  };
}

export async function warmReleaseCachesById(releaseId: string) {
  const release = await prisma.release.findUnique({
    where: { id: releaseId },
    select: {
      slug: true,
    },
  });

  if (!release) {
    return { warmed: false };
  }

  await getReleaseBySlug(release.slug);

  return {
    warmed: true,
    slug: release.slug,
  };
}

export async function warmVisibleReleaseBatch(releases: ReleaseListingItem[]) {
  await Promise.all(releases.slice(0, 8).map((release) => getReleaseBySlug(release.slug)));
  return {
    warmed: Math.min(releases.length, 8),
  };
}
