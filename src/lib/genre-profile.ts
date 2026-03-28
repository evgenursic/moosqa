type GenreProfileOptions = {
  explicitGenres?: Array<string | null | undefined>;
  text?: string | null | undefined;
  artistName?: string | null | undefined;
  projectTitle?: string | null | undefined;
  title?: string | null | undefined;
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
  "electronic",
  "folk",
  "world",
  "world music",
  "experimental",
  "music",
]);

const BLOCKED_GENRES = new Set([
  "music",
  "bandcamp",
  "album",
  "single",
  "ep",
  "track",
  "record",
  "recording",
  "music streaming",
  "spotify",
  "tidal",
  "youtube",
  "youtube music",
  "video",
  "vocalist",
  "artists",
  "artist",
  "official",
  "official video",
  "official audio",
  "official visualiser",
  "official visualizer",
  "lyric video",
  "visualizer",
  "audio",
  "albumrelease",
  "eprelease",
  "singlerelease",
  "musicrecording",
  "habibi funk",
  "new york",
  "brooklyn",
  "new jersey",
  "new york city",
  "nyc",
  "los angeles",
  "chicago",
  "berlin",
  "london",
  "london uk",
  "austin",
  "texas",
  "california",
  "serbia",
  "sweden",
  "united kingdom",
  "united states",
  "eurovision 2023 artists",
  "provided to youtube by",
]);

const KNOWN_SINGLE_WORD_GENRES = new Set([
  "ambient",
  "americana",
  "arabic",
  "balearic",
  "chillwave",
  "coldwave",
  "darkwave",
  "disco",
  "drone",
  "electropop",
  "emo",
  "experimental",
  "folk",
  "garage",
  "hardcore",
  "house",
  "indietronica",
  "jungle",
  "krautrock",
  "metal",
  "new wave",
  "pop",
  "punk",
  "rock",
  "shoegaze",
  "slowcore",
  "soul",
  "techno",
]);

const KNOWN_GENRE_PARTS = new Set([
  "acoustic",
  "alternative",
  "ambient",
  "americana",
  "art",
  "avant",
  "baroque",
  "bass",
  "bedroom",
  "breakbeat",
  "britpop",
  "chamber",
  "chillwave",
  "coldwave",
  "cosmic",
  "dance",
  "dark",
  "darkwave",
  "disco",
  "doom",
  "dream",
  "drone",
  "electroacoustic",
  "electronic",
  "electropop",
  "emo",
  "experimental",
  "folk",
  "free",
  "funk",
  "garage",
  "gaze",
  "glitch",
  "hardcore",
  "hip",
  "hop",
  "house",
  "indian",
  "indie",
  "industrial",
  "jangle",
  "jazz",
  "jungle",
  "latin",
  "math",
  "melodic",
  "metal",
  "minimal",
  "modular",
  "neo",
  "noise",
  "nu",
  "outsider",
  "pop",
  "post",
  "psych",
  "psychedelic",
  "punk",
  "r&b",
  "r",
  "rock",
  "sample",
  "shoegaze",
  "singer",
  "slow",
  "slowcore",
  "soul",
  "space",
  "spiritual",
  "synth",
  "trip",
]);

const GENRE_ALIASES: Record<string, string[]> = {
  "alt country": ["alt-country"],
  "alt pop": ["alternative pop"],
  "alt r&b": ["alternative r&b"],
  "alt rock": ["alternative rock"],
  "alt-pop": ["alternative pop"],
  "alt-country": ["alt-country"],
  "alternative": ["alternative"],
  "alternative pop": ["alternative pop"],
  "alternative r & b": ["alternative r&b"],
  "alternative r and b": ["alternative r&b"],
  "alternative r&b": ["alternative r&b"],
  "alternative rock": ["alternative rock"],
  "ambient": ["ambient"],
  "ambient electronic": ["ambient electronic"],
  "americana": ["americana"],
  "arabic": ["arabic"],
  "arabic funk": ["arabic funk"],
  "art folk": ["art folk"],
  "art pop": ["art pop"],
  "art rock": ["art rock"],
  "artpop": ["art pop"],
  "avant doom": ["avant-doom"],
  "avant-doom": ["avant-doom"],
  "avant-garde electronic": ["avant-garde electronic"],
  "baroque pop": ["baroque pop"],
  "baroque-pop": ["baroque pop"],
  "bedroom pop": ["bedroom pop"],
  "bedroom-pop": ["bedroom pop"],
  "breakbeat hardcore": ["breakbeat hardcore"],
  "chamber folk": ["chamber folk"],
  "chamber pop": ["chamber pop"],
  "chillwave": ["chillwave"],
  "coldwave": ["coldwave"],
  "contemporary folk": ["indie folk"],
  "cosmic americana": ["cosmic Americana"],
  "dance pop": ["dance-pop"],
  "dance rock": ["dance-rock"],
  "dance punk": ["dance-punk"],
  "dance-pop": ["dance-pop"],
  "dance-punk": ["dance-punk"],
  "dance-rock": ["dance-rock"],
  "dark pop": ["dark pop"],
  "darkwave": ["darkwave"],
  "deep house": ["deep house"],
  "disco grooves": ["disco"],
  "dream folk": ["dream folk"],
  "dream pop": ["dream pop"],
  "dream-pop": ["dream pop"],
  "dreamgaze": ["dreamgaze"],
  "drone": ["drone"],
  "doomgaze": ["doomgaze"],
  "drum and bass": ["drum and bass"],
  "drum n bass": ["drum and bass"],
  "electro acoustic": ["electroacoustic"],
  "electro pop": ["electropop"],
  "electro thrash": ["electro-thrash"],
  "electro-pop": ["electropop"],
  "electro-thrash": ["electro-thrash"],
  "electroacoustic": ["electroacoustic"],
  "electronic pop": ["electropop"],
  "electropop": ["electropop"],
  "emo": ["emo"],
  "emo pop": ["emo pop"],
  "emo rap": ["emo rap"],
  "emo rock": ["emo", "emo rock"],
  "experimental electronic": ["experimental electronic"],
  "experimental hip hop": ["experimental hip-hop"],
  "experimental pop": ["experimental pop"],
  "experimental hip-hop": ["experimental hip-hop"],
  "folk pop": ["folk pop"],
  "folk rock": ["folk rock"],
  "free jazz": ["free jazz"],
  "garage punk": ["garage punk"],
  "garage rock": ["garage rock"],
  "glitch pop": ["glitch pop"],
  "hard rock": ["hard rock"],
  "hardcore punk": ["hardcore punk"],
  "hip hop": ["hip-hop"],
  "hip-hop": ["hip-hop"],
  "indian classical": ["indian classical"],
  "indie folk": ["indie folk"],
  "indie pop": ["indie pop"],
  "indie rock": ["indie rock"],
  "indie synth-pop": ["indie pop", "synth-pop"],
  "indietronica": ["indietronica"],
  "industrial metal": ["industrial metal"],
  "industrial pop": ["industrial pop"],
  "industrial techno": ["industrial techno"],
  "jangle pop": ["jangle pop"],
  "jangle-pop": ["jangle pop"],
  "jazz funk": ["jazz-funk"],
  "jazz-funk": ["jazz-funk"],
  "jungle": ["jungle"],
  "latin alternative": ["latin alternative"],
  "latin rock": ["latin rock"],
  "math rock": ["math rock"],
  "melayu": ["melayu"],
  "melodic hardcore": ["melodic hardcore"],
  "minimal synth": ["minimal synth"],
  "modular ambient": ["modular ambient"],
  "neo psychedelia": ["neo-psychedelia"],
  "neo soul": ["neo-soul"],
  "neo-psychedelia": ["neo-psychedelia"],
  "neo-soul": ["neo-soul"],
  "new wave": ["new wave"],
  "noise pop": ["noise pop"],
  "noise rock": ["noise rock"],
  "nu jazz": ["nu jazz"],
  "nu-jazz": ["nu jazz"],
  "outsider house": ["outsider house"],
  "pop punk": ["pop punk"],
  "pop rock": ["pop rock"],
  "post britpop": ["post-britpop"],
  "post hardcore": ["post-hardcore"],
  "post punk": ["post-punk"],
  "post rock": ["post-rock"],
  "post-britpop": ["post-britpop"],
  "post-hardcore": ["post-hardcore"],
  "post-punk": ["post-punk"],
  "post-rock": ["post-rock"],
  "power pop": ["power pop"],
  "psych folk": ["psychedelic folk"],
  "psych pop": ["psychedelic pop"],
  "psych rock": ["psychedelic rock"],
  "psychedelic folk": ["psychedelic folk"],
  "psychedelic funk": ["psychedelic funk"],
  "psychedelic hip hop": ["psychedelic hip-hop"],
  "psychedelic hip-hop": ["psychedelic hip-hop"],
  "psychedelic pop": ["psychedelic pop"],
  "psychedelic rock": ["psychedelic rock"],
  "punk": ["punk rock"],
  "punk rock": ["punk rock"],
  "r & b": ["r&b"],
  "r and b": ["r&b"],
  "r&b": ["r&b"],
  "rock n roll": ["rock and roll"],
  "rock and roll": ["rock and roll"],
  "sample based house": ["sample-based house"],
  "sample-based house": ["sample-based house"],
  "shoegazer": ["shoegaze"],
  "shoegaze": ["shoegaze"],
  "singer songwriter": ["singer-songwriter"],
  "singer-songwriter": ["singer-songwriter"],
  "slowcore": ["slowcore"],
  "slowgaze": ["slowgaze"],
  "sophisti-pop": ["sophisti-pop"],
  "soulful house": ["soulful house"],
  "space rock": ["space rock"],
  "spiritual jazz": ["spiritual jazz"],
  "synth pop": ["synth-pop"],
  "synth-pop": ["synth-pop"],
  "trip hop": ["trip-hop"],
  "trip-hop": ["trip-hop"],
  "uk techno": ["uk techno"],
  "world": ["world"],
};

const TEXT_GENRE_PATTERNS: Array<[RegExp, string]> = [
  [/\balt(?:ernative)?[- ]country\b/i, "alt-country"],
  [/\balternative pop\b/i, "alternative pop"],
  [/\balternative rock\b/i, "alternative rock"],
  [/\bart folk\b/i, "art folk"],
  [/\bart pop\b/i, "art pop"],
  [/\bart rock\b/i, "art rock"],
  [/\bart[- ]pop\b/i, "art pop"],
  [/\bavant[- ]garde electronic\b/i, "avant-garde electronic"],
  [/\bbalearic\b/i, "balearic"],
  [/\bbaroque[- ]pop\b/i, "baroque pop"],
  [/\bbedroom[- ]pop\b/i, "bedroom pop"],
  [/\bbreakbeat hardcore\b/i, "breakbeat hardcore"],
  [/\bchamber folk\b/i, "chamber folk"],
  [/\bchamber pop\b/i, "chamber pop"],
  [/\bchillwave\b/i, "chillwave"],
  [/\bcoldwave\b/i, "coldwave"],
  [/\bcosmic americana\b/i, "cosmic Americana"],
  [/\bdance[- ]pop\b/i, "dance-pop"],
  [/\bdance[- ]punk\b/i, "dance-punk"],
  [/\bdance[- ]rock\b/i, "dance-rock"],
  [/\bdark pop\b/i, "dark pop"],
  [/\bdarkwave\b/i, "darkwave"],
  [/\bdeep house\b/i, "deep house"],
  [/\bdisco\b/i, "disco"],
  [/\bdowntempo\b/i, "downtempo"],
  [/\bdream[- ]folk\b/i, "dream folk"],
  [/\bdream[- ]pop\b/i, "dream pop"],
  [/\bdreamgaze\b/i, "dreamgaze"],
  [/\bdrone\b/i, "drone"],
  [/\bdoomgaze\b/i, "doomgaze"],
  [/\bdrum (?:and|n) bass\b/i, "drum and bass"],
  [/\belectro[- ]acoustic\b/i, "electroacoustic"],
  [/\belectro[- ]thrash\b/i, "electro-thrash"],
  [/\belectro(?:pop| pop)\b/i, "electropop"],
  [/\bemo pop\b/i, "emo pop"],
  [/\bemo rap\b/i, "emo rap"],
  [/\bemo\b/i, "emo"],
  [/\bexperimental electronic\b/i, "experimental electronic"],
  [/\bexperimental hip[- ]hop\b/i, "experimental hip-hop"],
  [/\bexperimental pop\b/i, "experimental pop"],
  [/\bfolk pop\b/i, "folk pop"],
  [/\bfolk rock\b/i, "folk rock"],
  [/\bfree jazz\b/i, "free jazz"],
  [/\bgarage punk\b/i, "garage punk"],
  [/\bgarage rock\b/i, "garage rock"],
  [/\bglitch pop\b/i, "glitch pop"],
  [/\bhard rock\b/i, "hard rock"],
  [/\bhardcore punk\b/i, "hardcore punk"],
  [/\bhip[- ]hop\b/i, "hip-hop"],
  [/\bhindustani classical\b/i, "indian classical"],
  [/\bindian classical\b/i, "indian classical"],
  [/\bindie folk\b/i, "indie folk"],
  [/\bindie pop\b/i, "indie pop"],
  [/\bindie rock\b/i, "indie rock"],
  [/\bindietronica\b/i, "indietronica"],
  [/\bindustrial metal\b/i, "industrial metal"],
  [/\bindustrial pop\b/i, "industrial pop"],
  [/\bindustrial techno\b/i, "industrial techno"],
  [/\bjangle pop\b/i, "jangle pop"],
  [/\bjazz[- ]funk\b/i, "jazz-funk"],
  [/\bjungle\b/i, "jungle"],
  [/\bkrautrock\b/i, "krautrock"],
  [/\blatin alternative\b/i, "latin alternative"],
  [/\blatin rock\b/i, "latin rock"],
  [/\bmath rock\b/i, "math rock"],
  [/\bmelodic hardcore\b/i, "melodic hardcore"],
  [/\bminimal synth\b/i, "minimal synth"],
  [/\bmodular ambient\b/i, "modular ambient"],
  [/\bneo[- ]psychedelia\b/i, "neo-psychedelia"],
  [/\bneo[- ]soul\b/i, "neo-soul"],
  [/\bnew wave\b/i, "new wave"],
  [/\bnoise pop\b/i, "noise pop"],
  [/\bnoise rock\b/i, "noise rock"],
  [/\bnu[- ]jazz\b/i, "nu jazz"],
  [/\boutsider house\b/i, "outsider house"],
  [/\bpop punk\b/i, "pop punk"],
  [/\bpop rock\b/i, "pop rock"],
  [/\bpost[- ]britpop\b/i, "post-britpop"],
  [/\bpost[- ]hardcore\b/i, "post-hardcore"],
  [/\bpost[- ]punk\b/i, "post-punk"],
  [/\bpost[- ]rock\b/i, "post-rock"],
  [/\bpower pop\b/i, "power pop"],
  [/\bpsychedelic folk\b/i, "psychedelic folk"],
  [/\bpsychedelic funk\b/i, "psychedelic funk"],
  [/\bpsychedelic hip[- ]hop\b/i, "psychedelic hip-hop"],
  [/\bpsychedelic pop\b/i, "psychedelic pop"],
  [/\bpsychedelic rock\b/i, "psychedelic rock"],
  [/\bpunk rock\b/i, "punk rock"],
  [/\br&b\b/i, "r&b"],
  [/\bsample[- ]based house\b/i, "sample-based house"],
  [/\bshoegaze\b/i, "shoegaze"],
  [/\bsinger[- ]songwriter\b/i, "singer-songwriter"],
  [/\bslowcore\b/i, "slowcore"],
  [/\bslowgaze\b/i, "slowgaze"],
  [/\bsophisti[- ]pop\b/i, "sophisti-pop"],
  [/\bsoulful house\b/i, "soulful house"],
  [/\bspace rock\b/i, "space rock"],
  [/\bspiritual jazz\b/i, "spiritual jazz"],
  [/\bsynth[- ]pop\b/i, "synth-pop"],
  [/\btrip[- ]hop\b/i, "trip-hop"],
  [/\buk techno\b/i, "uk techno"],
];

const GENRE_PRIORITY_BONUSES: Record<string, number> = {
  "math rock": 6,
  "post-rock": 5,
  "post-punk": 5,
  shoegaze: 5,
  slowcore: 4,
  dreamgaze: 4,
  doomgaze: 4,
  slowgaze: 4,
  indietronica: 4,
  "experimental electronic": 3,
  "spiritual jazz": 4,
  "free jazz": 4,
  "hardcore punk": 4,
  "melodic hardcore": 4,
  "garage punk": 4,
  "garage rock": 3,
  "singer-songwriter": 3,
  "chamber pop": 3,
  "chamber folk": 3,
};

export function buildGenreProfile(options: GenreProfileOptions) {
  const limit = options.limit || 3;
  const weightedGenres = new Map<string, WeightedGenre>();
  const excludedPhrases = buildExcludedPhrases(
    options.artistName,
    options.labelName,
    options.projectTitle,
    options.title,
  );
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

  const hasSpecificCandidates = sorted.some((genre) => !isWeakGenre(genre));
  const ordered = hasSpecificCandidates ? sorted.filter((genre) => !isWeakGenre(genre)) : sorted;

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

export function countGenreProfileSegments(value: string | null | undefined) {
  return expandGenreValue(value).length;
}

export function pickPreferredGenreProfile(...profiles: Array<string | null | undefined>) {
  const candidates = profiles
    .map((profile) => profile?.trim() || null)
    .filter((profile): profile is string => Boolean(profile));

  if (candidates.length === 0) {
    return null;
  }

  return candidates
    .sort((left, right) => scoreGenreProfile(right) - scoreGenreProfile(left))[0] || null;
}

function addWeightedGenre(
  map: Map<string, WeightedGenre>,
  candidate: string,
  baseScore: number,
  excludedPhrases: Set<string>,
) {
  const normalized = normalizeGenreName(candidate);
  if (
    !normalized ||
    excludedPhrases.has(normalized) ||
    BLOCKED_GENRES.has(normalized) ||
    !looksGenreLike(normalized)
  ) {
    return;
  }

  const current = map.get(normalized);
  const nextScore =
    (current?.score || 0) +
    baseScore +
    (isWeakGenre(normalized) ? 0 : 4) +
    (normalized.includes(" ") || normalized.includes("-") ? 1 : 0) +
    (GENRE_PRIORITY_BONUSES[normalized] || 0);

  map.set(normalized, {
    name: normalized,
    score: nextScore,
  });
}

function buildExcludedPhrases(
  artistName: string | null | undefined,
  labelName: string | null | undefined,
  projectTitle: string | null | undefined,
  title: string | null | undefined,
) {
  const phrases = new Set<string>();
  for (const value of [artistName, labelName, projectTitle, title]) {
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
    .flatMap((part) => part.split(/\s*\/\s*/))
    .map((part) => normalizeGenreName(part))
    .filter((part): part is string => part !== null);

  const expanded = parts.flatMap((part) => GENRE_ALIASES[part] || [part]);
  const normalizedExpanded = expanded
    .map((part) => normalizeGenreName(part))
    .filter((part): part is string => part !== null);

  return [...new Set(normalizedExpanded)];
}

function extractGenresFromText(text: string) {
  const normalizedText = text.replace(/([a-z])\/([a-z])/gi, "$1 / $2");
  const matches = new Set<string>();

  for (const [pattern, genre] of TEXT_GENRE_PATTERNS) {
    if (pattern.test(normalizedText)) {
      matches.add(genre);
    }
  }

  if (/\bavant[- ]garde\b/i.test(normalizedText) && /\belectronic\b/i.test(normalizedText)) {
    matches.add("avant-garde electronic");
    matches.add("experimental electronic");
  }

  if (/\bambient\b/i.test(normalizedText) && /\belectronic\b/i.test(normalizedText)) {
    matches.add("ambient electronic");
  }

  if (/\bmodular\b/i.test(normalizedText) && /\bambient\b/i.test(normalizedText)) {
    matches.add("modular ambient");
  }

  if (/\belectroacoustic\b/i.test(normalizedText) || (/\belectro\b/i.test(normalizedText) && /\bacoustic\b/i.test(normalizedText))) {
    matches.add("electroacoustic");
  }

  if (/\bfree\b/i.test(normalizedText) && /\bjazz\b/i.test(normalizedText)) {
    matches.add("free jazz");
  }

  if (/\bspiritual\b/i.test(normalizedText) && /\bjazz\b/i.test(normalizedText)) {
    matches.add("spiritual jazz");
  }

  if (/\bjungle\b/i.test(normalizedText) && /\bdrum (?:and|n) bass\b/i.test(normalizedText)) {
    matches.add("jungle");
    matches.add("drum and bass");
  }

  if (/\balt\b/i.test(normalizedText) && /\brock\b/i.test(normalizedText)) {
    matches.add("alternative rock");
  }

  if (/\balt\b/i.test(normalizedText) && /\br&b\b/i.test(normalizedText)) {
    matches.add("alternative r&b");
  }

  if (/\bhip[- ]hop\b/i.test(normalizedText) && /\bpsychedelic\b/i.test(normalizedText)) {
    matches.add("psychedelic hip-hop");
  }

  if (/\bpsychedelic\b/i.test(normalizedText) && /\bfolk\b/i.test(normalizedText)) {
    matches.add("psychedelic folk");
  }

  if (/\bpsychedelic\b/i.test(normalizedText) && /\bpop\b/i.test(normalizedText)) {
    matches.add("psychedelic pop");
  }

  if (/\bpsychedelic\b/i.test(normalizedText) && /\brock\b/i.test(normalizedText)) {
    matches.add("psychedelic rock");
  }

  if (/\bhouse\b/i.test(normalizedText) && /\bsoulful\b/i.test(normalizedText)) {
    matches.add("soulful house");
  }

  if (/\bhouse\b/i.test(normalizedText) && /\bsample(?:d|[- ])based\b/i.test(normalizedText)) {
    matches.add("sample-based house");
  }

  if (/\bhouse\b/i.test(normalizedText) && /\balternative\b/i.test(normalizedText)) {
    matches.add("alternative dance");
  }

  if (/\bchamber\b/i.test(normalizedText) && /\bfolk\b/i.test(normalizedText)) {
    matches.add("chamber folk");
  }

  if (/\bart\b/i.test(normalizedText) && /\bfolk\b/i.test(normalizedText)) {
    matches.add("art folk");
  }

  if (/\bneo\b/i.test(normalizedText) && /\bsoul\b/i.test(normalizedText)) {
    matches.add("neo-soul");
  }

  if (/\bnu\b/i.test(normalizedText) && /\bjazz\b/i.test(normalizedText)) {
    matches.add("nu jazz");
  }

  if (/\bhardcore\b/i.test(normalizedText) && /\bpunk\b/i.test(normalizedText)) {
    matches.add("hardcore punk");
  }

  if (/\bmelodic\b/i.test(normalizedText) && /\bhardcore\b/i.test(normalizedText)) {
    matches.add("melodic hardcore");
  }

  if (/\blatin\b/i.test(normalizedText) && /\balternative\b/i.test(normalizedText)) {
    matches.add("latin alternative");
  }

  if (/\blatin\b/i.test(normalizedText) && /\brock\b/i.test(normalizedText)) {
    matches.add("latin rock");
  }

  if (/\bchillwave\b/i.test(normalizedText) && /\bsynth\b/i.test(normalizedText)) {
    matches.add("synth-pop");
  }

  if (/\bsinger[- ]songwriter\b/i.test(normalizedText) && /\bfolk\b/i.test(normalizedText)) {
    matches.add("indie folk");
  }

  if (/\bdream\b/i.test(normalizedText) && /\bshoegaze\b/i.test(normalizedText)) {
    matches.add("dreamgaze");
  }

  if (/\bslowcore\b/i.test(normalizedText) && /\bshoegaze\b/i.test(normalizedText)) {
    matches.add("slowgaze");
  }

  if (/\bdoom\b/i.test(normalizedText) && /\bshoegaze\b/i.test(normalizedText)) {
    matches.add("doomgaze");
  }

  if (/\bmath rock\b/i.test(normalizedText) && /\b(?:alt|alternative)\b/i.test(normalizedText)) {
    matches.add("math rock");
    matches.add("alternative rock");
  }

  if (/\bmath rock\b/i.test(normalizedText) && /\belectronic\b/i.test(normalizedText)) {
    matches.add("math rock");
    matches.add("experimental electronic");
  }

  if (/\b(?:alt|alternative)\b/i.test(normalizedText) && /\bguitar\b/i.test(normalizedText)) {
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
    .replace(/\br\s*(?:&|and)\s*b\b/gi, "r&b")
    .replace(/\bhip hop\b/gi, "hip-hop")
    .replace(/\bneo soul\b/gi, "neo-soul")
    .replace(/\bartpop\b/gi, "art pop")
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
      return normalizeGenreName(lastPart.replace(/-/g, " "));
    } catch {
      return null;
    }
  }

  return GENRE_ALIASES[normalized]?.[0] || normalized;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function looksGenreLike(value: string) {
  if (KNOWN_SINGLE_WORD_GENRES.has(value) || GENRE_ALIASES[value]) {
    return true;
  }

  if (!value.includes(" ") && !value.includes("-") && !value.includes("&")) {
    return false;
  }

  return value
    .split(/[\s/-]+/)
    .some((token) => token && KNOWN_GENRE_PARTS.has(token));
}

function isWeakGenre(value: string) {
  return WEAK_GENRES.has(value);
}

function isRedundantGenre(candidate: string, selected: string[]) {
  return selected.some((existing) => {
    if (existing === candidate) {
      return true;
    }

    if (candidate.includes(existing) || existing.includes(candidate)) {
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

function scoreGenreProfile(value: string) {
  const segments = expandGenreValue(value);
  const specificSegments = segments.filter((genre) => !isWeakGenre(genre));

  return specificSegments.length * 20 + segments.length * 8 + value.length / 100;
}
