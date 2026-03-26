type GenreOverrideInput = {
  artistName?: string | null;
  projectTitle?: string | null;
  title?: string | null;
};

const RELEASE_GENRE_OVERRIDES = new Map<string, string>([
  ["ohuhitsshylo::toxic wrld", "melodic rap / emo rap / alternative pop"],
  ["yttling jazz bobby gillespie::strange", "cinematic jazz / indie pop / jazz-pop"],
  ["olive vox::14 years", "alternative rock / punk rock / progressive rock"],
  ["trip villain vixen maw::villain maw", "industrial metal / industrial techno / metal"],
  ["trip villain::villain maw", "industrial metal / industrial techno / metal"],
]);

export function getGenreOverride(input: GenreOverrideInput) {
  const normalizedArtist = normalizeKeyPart(input.artistName || "");
  const normalizedProject = normalizeKeyPart(input.projectTitle || "");
  const normalizedTitle = normalizeKeyPart(input.title || "");

  if (normalizedArtist && normalizedProject) {
    const releaseMatch = RELEASE_GENRE_OVERRIDES.get(`${normalizedArtist}::${normalizedProject}`);
    if (releaseMatch) {
      return releaseMatch;
    }
  }

  if (normalizedArtist && normalizedTitle) {
    const titleMatch = RELEASE_GENRE_OVERRIDES.get(`${normalizedArtist}::${normalizedTitle}`);
    if (titleMatch) {
      return titleMatch;
    }
  }

  return null;
}

function normalizeKeyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\b(feat\.?|featuring|ft\.?)\b/g, " ")
    .replace(/[()[\]{}]/g, " ")
    .replace(/[–—-]/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
