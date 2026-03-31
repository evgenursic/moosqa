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
  "indie rock",
  "alternative rock",
  "indie pop",
  "alternative pop",
  "indie folk",
  "folk rock",
  "pop rock",
  "punk rock",
  "electronic pop",
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
  "avant-jazz",
  "balearic",
  "blackgaze",
  "chillwave",
  "coldwave",
  "darkwave",
  "disco",
  "downtempo",
  "drone",
  "dreamgaze",
  "dreamwave",
  "electropop",
  "emo",
  "experimental",
  "folk",
  "garage",
  "gothic",
  "grunge",
  "hardcore",
  "house",
  "indietronica",
  "jungle",
  "krautrock",
  "lo-fi",
  "metal",
  "new wave",
  "noise",
  "pop",
  "punk",
  "rock",
  "shoegaze",
  "slowcore",
  "soul",
  "synthwave",
  "techno",
  "trip-hop",
]);

const KNOWN_GENRE_PARTS = new Set([
  "acoustic",
  "analog",
  "alternative",
  "ambient",
  "americana",
  "anthemic",
  "art",
  "atmospheric",
  "avant",
  "baroque",
  "bass",
  "bedroom",
  "black",
  "breakbeat",
  "britpop",
  "chamber",
  "chiming",
  "chillwave",
  "cinematic",
  "coldwave",
  "cosmic",
  "country",
  "dance",
  "dark",
  "darkwave",
  "disco",
  "doom",
  "dream",
  "dreamwave",
  "drone",
  "dub",
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
  "goth",
  "gothic",
  "grunge",
  "hardcore",
  "heartland",
  "hip",
  "hop",
  "house",
  "hyperpop",
  "indian",
  "indie",
  "industrial",
  "jagged",
  "jangle",
  "jazz",
  "jungle",
  "kosmische",
  "latin",
  "lo",
  "lofi",
  "math",
  "melodic",
  "metal",
  "minimal",
  "modular",
  "motorik",
  "neo",
  "noise",
  "noir",
  "nu",
  "outsider",
  "orchestral",
  "pop",
  "post",
  "power",
  "prog",
  "progressive",
  "psych",
  "psychedelic",
  "punk",
  "recorded",
  "r&b",
  "r",
  "rock",
  "sample",
  "shoegaze",
  "singer",
  "soft",
  "slow",
  "slowcore",
  "soul",
  "space",
  "spiritual",
  "synth",
  "synthwave",
  "trip-hop",
  "trip",
  "twee",
  "twang",
  "wave",
]);

const GENRE_ALIASES: Record<string, string[]> = {
  "alt country": ["alt-country"],
  "alt pop": ["alternative pop"],
  "alt r&b": ["alternative r&b"],
  "alt rock": ["alternative rock"],
  "alt-pop": ["alternative pop"],
  "alt-country": ["alt-country"],
  "alternative": ["alternative"],
  "alternative dance": ["alternative dance"],
  "alternative pop": ["alternative pop"],
  "alternative r & b": ["alternative r&b"],
  "alternative r and b": ["alternative r&b"],
  "alternative r&b": ["alternative r&b"],
  "alternative rock": ["alternative rock"],
  "ambient": ["ambient"],
  "ambient electronic": ["ambient electronic"],
  "ambient folk": ["ambient folk"],
  "americana": ["americana"],
  "arabic": ["arabic"],
  "arabic funk": ["arabic funk"],
  "art folk": ["art folk"],
  "art pop": ["art pop"],
  "art punk": ["art punk"],
  "art rock": ["art rock"],
  "artpop": ["art pop"],
  "avant jazz": ["avant-jazz"],
  "avant-jazz": ["avant-jazz"],
  "avant doom": ["avant-doom"],
  "avant-doom": ["avant-doom"],
  "avant-garde electronic": ["avant-garde electronic"],
  "baroque pop": ["baroque pop"],
  "baroque-pop": ["baroque pop"],
  "bedroom pop": ["bedroom pop"],
  "bedroom-pop": ["bedroom pop"],
  "black gaze": ["blackgaze"],
  "blackgaze": ["blackgaze"],
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
  "dream rock": ["dream rock"],
  "dream folk": ["dream folk"],
  "dream pop": ["dream pop"],
  "dream-pop": ["dream pop"],
  "dreamgaze": ["dreamgaze"],
  "dreamwave": ["dreamwave"],
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
  "electronic rock": ["electronic rock"],
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
  "gothic rock": ["gothic rock"],
  "glitch pop": ["glitch pop"],
  "hard rock": ["hard rock"],
  "hardcore punk": ["hardcore punk"],
  "heartland rock": ["heartland rock"],
  "hip hop": ["hip-hop"],
  "hip-hop": ["hip-hop"],
  "indian classical": ["indian classical"],
  "indie folk": ["indie folk"],
  "indie pop": ["indie pop"],
  "indie rock": ["indie rock"],
  "indie soul": ["indie soul"],
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
  "lo fi": ["lo-fi"],
  "lo-fi": ["lo-fi"],
  "lofi": ["lo-fi"],
  "lo-fi folk": ["lo-fi folk"],
  "lo-fi indie": ["lo-fi indie"],
  "lo-fi pop": ["lo-fi pop"],
  "lo-fi rock": ["lo-fi rock"],
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
  "progressive pop": ["progressive pop"],
  "progressive rock": ["progressive rock"],
  "prog rock": ["progressive rock"],
  "post britpop": ["post-britpop"],
  "post hardcore": ["post-hardcore"],
  "post metal": ["post-metal"],
  "post punk": ["post-punk"],
  "post rock": ["post-rock"],
  "post-britpop": ["post-britpop"],
  "post-hardcore": ["post-hardcore"],
  "post-metal": ["post-metal"],
  "post-punk": ["post-punk"],
  "post-rock": ["post-rock"],
  "power pop": ["power pop"],
  "psych folk": ["psychedelic folk"],
  "psych pop": ["psychedelic pop"],
  "psych rock": ["psychedelic rock"],
  "psych-pop": ["psychedelic pop"],
  "psych-folk": ["psychedelic folk"],
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
  "soft rock": ["soft rock"],
  "sophisti-pop": ["sophisti-pop"],
  "sludge metal": ["sludge metal"],
  "soulful house": ["soulful house"],
  "space rock": ["space rock"],
  "spiritual jazz": ["spiritual jazz"],
  "synth pop": ["synth-pop"],
  "synth-pop": ["synth-pop"],
  "synthwave": ["synthwave"],
  "twee pop": ["twee pop"],
  "trip hop": ["trip-hop"],
  "trip-hop": ["trip-hop"],
  "uk techno": ["uk techno"],
  "world": ["world"],
};

const TEXT_GENRE_PATTERNS: Array<[RegExp, string]> = [
  [/\balt(?:ernative)?[- ]country\b/i, "alt-country"],
  [/\balternative dance\b/i, "alternative dance"],
  [/\balternative pop\b/i, "alternative pop"],
  [/\balternative rock\b/i, "alternative rock"],
  [/\bambient folk\b/i, "ambient folk"],
  [/\bart folk\b/i, "art folk"],
  [/\bart pop\b/i, "art pop"],
  [/\bart punk\b/i, "art punk"],
  [/\bart rock\b/i, "art rock"],
  [/\bart[- ]pop\b/i, "art pop"],
  [/\bavant[- ]jazz\b/i, "avant-jazz"],
  [/\bavant[- ]garde electronic\b/i, "avant-garde electronic"],
  [/\bbalearic\b/i, "balearic"],
  [/\bbaroque[- ]pop\b/i, "baroque pop"],
  [/\bbedroom[- ]pop\b/i, "bedroom pop"],
  [/\bblackgaze\b/i, "blackgaze"],
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
  [/\bdream[- ]rock\b/i, "dream rock"],
  [/\bdreamgaze\b/i, "dreamgaze"],
  [/\bdreamwave\b/i, "dreamwave"],
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
  [/\bgothic rock\b/i, "gothic rock"],
  [/\bglitch pop\b/i, "glitch pop"],
  [/\bhard rock\b/i, "hard rock"],
  [/\bhardcore punk\b/i, "hardcore punk"],
  [/\bheartland rock\b/i, "heartland rock"],
  [/\bhip[- ]hop\b/i, "hip-hop"],
  [/\bhindustani classical\b/i, "indian classical"],
  [/\bindian classical\b/i, "indian classical"],
  [/\bindie folk\b/i, "indie folk"],
  [/\bindie pop\b/i, "indie pop"],
  [/\bindie rock\b/i, "indie rock"],
  [/\bindie soul\b/i, "indie soul"],
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
  [/\blo[- ]fi\b/i, "lo-fi"],
  [/\blo[- ]fi folk\b/i, "lo-fi folk"],
  [/\blo[- ]fi indie\b/i, "lo-fi indie"],
  [/\blo[- ]fi pop\b/i, "lo-fi pop"],
  [/\blo[- ]fi rock\b/i, "lo-fi rock"],
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
  [/\bprogressive pop\b/i, "progressive pop"],
  [/\b(?:prog|progressive) rock\b/i, "progressive rock"],
  [/\bpost[- ]britpop\b/i, "post-britpop"],
  [/\bpost[- ]hardcore\b/i, "post-hardcore"],
  [/\bpost[- ]metal\b/i, "post-metal"],
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
  [/\bsludge metal\b/i, "sludge metal"],
  [/\bsoft rock\b/i, "soft rock"],
  [/\bsophisti[- ]pop\b/i, "sophisti-pop"],
  [/\bsoulful house\b/i, "soulful house"],
  [/\bspace rock\b/i, "space rock"],
  [/\bspiritual jazz\b/i, "spiritual jazz"],
  [/\bsynth[- ]pop\b/i, "synth-pop"],
  [/\bsynthwave\b/i, "synthwave"],
  [/\btwee pop\b/i, "twee pop"],
  [/\btrip[- ]hop\b/i, "trip-hop"],
  [/\buk techno\b/i, "uk techno"],
];

const GENRE_PRIORITY_BONUSES: Record<string, number> = {
  "alternative dance": 3,
  "art punk": 4,
  "avant-jazz": 4,
  blackgaze: 5,
  "math rock": 6,
  "post-rock": 5,
  "post-punk": 5,
  shoegaze: 5,
  slowcore: 4,
  "dream rock": 3,
  dreamgaze: 4,
  doomgaze: 4,
  slowgaze: 4,
  "dreamwave": 3,
  indietronica: 4,
  "experimental electronic": 3,
  "spiritual jazz": 4,
  "free jazz": 4,
  "hardcore punk": 4,
  "melodic hardcore": 4,
  "garage punk": 4,
  "garage rock": 3,
  "gothic rock": 3,
  "heartland rock": 3,
  "jangle pop": 5,
  "lo-fi indie": 3,
  "lo-fi rock": 3,
  "neo-psychedelia": 4,
  "noise pop": 4,
  "noise rock": 5,
  "progressive rock": 4,
  "psychedelic folk": 4,
  "psychedelic pop": 3,
  "psychedelic rock": 4,
  "singer-songwriter": 3,
  "chamber pop": 3,
  "chamber folk": 3,
  "synthwave": 3,
  "twee pop": 3,
};

type DescriptorRule = {
  patterns: RegExp[];
  genres: string[];
  any?: boolean;
};

const DESCRIPTOR_RULES: DescriptorRule[] = [
  {
    patterns: [/\b(?:jangly|chiming|twelve-string|ringing guitars?)\b/i],
    genres: ["jangle pop"],
  },
  {
    patterns: [
      /\b(?:hazy|ethereal|shimmering|lush|glimmering|swooning)\b/i,
      /\b(?:indie|pop|rock|guitar|shoegaze|dream)\b/i,
    ],
    genres: ["dream pop"],
  },
  {
    patterns: [
      /\b(?:reverb(?:-washed|-drenched)?|washed[- ]out|wall of sound|fuzzed[- ]out|foggy)\b/i,
      /\b(?:guitar|dream|pop|rock|shoegaze|indie)\b/i,
    ],
    genres: ["shoegaze"],
  },
  {
    patterns: [
      /\b(?:angular|wiry|taut|serrated|bass-driven|knife-edge)\b/i,
      /\b(?:rock|punk|indie|alternative|dance)\b/i,
    ],
    genres: ["post-punk"],
  },
  {
    patterns: [/\b(?:motorik|kosmische|kosmisch|neu!-ish)\b/i],
    genres: ["krautrock", "space rock"],
  },
  {
    patterns: [
      /\b(?:fingerpicked|acoustic|confessional|intimate|hushed)\b/i,
      /\b(?:folk|songwriter|ballad|indie|stripped-back)\b/i,
    ],
    genres: ["singer-songwriter", "indie folk"],
  },
  {
    patterns: [
      /\b(?:string-laden|orchestral|piano-led|chamber|ornate)\b/i,
      /\b(?:pop|folk|songwriter|ballad)\b/i,
    ],
    genres: ["chamber pop"],
  },
  {
    patterns: [
      /\b(?:harpsichord|baroque|ornate|string-laden)\b/i,
      /\b(?:pop|ballad|songwriter)\b/i,
    ],
    genres: ["baroque pop"],
  },
  {
    patterns: [
      /\b(?:home-recorded|cassette|lo[- ]fi|lofi|bedroom-made)\b/i,
      /\b(?:indie|pop|rock|folk)\b/i,
    ],
    genres: ["lo-fi indie"],
  },
  {
    patterns: [
      /\b(?:dancefloor|club-ready|pulsing|propulsive|groove-driven)\b/i,
      /\b(?:indie|electronic|synth|dance)\b/i,
    ],
    genres: ["alternative dance"],
  },
  {
    patterns: [
      /\b(?:analog synth|retro synth|glossy synth|bright synth|neon-lit|new romantic)\b/i,
    ],
    genres: ["synth-pop", "new wave"],
  },
  {
    patterns: [
      /\b(?:nocturnal|midnight|retro-futurist|chrome-plated|neon-soaked)\b/i,
      /\b(?:synth|electronic|wave)\b/i,
    ],
    genres: ["dreamwave", "synthwave"],
  },
  {
    patterns: [
      /\b(?:dissonant|jagged|abrasive|noisy|squalling)\b/i,
      /\b(?:rock|guitar|punk|post[- ]punk|alternative)\b/i,
    ],
    genres: ["noise rock"],
  },
  {
    patterns: [
      /\b(?:fuzzy|hooky|bubblegum|melodic|sugar-rush)\b/i,
      /\b(?:pop|indie|guitar|noise)\b/i,
    ],
    genres: ["noise pop", "power pop"],
  },
  {
    patterns: [
      /\b(?:slow-burning|spare|minimal|bleak|hushed|sadcore)\b/i,
      /\b(?:rock|indie|guitar|ballad)\b/i,
    ],
    genres: ["slowcore"],
  },
  {
    patterns: [
      /\b(?:gothic|brooding|gloomy|shadowy|cold)\b/i,
      /\b(?:rock|wave|post[- ]punk|synth)\b/i,
    ],
    genres: ["darkwave", "gothic rock"],
  },
  {
    patterns: [
      /\b(?:improvised|free-form|horn-led|modal|open-ended)\b/i,
      /\bjazz\b/i,
    ],
    genres: ["free jazz", "spiritual jazz"],
  },
  {
    patterns: [
      /\b(?:twang(?:y)?|dusty|front-porch|country-leaning|open-road)\b/i,
      /\b(?:folk|country|americana|rock)\b/i,
    ],
    genres: ["americana", "alt-country"],
  },
  {
    patterns: [
      /\b(?:cosmic|sun-baked|wide-open)\b/i,
      /\b(?:americana|country|twang(?:y)?|folk)\b/i,
    ],
    genres: ["cosmic Americana"],
  },
  {
    patterns: [
      /\b(?:swirling|hallucinatory|kaleidoscopic|lysergic|psych)\b/i,
      /\b(?:rock|pop|folk|guitar)\b/i,
    ],
    genres: ["neo-psychedelia"],
  },
  {
    patterns: [
      /\b(?:falsetto|silken|groove-led|velvet-smooth|soulful)\b/i,
      /\b(?:r&b|soul|funk|jazz|pop)\b/i,
    ],
    genres: ["neo-soul", "indie soul"],
  },
  {
    patterns: [
      /\b(?:mathy|tapping riffs?|odd-meter|intricate guitars?)\b/i,
      /\b(?:rock|indie|post[- ]hardcore)\b/i,
    ],
    genres: ["math rock"],
  },
  {
    patterns: [
      /\b(?:uplifting|heartland|rust-belt|anthemic)\b/i,
      /\b(?:rock|guitar|americana|indie)\b/i,
    ],
    genres: ["heartland rock"],
  },
];

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

  for (const rule of DESCRIPTOR_RULES) {
    const isMatch = rule.any
      ? rule.patterns.some((pattern) => pattern.test(normalizedText))
      : rule.patterns.every((pattern) => pattern.test(normalizedText));

    if (!isMatch) {
      continue;
    }

    for (const genre of rule.genres) {
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

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:jangly|chiming)\b/i.test(normalizedText)) {
    matches.add("jangle pop");
  }

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:hazy|ethereal|shimmering)\b/i.test(normalizedText)) {
    matches.add("dream pop");
  }

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:angular|wiry|taut)\b/i.test(normalizedText)) {
    matches.add("post-punk");
  }

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:slow-burning|spare|minimal|hushed)\b/i.test(normalizedText)) {
    matches.add("slowcore");
  }

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:home-recorded|lo[- ]fi|lofi|cassette)\b/i.test(normalizedText)) {
    matches.add("lo-fi indie");
  }

  if (/\b(?:indie|alternative)\b/i.test(normalizedText) && /\b(?:pulsing|dancefloor|club-ready|groove-driven)\b/i.test(normalizedText)) {
    matches.add("alternative dance");
  }

  if (/\b(?:folk|songwriter)\b/i.test(normalizedText) && /\b(?:string-laden|orchestral|piano-led|chamber)\b/i.test(normalizedText)) {
    matches.add("chamber folk");
  }

  if (/\b(?:folk|acoustic)\b/i.test(normalizedText) && /\b(?:dreamy|hazy|ethereal)\b/i.test(normalizedText)) {
    matches.add("dream folk");
  }

  if (/\b(?:psych|psychedelic)\b/i.test(normalizedText) && /\b(?:americana|country|twang)\b/i.test(normalizedText)) {
    matches.add("cosmic Americana");
  }

  if (/\b(?:post[- ]punk|punk)\b/i.test(normalizedText) && /\b(?:dancefloor|disco|club|groove)\b/i.test(normalizedText)) {
    matches.add("dance-punk");
  }

  if (/\b(?:synth|new wave)\b/i.test(normalizedText) && /\b(?:brooding|gothic|cold|shadowy)\b/i.test(normalizedText)) {
    matches.add("darkwave");
  }

  if (/\b(?:synth|electronic)\b/i.test(normalizedText) && /\b(?:retro-futurist|neon|80s|glossy)\b/i.test(normalizedText)) {
    matches.add("synthwave");
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
    .replace(/\blofi\b/gi, "lo-fi")
    .replace(/\blo fi\b/gi, "lo-fi")
    .replace(/\bneo soul\b/gi, "neo-soul")
    .replace(/\bprog rock\b/gi, "progressive rock")
    .replace(/\bpost metal\b/gi, "post-metal")
    .replace(/\bblack gaze\b/gi, "blackgaze")
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
  const weakSegments = segments.length - specificSegments.length;
  const specificityBonus = specificSegments.reduce(
    (score, genre) => score + (GENRE_PRIORITY_BONUSES[genre] || 0),
    0,
  );
  const genericPenalty = weakSegments * 7;

  return (
    specificSegments.length * 24 +
    segments.length * 7 +
    specificityBonus -
    genericPenalty +
    value.length / 100
  );
}
