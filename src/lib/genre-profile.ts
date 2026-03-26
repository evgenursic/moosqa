type GenreProfileOptions = {
  explicitGenres?: Array<string | null | undefined>;
  text?: string | null | undefined;
  artistName?: string | null | undefined;
  labelName?: string | null | undefined;
  limit?: number;
};

type WeightedGenre = {
  name: string;
  score: number;
};

const WEAK_GENRES = new Set([
  "indie",
  "alternative",
  "indie alternative",
  "indie / alternative",
  "rock",
  "pop",
  "arabic",
  "electronic",
  "folk",
  "indonesian",
  "melayu",
  "world",
  "world music",
  "music",
]);

const BLOCKED_GENRES = new Set([
  "music",
  "bandcamp",
  "album",
  "single",
  "ep",
  "habibi funk",
  "music streaming",
  "spotify",
  "track",
  "tidal",
  "youtube",
  "youtube music",
  "new york",
  "stockholm",
  "berlin",
  "london",
  "los angeles",
  "chicago",
  "austin",
  "texas",
  "california",
  "brooklyn",
  "new jersey",
  "new york city",
  "nyc",
  "united states",
  "sweden",
]);

const GENRE_ALIASES: Record<string, string[]> = {
  "alt rock": ["alternative rock"],
  "alt-pop": ["alternative pop"],
  "alt pop": ["alternative pop"],
  "alternative": ["alternative"],
  "alternative pop": ["alternative pop"],
  "arabic": ["arabic"],
  "arabic funk": ["arabic funk"],
  "baroque-pop": ["baroque pop"],
  "bedroom-pop": ["bedroom pop"],
  "dance punk": ["dance-punk"],
  "dance rock": ["dance-rock"],
  "disco grooves": ["disco"],
  "dream pop": ["dream pop"],
  "dream-pop": ["dream pop"],
  "electro pop": ["electropop"],
  "electro-pop": ["electropop"],
  "electronic pop": ["electropop"],
  "emo rock": ["emo", "emo rock"],
  "folk pop": ["folk pop"],
  "folk rock": ["folk rock"],
  "groovy rock": ["dance-rock"],
  "hip hop": ["hip-hop"],
  "hip-hop": ["hip-hop"],
  "indie folk": ["indie folk"],
  "indie groove": ["dance-rock", "indie rock"],
  "indie pop": ["indie pop"],
  "indie rock": ["indie rock"],
  "indie rock pop": ["indie rock", "indie pop"],
  "indie synth-pop": ["indie pop", "synth-pop"],
  "indietronica": ["indietronica"],
  "jangle pop": ["jangle pop"],
  "jangle-pop": ["jangle pop"],
  "jazz funk": ["jazz-funk"],
  "jazz-funk": ["jazz-funk"],
  "math rock": ["math rock"],
  "melayu": ["melayu"],
  "neo psychedelia": ["neo-psychedelia"],
  "neo-psychedelia": ["neo-psychedelia"],
  "noise pop": ["noise pop"],
  "noise rock": ["noise rock"],
  "post hardcore": ["post-hardcore"],
  "post punk": ["post-punk"],
  "post-punk": ["post-punk"],
  "post rock": ["post-rock"],
  "psych rock": ["psychedelic rock"],
  "psych pop": ["psychedelic pop"],
  "psychedelic funk": ["psychedelic funk"],
  "psychedelic rock": ["psychedelic rock"],
  "r&b": ["r&b"],
  "rock n roll": ["rock and roll"],
  "rock and roll": ["rock and roll"],
  "shoegazer": ["shoegaze"],
  "shoegaze": ["shoegaze"],
  "singer songwriter": ["singer-songwriter"],
  "singer-songwriter": ["singer-songwriter"],
  "slowcore": ["slowcore"],
  "slowgaze": ["slowgaze"],
  "synth pop": ["synth-pop"],
  "synth-pop": ["synth-pop"],
  "electro thrash": ["electro-thrash"],
  "industrial metal": ["industrial metal"],
  "industrial techno": ["industrial techno"],
  "avant doom": ["avant-doom"],
  "avant-doom": ["avant-doom"],
  "doomgaze": ["doomgaze"],
  "dreamgaze": ["dreamgaze"],
  "drum and bass": ["drum and bass"],
  "uk techno": ["uk techno"],
  "trip hop": ["trip-hop"],
  "world": ["world"],
};

const TEXT_GENRE_PATTERNS: Array<[RegExp, string]> = [
  [/\balternative pop\b/i, "alternative pop"],
  [/\bart pop\b/i, "art pop"],
  [/\bbalearic\b/i, "balearic"],
  [/\bbedroom pop\b/i, "bedroom pop"],
  [/\bchamber pop\b/i, "chamber pop"],
  [/\bcoldwave\b/i, "coldwave"],
  [/\bdance[- ]punk\b/i, "dance-punk"],
  [/\bdance[- ]rock\b/i, "dance-rock"],
  [/\bdarkwave\b/i, "darkwave"],
  [/\bdisco\b/i, "disco"],
  [/\bdowntempo\b/i, "downtempo"],
  [/\bdream[- ]pop\b/i, "dream pop"],
  [/\bdream folk\b/i, "dream folk"],
  [/\bdreamgaze\b/i, "dreamgaze"],
  [/\bdrone\b/i, "drone"],
  [/\bdoomgaze\b/i, "doomgaze"],
  [/\bemo\b/i, "emo"],
  [/\belectropop\b/i, "electropop"],
  [/\belectro[- ]thrash\b/i, "electro-thrash"],
  [/\bexperimental pop\b/i, "experimental pop"],
  [/\bfolk pop\b/i, "folk pop"],
  [/\bfolk rock\b/i, "folk rock"],
  [/\bgarage rock\b/i, "garage rock"],
  [/\bglitch pop\b/i, "glitch pop"],
  [/\bhip[- ]hop\b/i, "hip-hop"],
  [/\bindie folk\b/i, "indie folk"],
  [/\bindie pop\b/i, "indie pop"],
  [/\bindie rock\b/i, "indie rock"],
  [/\bindietronica\b/i, "indietronica"],
  [/\bjangle pop\b/i, "jangle pop"],
  [/\bjazz[- ]funk\b/i, "jazz-funk"],
  [/\bkrautrock\b/i, "krautrock"],
  [/\bmath rock\b/i, "math rock"],
  [/\bneo[- ]psychedelia\b/i, "neo-psychedelia"],
  [/\bnew wave\b/i, "new wave"],
  [/\bnoise pop\b/i, "noise pop"],
  [/\bnoise rock\b/i, "noise rock"],
  [/\bindustrial metal\b/i, "industrial metal"],
  [/\bindustrial techno\b/i, "industrial techno"],
  [/\bpost[- ]hardcore\b/i, "post-hardcore"],
  [/\bpost[- ]punk\b/i, "post-punk"],
  [/\bpost[- ]rock\b/i, "post-rock"],
  [/\bpower pop\b/i, "power pop"],
  [/\bpsychedelic funk\b/i, "psychedelic funk"],
  [/\bpsychedelic pop\b/i, "psychedelic pop"],
  [/\bpsychedelic rock\b/i, "psychedelic rock"],
  [/\br&b\b/i, "r&b"],
  [/\bshoegaze\b/i, "shoegaze"],
  [/\bslowgaze\b/i, "slowgaze"],
  [/\bsinger[- ]songwriter\b/i, "singer-songwriter"],
  [/\bslowcore\b/i, "slowcore"],
  [/\bsoul\b/i, "soul"],
  [/\bspace rock\b/i, "space rock"],
  [/\bsynth[- ]pop\b/i, "synth-pop"],
  [/\btrip[- ]hop\b/i, "trip-hop"],
  [/\buk techno\b/i, "uk techno"],
  [/\bdrum and bass\b/i, "drum and bass"],
];

export function buildGenreProfile(options: GenreProfileOptions) {
  const limit = options.limit || 3;
  const weightedGenres = new Map<string, WeightedGenre>();
  const excludedPhrases = buildExcludedPhrases(options.artistName, options.labelName);
  const explicitGenreText = normalizeWhitespace(
    (options.explicitGenres || []).filter(Boolean).join(". "),
  );

  for (const rawValue of options.explicitGenres || []) {
    for (const candidate of expandGenreValue(rawValue)) {
      addWeightedGenre(weightedGenres, candidate, 6, excludedPhrases);
    }
  }

  if (explicitGenreText) {
    for (const candidate of extractGenresFromText(explicitGenreText)) {
      addWeightedGenre(weightedGenres, candidate, 5, excludedPhrases);
    }
  }

  const text = normalizeWhitespace(options.text || "");
  if (text) {
    for (const candidate of extractGenresFromText(text)) {
      addWeightedGenre(weightedGenres, candidate, 3, excludedPhrases);
    }
  }

  const sorted = [...weightedGenres.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.name.length - left.name.length;
    })
    .map((entry) => entry.name);
  const ordered = [
    ...sorted.filter((genre) => !isWeakGenre(genre)),
    ...sorted.filter((genre) => isWeakGenre(genre)),
  ];

  const selected: string[] = [];
  for (const candidate of ordered) {
    if (selected.length >= limit) {
      break;
    }

    if (isRedundantGenre(candidate, selected)) {
      continue;
    }

    selected.push(candidate);
  }

  if (selected.length === 0) {
    return null;
  }

  return selected.slice(0, limit).join(" / ");
}

export function isSpecificGenreProfile(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const genres = expandGenreValue(value);
  if (genres.length === 0) {
    return false;
  }

  return genres.some((genre) => !isWeakGenre(genre));
}

function addWeightedGenre(
  map: Map<string, WeightedGenre>,
  candidate: string,
  baseScore: number,
  excludedPhrases: Set<string>,
) {
  const normalized = normalizeGenreName(candidate);
  if (!normalized || excludedPhrases.has(normalized) || BLOCKED_GENRES.has(normalized)) {
    return;
  }

  const current = map.get(normalized);
  const nextScore =
    (current?.score || 0) +
    baseScore +
    (isWeakGenre(normalized) ? 0 : 4) +
    (normalized.includes(" ") || normalized.includes("-") ? 1 : 0);

  map.set(normalized, {
    name: normalized,
    score: nextScore,
  });
}

function buildExcludedPhrases(
  artistName: string | null | undefined,
  labelName: string | null | undefined,
) {
  const phrases = new Set<string>();
  for (const value of [artistName, labelName]) {
    if (!value) {
      continue;
    }

    for (const candidate of expandGenreValue(value)) {
      if (candidate) {
        phrases.add(candidate);
      }
    }
  }

  return phrases;
}

function expandGenreValue(value: string | null | undefined) {
  if (!value) {
    return [];
  }

  const normalized = normalizeWhitespace(value)
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s*&\s*/g, " & ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return [];
  }

  const parts = normalized
    .split(/[,;|]/)
    .flatMap((part) => part.split(/\s+\/\s+/))
    .map((part) => normalizeGenreName(part))
    .filter((part): part is string => part !== null);

  const expanded = parts.flatMap((part) => GENRE_ALIASES[part] || [part]);
  const normalizedExpanded = expanded
    .map((part) => normalizeGenreName(part))
    .filter((part): part is string => part !== null);

  return [...new Set(normalizedExpanded)];
}

function extractGenresFromText(text: string) {
  const matches = new Set<string>();

  for (const [pattern, genre] of TEXT_GENRE_PATTERNS) {
    if (pattern.test(text)) {
      matches.add(genre);
    }
  }

  if (/\barab/i.test(text) && /\bfunk\b/i.test(text)) {
    matches.add("arabic funk");
  }

  if (/\bindonesian\b/i.test(text) && /\bpsychedelic\b/i.test(text) && /\bfunk\b/i.test(text)) {
    matches.add("indonesian psychedelic funk");
  }

  if (/\bindustrial\b/i.test(text) && /\bmetal\b/i.test(text)) {
    matches.add("industrial metal");
  }

  if (/\bindustrial\b/i.test(text) && /\btechno\b/i.test(text)) {
    matches.add("industrial techno");
  }

  if (/\bslowcore\b/i.test(text) && /\bshoegaze\b/i.test(text)) {
    matches.add("slowgaze");
  }

  if (/\bdoom\b/i.test(text) && /\bshoegaze\b/i.test(text)) {
    matches.add("doomgaze");
  }

  if (/\bdream\b/i.test(text) && /\bshoegaze\b/i.test(text)) {
    matches.add("dreamgaze");
  }

  if (/\bsynth\b/i.test(text) && /\bpop\b/i.test(text)) {
    matches.add("synth-pop");
  }

  if (/\balt\b/i.test(text) && /\brock\b/i.test(text)) {
    matches.add("alternative rock");
  }

  return [...matches];
}

function normalizeGenreName(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value)
    .replace(/^#/, "")
    .replace(/^the\s+/i, "")
    .replace(/[!"'`]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    try {
      const parsed = new URL(normalized);
      const parts = parsed.pathname.split("/").filter(Boolean);
      const lastPart = parts[parts.length - 1];
      if (!lastPart || lastPart === "discover") {
        return null;
      }
      return lastPart.replace(/-/g, " ");
    } catch {
      return null;
    }
  }

  return GENRE_ALIASES[normalized]?.[0] || normalized;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function isWeakGenre(value: string) {
  return WEAK_GENRES.has(value);
}

function isRedundantGenre(candidate: string, selected: string[]) {
  return selected.some((existing) => {
    if (existing === candidate) {
      return true;
    }

    if (isWeakGenre(candidate) && existing.includes(candidate)) {
      return true;
    }

    if (isWeakGenre(existing) && candidate.includes(existing)) {
      return true;
    }

    return false;
  });
}
