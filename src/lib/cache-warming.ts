import { getSearchOverlayPayload } from "@/lib/search-overlay";
import {
  getHomepageSectionsData,
  getSearchReleases,
  getSectionArchivePage,
  type ReleaseSectionKey,
} from "@/lib/release-sections";
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
