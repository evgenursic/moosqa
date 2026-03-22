import { ReleaseType } from "@/generated/prisma/enums";

const MUSICBRAINZ_API = "https://musicbrainz.org/ws/2";
const COVER_ART_ARCHIVE_API = "https://coverartarchive.org";
const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ||
  `MooSQA/0.3 (${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"})`;

let lastMusicBrainzRequest = 0;

type ReleaseMatchInput = {
  artistName: string | null;
  projectTitle: string | null;
  title: string;
  releaseType: ReleaseType;
  sourceUrl: string;
};

type MusicBrainzSearchResponse = {
  releases?: Array<{
    id: string;
    score?: number;
    title: string;
    date?: string;
    "artist-credit"?: Array<{
      name?: string;
      artist?: {
        id: string;
        name: string;
      };
    }>;
    "release-group"?: {
      title?: string;
      "primary-type"?: string;
    };
  }>;
};

type MusicBrainzArtistSearchResponse = {
  artists?: Array<{
    id: string;
    score?: number;
    name?: string;
    genres?: Array<{ name?: string; count?: number }>;
    tags?: Array<{ name?: string; count?: number }>;
  }>;
};

type MusicBrainzLookupResponse = {
  id: string;
  title?: string;
  date?: string;
  "label-info"?: Array<{
    label?: {
      name?: string;
    };
  }>;
  genres?: Array<{ name?: string; count?: number }>;
  tags?: Array<{ name?: string; count?: number }>;
  relations?: Array<{
    type?: string;
    url?: {
      resource?: string;
    };
  }>;
  "release-group"?: {
    id?: string;
    "first-release-date"?: string;
    genres?: Array<{ name?: string; count?: number }>;
    tags?: Array<{ name?: string; count?: number }>;
    "artist-credit"?: Array<{
      artist?: {
        id?: string;
        name?: string;
      };
    }>;
  };
};

type MusicBrainzArtistResponse = {
  id: string;
  genres?: Array<{ name?: string; count?: number }>;
  tags?: Array<{ name?: string; count?: number }>;
  relations?: Array<{
    type?: string;
    url?: {
      resource?: string;
    };
  }>;
};

export type MusicMetadata = {
  musicbrainzReleaseId?: string | null;
  musicbrainzArtistId?: string | null;
  labelName?: string | null;
  genreName?: string | null;
  releaseDate?: Date | null;
  youtubeUrl?: string | null;
  youtubeMusicUrl?: string | null;
  bandcampUrl?: string | null;
  coverArtUrl?: string | null;
  thumbnailArtUrl?: string | null;
};

type CoverArtMetadata = {
  coverArtUrl?: string | null;
  thumbnailArtUrl?: string | null;
};

export async function fetchMusicMetadata(
  input: ReleaseMatchInput,
): Promise<MusicMetadata> {
  const match = await searchBestRelease(input);
  const fallbackArtist =
    !match && input.artistName ? await searchBestArtist(input.artistName) : null;

  if (!match && !fallbackArtist) {
    return {};
  }

  const release = match ? await lookupRelease(match.id) : null;
  const artistId =
    release?.["release-group"]?.["artist-credit"]?.[0]?.artist?.id ||
    match?.["artist-credit"]?.[0]?.artist?.id ||
    fallbackArtist?.id ||
    null;
  const artist = artistId ? await lookupArtist(artistId) : null;
  const coverArt = await fetchCoverArt(
    release?.id || match?.id,
    release?.["release-group"]?.id,
  );

  return {
    musicbrainzReleaseId: release?.id || match?.id || null,
    musicbrainzArtistId: artistId,
    labelName: getLabelName(release),
    genreName: getGenreName(release, artist, fallbackArtist),
    releaseDate: parseReleaseDate(
      release?.date || release?.["release-group"]?.["first-release-date"] || match?.date,
    ),
    youtubeUrl: pickRelationUrl(release?.relations, artist?.relations, ["youtube"]),
    youtubeMusicUrl: pickRelationUrl(release?.relations, artist?.relations, ["music.youtube.com"]),
    bandcampUrl: pickRelationUrl(release?.relations, artist?.relations, ["bandcamp.com"]),
    coverArtUrl: coverArt.coverArtUrl,
    thumbnailArtUrl: coverArt.thumbnailArtUrl,
  };
}

async function searchBestRelease(input: ReleaseMatchInput) {
  const title = input.projectTitle || input.title;
  const queryParts = [
    input.artistName ? `artist:"${escapeQuery(input.artistName)}"` : null,
    title ? `release:"${escapeQuery(title)}"` : null,
  ].filter(Boolean);

  if (queryParts.length === 0) {
    return null;
  }

  const searchUrl = `${MUSICBRAINZ_API}/release/?query=${encodeURIComponent(queryParts.join(" AND "))}&fmt=json&limit=5`;
  const payload = await fetchMusicBrainzJson<MusicBrainzSearchResponse>(searchUrl);
  const candidates = payload.releases || [];

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: computeCandidateScore(input, candidate),
    }))
    .sort((left, right) => right.score - left.score);

  if (!ranked[0] || ranked[0].score < 45) {
    return null;
  }

  return ranked[0].candidate;
}

async function searchBestArtist(artistName: string) {
  const query = `artist:"${escapeQuery(artistName)}"`;
  const searchUrl =
    `${MUSICBRAINZ_API}/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=5`;
  const payload = await fetchMusicBrainzJson<MusicBrainzArtistSearchResponse>(searchUrl);
  const candidates = payload.artists || [];

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: computeArtistScore(artistName, candidate),
    }))
    .sort((left, right) => right.score - left.score);

  if (!ranked[0] || ranked[0].score < 55) {
    return null;
  }

  return ranked[0].candidate;
}

async function lookupRelease(releaseId: string) {
  const url =
    `${MUSICBRAINZ_API}/release/${releaseId}?fmt=json&inc=` +
    "artist-credits+labels+genres+tags+url-rels+release-groups";

  return fetchMusicBrainzJson<MusicBrainzLookupResponse>(url);
}

async function lookupArtist(artistId: string) {
  const url = `${MUSICBRAINZ_API}/artist/${artistId}?fmt=json&inc=genres+tags+url-rels`;
  return fetchMusicBrainzJson<MusicBrainzArtistResponse>(url);
}

async function fetchMusicBrainzJson<T>(url: string) {
  const elapsed = Date.now() - lastMusicBrainzRequest;
  if (elapsed < 1100) {
    await new Promise((resolve) => setTimeout(resolve, 1100 - elapsed));
  }

  lastMusicBrainzRequest = Date.now();
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`MusicBrainz request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function computeCandidateScore(
  input: ReleaseMatchInput,
  candidate: NonNullable<MusicBrainzSearchResponse["releases"]>[number],
) {
  let score = candidate.score || 0;

  const expectedArtist = normalizeText(input.artistName || "");
  const expectedTitle = normalizeText(input.projectTitle || input.title);
  const candidateArtist = normalizeText(candidate["artist-credit"]?.[0]?.artist?.name || "");
  const candidateTitle = normalizeText(
    candidate["release-group"]?.title || candidate.title || "",
  );

  if (expectedArtist && candidateArtist === expectedArtist) {
    score += 25;
  }

  if (expectedTitle && candidateTitle === expectedTitle) {
    score += 35;
  } else if (expectedTitle && candidateTitle.includes(expectedTitle)) {
    score += 18;
  }

  return score;
}

function computeArtistScore(
  artistName: string,
  candidate: NonNullable<MusicBrainzArtistSearchResponse["artists"]>[number],
) {
  let score = candidate.score || 0;
  const expectedArtist = normalizeText(artistName);
  const candidateArtist = normalizeText(candidate.name || "");

  if (expectedArtist && candidateArtist === expectedArtist) {
    score += 30;
  } else if (expectedArtist && candidateArtist.includes(expectedArtist)) {
    score += 12;
  }

  return score;
}

function getLabelName(release: MusicBrainzLookupResponse | null) {
  const label = release?.["label-info"]?.find((entry) => entry.label?.name)?.label?.name;
  return label || null;
}

function getGenreName(
  release: MusicBrainzLookupResponse | null,
  artist: MusicBrainzArtistResponse | null,
  fallbackArtist?: NonNullable<MusicBrainzArtistSearchResponse["artists"]>[number] | null,
) {
  const genreCandidates = [
    ...(release?.genres || []),
    ...(release?.["release-group"]?.genres || []),
    ...(artist?.genres || []),
    ...(fallbackArtist?.genres || []),
  ];

  const topGenre = genreCandidates.sort((left, right) => (right.count || 0) - (left.count || 0))[0];
  if (topGenre?.name) {
    return topGenre.name;
  }

  const tagCandidates = [
    ...(release?.tags || []),
    ...(release?.["release-group"]?.tags || []),
    ...(artist?.tags || []),
    ...(fallbackArtist?.tags || []),
  ];

  return (
    tagCandidates.sort((left, right) => (right.count || 0) - (left.count || 0))[0]?.name || null
  );
}

function pickRelationUrl(
  releaseRelations: MusicBrainzLookupResponse["relations"] | undefined,
  artistRelations: MusicBrainzArtistResponse["relations"] | undefined,
  patterns: string[],
) {
  const relationLists = [releaseRelations || [], artistRelations || []];

  for (const relations of relationLists) {
    for (const relation of relations) {
      const resource = relation.url?.resource;
      if (!resource) {
        continue;
      }

      if (patterns.some((pattern) => resource.includes(pattern))) {
        return resource;
      }

      if (patterns.includes("youtube") && relation.type === "youtube") {
        return resource;
      }
    }
  }

  return null;
}

function parseReleaseDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  if (/^\d{4}$/.test(value)) {
    return new Date(`${value}-01-01T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`);
  }

  return null;
}

function escapeQuery(value: string) {
  return value.replace(/"/g, "");
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchCoverArt(
  releaseId?: string,
  releaseGroupId?: string,
): Promise<CoverArtMetadata> {
  if (releaseId) {
    const releaseCover = await fetchReleaseCoverJson(releaseId);
    if (releaseCover.coverArtUrl || releaseCover.thumbnailArtUrl) {
      return releaseCover;
    }
  }

  if (releaseGroupId) {
    const coverArtUrl = await resolveCoverArtUrl(
      `${COVER_ART_ARCHIVE_API}/release-group/${releaseGroupId}/front-1200`,
    );
    const thumbnailArtUrl = await resolveCoverArtUrl(
      `${COVER_ART_ARCHIVE_API}/release-group/${releaseGroupId}/front-500`,
    );

    return {
      coverArtUrl,
      thumbnailArtUrl: thumbnailArtUrl || coverArtUrl,
    };
  }

  return {};
}

async function fetchReleaseCoverJson(releaseId: string): Promise<CoverArtMetadata> {
  try {
    const response = await fetch(`${COVER_ART_ARCHIVE_API}/release/${releaseId}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {};
    }

    const payload = (await response.json()) as {
      images?: Array<{
        front?: boolean;
        image?: string;
        thumbnails?: Record<string, string>;
      }>;
    };
    const frontImage = payload.images?.find((image) => image.front) || payload.images?.[0];

    return {
      coverArtUrl: frontImage?.thumbnails?.["1200"] || frontImage?.image || null,
      thumbnailArtUrl:
        frontImage?.thumbnails?.["500"] ||
        frontImage?.thumbnails?.large ||
        frontImage?.image ||
        null,
    };
  } catch {
    return {};
  }
}

async function resolveCoverArtUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": USER_AGENT,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return response.url;
  } catch {
    return null;
  }
}
