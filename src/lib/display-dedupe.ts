import { ReleaseType } from "@/generated/prisma/enums";

type DedupeCandidate = {
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  releaseType: ReleaseType;
  qualityScore?: number | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  publishedAt?: Date | null;
};

export function dedupeReleasesForDisplay<T extends DedupeCandidate>(releases: T[]) {
  const byKey = new Map<string, T>();

  for (const release of releases) {
    const key = buildNearDuplicateKey(release);
    const existing = byKey.get(key);

    if (!existing || compareDedupePriority(release, existing) > 0) {
      byKey.set(key, release);
    }
  }

  return [...byKey.values()];
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

function compareDedupePriority(left: DedupeCandidate, right: DedupeCandidate) {
  const qualityDelta = (left.qualityScore || 0) - (right.qualityScore || 0);
  if (qualityDelta !== 0) {
    return qualityDelta;
  }

  const imageDelta = countArtworkSignals(left) - countArtworkSignals(right);
  if (imageDelta !== 0) {
    return imageDelta;
  }

  const leftPublishedAt = left.publishedAt?.getTime() || 0;
  const rightPublishedAt = right.publishedAt?.getTime() || 0;
  return leftPublishedAt - rightPublishedAt;
}

function countArtworkSignals(release: Pick<DedupeCandidate, "imageUrl" | "thumbnailUrl">) {
  let score = 0;

  if (release.imageUrl) {
    score += 2;
  }

  if (release.thumbnailUrl) {
    score += 1;
  }

  return score;
}
