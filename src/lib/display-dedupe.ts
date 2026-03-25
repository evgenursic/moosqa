import { ReleaseType } from "@/generated/prisma/enums";

type DedupeCandidate = {
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
};

export function dedupeReleasesForDisplay<T extends DedupeCandidate>(releases: T[]) {
  const seen = new Set<string>();

  return releases.filter((release) => {
    const key = buildNearDuplicateKey(release);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildNearDuplicateKey(release: DedupeCandidate) {
  const artist = normalizeKeyPart(release.artistName || "");
  const project = normalizeProjectPart(release.projectTitle || release.title);

  return [release.releaseType, artist || "unknown-artist", project || "unknown-project"].join("|");
}

function normalizeProjectPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\/\/.*$/g, " ")
    .replace(/\b(feat|featuring|ft)\.?\b.*$/g, " ")
    .replace(/\bout\s+[a-z]+\s+\d{1,2}\b.*$/g, " ")
    .replace(/\bout\s+\d{4}\b.*$/g, " ")
    .replace(/\bfrom\s+['"].*$/g, " ")
    .replace(/\((official|visualizer|lyric|audio).*?\)/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/[\/]+/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyPart(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
