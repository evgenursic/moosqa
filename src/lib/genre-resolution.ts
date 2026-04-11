import { ReleaseType } from "@/generated/prisma/enums";
import { buildGenreProfile, isSpecificGenreProfile, pickPreferredGenreProfile } from "@/lib/genre-profile";
import { getGenreOverride } from "@/lib/genre-overrides";

type GenreResolutionInput = {
  releaseType: ReleaseType;
  currentGenre?: string | null;
  explicitGenres?: Array<string | null | undefined>;
  textSegments?: Array<string | null | undefined>;
  artistName?: string | null;
  projectTitle?: string | null;
  title?: string | null;
  labelName?: string | null;
  limit?: number;
};

type GenreFallbackRule = {
  patterns: RegExp[];
  genre: string;
  any?: boolean;
};

const GENRE_FALLBACK_RULES: GenreFallbackRule[] = [
  {
    patterns: [/\b(?:math|tapping|odd[- ]meter|interlocking guitars?)\b/i],
    genre: "math rock / post-rock / indie rock",
  },
  {
    patterns: [/\b(?:hazy|ethereal|shimmering|reverb[- ]drenched|washed[- ]out)\b/i],
    genre: "dream pop / shoegaze / indie pop",
  },
  {
    patterns: [/\b(?:angular|wiry|taut|serrated|bass-driven)\b/i],
    genre: "post-punk / indie rock / alternative rock",
  },
  {
    patterns: [/\b(?:fingerpicked|acoustic|confessional|stripped-back|hushed)\b/i],
    genre: "singer-songwriter / indie folk / chamber folk",
  },
  {
    patterns: [/\b(?:twang|americana|country-leaning|dusty|open-road)\b/i],
    genre: "americana / alt-country / indie folk",
  },
  {
    patterns: [/\b(?:synth|drum machine|arp|electronic|electropop|new wave)\b/i],
    genre: "synth-pop / electropop / alternative pop",
  },
  {
    patterns: [/\b(?:ambient|drone|modular|meditative|soundscape)\b/i],
    genre: "ambient electronic / drone / experimental electronic",
  },
  {
    patterns: [/\b(?:improvised|horn-led|modal|free-form|spiritual jazz|avant-jazz)\b/i],
    genre: "spiritual jazz / avant-jazz / free jazz",
  },
  {
    patterns: [/\b(?:hardcore|mosh|breakneck|blast|metal|doom|sludge)\b/i],
    genre: "hardcore punk / post-hardcore / sludge metal",
  },
  {
    patterns: [/\b(?:club|dancefloor|house|disco|pulsing|groove-driven)\b/i],
    genre: "alternative dance / dance-punk / soulful house",
  },
  {
    patterns: [/\b(?:garage|fuzzed[- ]out|hooky riffs?|power pop)\b/i],
    genre: "garage rock / power pop / indie rock",
  },
  {
    patterns: [/\b(?:slow-burning|spare|minimal|bleak|sadcore)\b/i],
    genre: "slowcore / indie rock / dream pop",
  },
  {
    patterns: [/\b(?:gothic|cold|shadowy|brooding|darkwave)\b/i],
    genre: "darkwave / gothic rock / post-punk",
  },
  {
    patterns: [/\b(?:psychedelic|lysergic|kaleidoscopic|swirling)\b/i],
    genre: "neo-psychedelia / psychedelic rock / psychedelic pop",
  },
];

export function resolveBestGenreProfile(input: GenreResolutionInput) {
  const overrideGenre = getGenreOverride(input);
  if (overrideGenre) {
    return overrideGenre;
  }

  const explicitGenres = [
    input.currentGenre,
    ...(input.explicitGenres || []),
  ].filter((value): value is string => Boolean(value?.trim()));
  const combinedText = normalizeTextSegments(input.textSegments);

  const profiledGenre =
    buildGenreProfile({
      explicitGenres,
      text: combinedText,
      artistName: input.artistName,
      projectTitle: input.projectTitle,
      title: input.title,
      labelName: input.labelName,
      limit: input.limit || 3,
    }) || null;
  const specificExplicitGenre =
    explicitGenres.find((genre) => isSpecificGenreProfile(genre)) || null;
  const emergencyGenre = buildEmergencyGenreProfile(combinedText, input.releaseType);

  return (
    pickPreferredGenreProfile(
      profiledGenre && isSpecificGenreProfile(profiledGenre) ? profiledGenre : null,
      specificExplicitGenre,
      emergencyGenre,
      profiledGenre,
      input.currentGenre || null,
    ) ||
    emergencyGenre ||
    input.currentGenre ||
    getReleaseTypeFallbackGenre(input.releaseType)
  );
}

function buildEmergencyGenreProfile(text: string, releaseType: ReleaseType) {
  if (!text) {
    return getReleaseTypeFallbackGenre(releaseType);
  }

  for (const rule of GENRE_FALLBACK_RULES) {
    const isMatch = rule.any
      ? rule.patterns.some((pattern) => pattern.test(text))
      : rule.patterns.every((pattern) => pattern.test(text));

    if (isMatch) {
      return rule.genre;
    }
  }

  return getReleaseTypeFallbackGenre(releaseType);
}

function getReleaseTypeFallbackGenre(releaseType: ReleaseType) {
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "indie rock / singer-songwriter / alternative folk";
  }

  if (releaseType === ReleaseType.EP) {
    return "indie rock / alternative pop / dream pop";
  }

  if (releaseType === ReleaseType.ALBUM) {
    return "indie rock / art pop / indie folk";
  }

  return "indie rock / alternative pop / singer-songwriter";
}

function normalizeTextSegments(values: Array<string | null | undefined> | undefined) {
  return (values || [])
    .filter((value): value is string => Boolean(value?.trim()))
    .join(". ")
    .replace(/\s+/g, " ")
    .trim();
}
