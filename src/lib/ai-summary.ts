import OpenAI from "openai";

import { ReleaseType } from "@/generated/prisma/enums";
import { decodeHtmlEntities } from "@/lib/utils";

type SummaryInput = {
  artistName: string | null;
  projectTitle: string | null;
  title: string;
  genreName: string | null;
  releaseType: ReleaseType;
  sourceExcerpt: string | null;
  sourceTitle?: string | null;
  outletName?: string | null;
  labelName?: string | null;
};

type SummaryFacts = {
  subject: string;
  workTitle: string;
  genrePhrase: string | null;
  moodCue: string | null;
  detailCue: string | null;
  themeCue: string | null;
  trackCount: number | null;
  guestArtist: string | null;
  upcomingProject: string | null;
  performanceSetting: string | null;
  referenceWork: string | null;
  originalYear: string | null;
  descriptiveClause: string | null;
  isCoverSet: boolean;
  isReissue: boolean;
  isReimagining: boolean;
};

let client: OpenAI | null = null;

const GENERIC_SUMMARY_PATTERNS = [
  "lands with a",
  "arrives with a focused",
  "forward through",
  "sharper route into",
  "more purposeful move",
  "cleaner angle",
  "easy to place on a first listen",
  "opening moments",
  "puts its hook at the center",
  "lean into sharp melodic detail",
  "around clear textural detail",
  "brings live arrangement details into focus",
  "pushes its central motif forward",
  "turn this performance toward",
  "into focus here",
  "setting the tone for the ep",
  "setting the tone for the album",
  "clean entry point",
  "rather than overloading the arrangement",
  "keeps the single in",
  "keeps the song in",
  "keeps the release in",
  "in a indie",
  "the main motif carries",
  "built around strong tonal contrast",
  "texture over clutter",
  "gives room to foreground",
  "does most of the scene-setting",
  "a debut-era performance gives",
  "pointed toward an",
  "defined than generic",
  "gives a sharper route into",
  "carrying the release",
  "feels less like background catalog",
  "presenting ",
  "foreground acoustic detail",
  "more intimate take on the material",
  "first impression",
  "defined sonic palette",
  "feels more exposed",
  "lean into acoustic detail",
  "pointed toward a",
  "this live setting brings",
  "this live setting strips",
  "this live setting leaves",
  "this live setting gives",
  "the tiny desk setup leaves",
  "in the tiny desk room",
  "the tiny desk framing",
  "an audiotree session strips",
  "a world cafe session",
  "a studio session",
];

const MOOD_CUES: Array<[RegExp, string]> = [
  [/\b(jangly|jangle)\b/i, "jangly"],
  [/\b(shimmering|shimmer|glowing)\b/i, "shimmering"],
  [/\b(dreamy|dream-pop|dream pop|hazy)\b/i, "dreamy"],
  [/\b(brooding|brood|ominous)\b/i, "brooding"],
  [/\b(urgent|urgentness|restless)\b/i, "urgent"],
  [/\b(melancholic|melancholy|wistful)\b/i, "wistful"],
  [/\b(tender|intimate|close-up)\b/i, "intimate"],
  [/\b(noisy|abrasive|ragged)\b/i, "ragged"],
  [/\b(cinematic|score)\b/i, "cinematic"],
  [/\b(heavy|heavier|crushing)\b/i, "heavy"],
  [/\b(soaring|anthemic)\b/i, "soaring"],
  [/\b(playful|bright)\b/i, "bright"],
  [/\b(stripped-back|stripped back)\b/i, "stripped-back"],
  [/\b(confused|confusion|uncertain|doubt)\b/i, "unsettled"],
];

const DETAIL_CUES: Array<[RegExp, string]> = [
  [/\b(acoustic)\b/i, "acoustic detail"],
  [/\b(piano|keys)\b/i, "piano-led phrasing"],
  [/\b(jangly guitars?|jangle)\b/i, "jangly guitar work"],
  [/\b(guitars?|riff)\b/i, "guitar texture"],
  [/\b(synth|synths|synth-pop|electronics?)\b/i, "electronic detail"],
  [/\b(harmonies|harmony)\b/i, "stacked harmonies"],
  [/\b(drums?|percussion)\b/i, "percussive drive"],
  [/\b(strings?|orchestral)\b/i, "orchestral sweep"],
  [/\b(ambient)\b/i, "ambient drift"],
  [/\b(bass)\b/i, "low-end motion"],
  [/\b(ballad)\b/i, "ballad pacing"],
  [/\b(chorus|hook)\b/i, "a sharp hook"],
  [/\b(distorted|distortion)\b/i, "distorted weight"],
  [/\b(glacial)\b/i, "glacial pacing"],
  [/\b(drone)\b/i, "drone weight"],
];

const THEME_CUES: Array<[RegExp, string]> = [
  [/\b(don't know|what the fuck is going on|hard to do|should i)\b/i, "self-questioning lyrics"],
  [/\b(revenge|murder|insane)\b/i, "a darker edge"],
  [/\b(friend|good friend)\b/i, "a bruised kind of tenderness"],
  [/\b(debut)\b/i, "a debut statement"],
  [/\b(reissue|reissued|reissue)\b/i, "an archival pull"],
  [/\b(interview)\b/i, "an interview-framed setting"],
  [/\b(covers?)\b/i, "a covers-minded frame"],
  [/\b(collaboration|collaborative)\b/i, "a collaborative spark"],
];

export async function generateAiSummary(input: SummaryInput) {
  if (!process.env.OPENAI_API_KEY) {
    return buildFallbackSummary(input);
  }

  try {
    client ??= new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5-nano",
      max_output_tokens: 80,
      input: [
        {
          role: "system",
          content: [
            "You write one-sentence music discovery blurbs for an editorial release feed.",
            "Be specific to the supplied context and make every blurb feel distinct from the last one.",
            "Use exactly one sentence and keep it under 28 words.",
            "Do not mention Reddit.",
            "Do not repeat the main artist name, billing, or release title already visible on the card.",
            "Avoid stock phrasing such as lands with, arrives with, immediate, easy to place on a first listen, opening moments, or clean entry point.",
            "Prefer concrete details from the source text: venue, instrumentation, cover/reissue angle, track count, label, outlet, live framing, or lyrical mood.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Artist: ${decodeHtmlEntities(input.artistName || "Unknown")}`,
                `Release title: ${decodeHtmlEntities(input.projectTitle || input.title)}`,
                `Release type: ${input.releaseType}`,
                `Genre: ${sanitizeGenreForSummary(input.genreName) || "Unknown"}`,
                `Outlet: ${decodeHtmlEntities(input.outletName || "Unknown")}`,
                `Label: ${decodeHtmlEntities(input.labelName || "Unknown")}`,
                `Source title: ${decodeHtmlEntities(input.sourceTitle || "Unknown")}`,
                `Context: ${decodeHtmlEntities(input.sourceExcerpt || "No extra context available.")}`,
                "Write exactly one sentence.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    return sanitizeSummary(response.output_text, input) || buildFallbackSummary(input);
  } catch {
    return buildFallbackSummary(input);
  }
}

export function shouldRegenerateAiSummary(value: string | null | undefined) {
  if (!value) {
    return true;
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return true;
  }

  if (
    normalized.includes("schema.googleapis.com") ||
    normalized.includes("schema.org")
  ) {
    return true;
  }

  if (GENERIC_SUMMARY_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  return normalized.split(" ").length < 8;
}

function buildFallbackSummary(input: SummaryInput) {
  const subject = resolveSubjectName(input);
  const workTitle = resolveWorkTitle(input);
  const context = normalizeContextText(
    [input.sourceTitle, input.sourceExcerpt].filter(Boolean).join(". "),
  );
  const titleCueSource = normalizeContextText(
    [input.title, input.sourceTitle].filter(Boolean).join(". "),
  );
  const facts = extractFacts(input, subject, workTitle, context, titleCueSource);
  const seed = hashString(
    [
      subject,
      workTitle,
      input.releaseType,
      facts.genrePhrase || "",
      facts.detailCue || "",
      facts.themeCue || "",
      facts.performanceSetting || "",
      facts.referenceWork || "",
      context,
    ].join("|"),
  );

  if (input.releaseType === ReleaseType.PERFORMANCE || input.releaseType === ReleaseType.LIVE_SESSION) {
    return finalizeSummary(buildPerformanceSummary(facts, seed));
  }

  if (facts.isCoverSet) {
    return finalizeSummary(
      chooseVariant(seed, [
        `The cover angle matters less than the recasting, with ${facts.detailCue || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "the arrangement"} giving familiar material a different weight`,
        `Instead of replaying the source, the performance leans on ${facts.detailCue || facts.themeCue || "its own character"} to make the reframing stick`,
        `The cover framing stays visible, but ${facts.detailCue || buildThemeFrame(facts.themeCue, facts.moodCue) || "the tonal shift"} is what actually changes the read`,
      ]),
    );
  }

  if (facts.isReimagining) {
    return finalizeSummary(
      chooseVariant(seed, [
        `The reworking leans on ${facts.detailCue || withArticle(facts.genrePhrase || "a more radical frame")} rather than settling for a straight revisit`,
        `A fresh arrangement pulls ${facts.detailCue || facts.themeCue || "new tension"} out of familiar material without leaning on nostalgia alone`,
        `${facts.originalYear ? `Material first issued in ${facts.originalYear}` : "Earlier material"} is recast through ${facts.detailCue || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "a different frame"}`,
      ]),
    );
  }

  if (facts.isReissue) {
    return finalizeSummary(
      chooseVariant(seed, [
        `The archival pull stays intact here, with ${facts.detailCue || facts.themeCue || "the original atmosphere"} still doing more than enough work`,
        `This reissue leans into ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "sharper historical frame")} instead of treating the material like museum glass`,
        `The return feels vivid rather than dutiful, especially once ${facts.detailCue || facts.genrePhrase || "the sonic grain"} settles in`,
        `${facts.originalYear ? `The original ${facts.originalYear} frame` : "The earlier frame"} remains audible, but ${facts.detailCue || "the detail work"} keeps it from feeling sealed off`,
      ]),
    );
  }

  if (facts.upcomingProject && facts.guestArtist) {
    return finalizeSummary(
      chooseVariant(seed, [
        `A guest feature turns this preview into a sharper bridge toward ${inferUpcomingProjectFrame(context, titleCueSource)}, with ${facts.detailCue || "the arrangement"} doing the real setup work`,
        `Rather than sounding ornamental, the featured voice shifts the single toward ${facts.detailCue || buildThemeFrame(facts.themeCue, facts.moodCue) || "a more pointed frame"}`,
        `The collaboration feels structural here, using ${facts.detailCue || facts.themeCue || "the contrast in tone"} to hint at ${inferUpcomingProjectFrame(context, titleCueSource)}`,
      ]),
    );
  }

  if (facts.upcomingProject) {
    return finalizeSummary(
      chooseVariant(seed, [
        `This preview points toward ${inferUpcomingProjectFrame(context, titleCueSource)}, leaning on ${facts.detailCue || facts.genrePhrase || "the arrangement"} rather than a blunt teaser hook`,
        `The coming release is framed through ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.detailCue || "clearer sonic angle")}, which keeps the preview from feeling generic`,
        `Most of the setup work lands in ${facts.detailCue || facts.themeCue || "the arrangement"}, giving the rollout a more specific shape than a standard advance single`,
      ]),
    );
  }

  if (
    (input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP) &&
    facts.trackCount
  ) {
    return finalizeSummary(
      chooseVariant(seed, [
        `Across ${facts.trackCount} tracks, this ${getTypeLabel(input.releaseType)} leans on ${facts.detailCue || facts.genrePhrase || "a clear sonic identity"} instead of filler`,
        `${facts.trackCount} tracks are enough to sketch ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "clear silhouette")}, with ${facts.detailCue || "the strongest details"} holding it together`,
        `The ${facts.trackCount}-track sequence keeps returning to ${facts.detailCue || facts.themeCue || "its sharpest ideas"}, which gives the release a coherent pull`,
      ]),
    );
  }

  if (input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP) {
    return finalizeSummary(
      chooseVariant(seed, [
        `This ${getTypeLabel(input.releaseType)} sits in ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || "broader frame")}, with ${facts.detailCue || buildThemeFrame(facts.themeCue, facts.moodCue) || "the sequencing"} doing the heavy lifting`,
        `The set feels defined by ${facts.detailCue || facts.genrePhrase || "its sonic palette"}, not just by the fact that it runs longer than a single`,
        `Most of the weight lands in ${facts.detailCue || facts.themeCue || facts.genrePhrase || "its strongest ideas"}, which keeps the runtime purposeful`,
      ]),
    );
  }

  return finalizeSummary(
    chooseVariant(seed, [
      `The single leans on ${facts.detailCue || "a clear melodic center"}, which gives ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "the hook")} a cleaner shape`,
      `${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || "defined frame")} holds the single together, while ${facts.detailCue || "the arrangement"} keeps it from flattening out`,
      `${facts.detailCue || "The arrangement"} does most of the work here, pulling the ${buildThemeFrame(facts.themeCue, facts.moodCue) || facts.moodCue || facts.genrePhrase || "overall mood"} into focus`,
      `The strongest impression comes from ${facts.detailCue || facts.genrePhrase || "the texture"}, with ${facts.themeCue || facts.moodCue || "the emotional angle"} filling in the rest`,
      `Rather than chasing scale, the single stays locked into ${facts.detailCue || facts.themeCue || "its sharpest details"}, and that restraint gives it shape`,
    ]),
  );
}

function extractFacts(
  input: SummaryInput,
  subject: string,
  workTitle: string,
  context: string,
  titleCueSource: string,
): SummaryFacts {
  return {
    subject,
    workTitle,
    genrePhrase: normalizeGenrePhrase(sanitizeGenreForSummary(input.genreName)),
    moodCue: extractCue(`${titleCueSource}. ${context}`, MOOD_CUES) || inferMoodFromTitle(workTitle),
    detailCue:
      extractCue(`${titleCueSource}. ${context}`, DETAIL_CUES) ||
      inferArrangementFromGenre(input.genreName, input.releaseType),
    themeCue: extractCue(`${titleCueSource}. ${context}`, THEME_CUES) || inferThemeFromTitle(workTitle, context),
    trackCount: extractTrackCount(context),
    guestArtist: extractFeaturedArtist(titleCueSource) || extractFeaturedArtist(context),
    upcomingProject: extractUpcomingProject(titleCueSource),
    performanceSetting: extractPerformanceSetting(titleCueSource) || extractPerformanceSetting(context),
    referenceWork: extractReferencedWork(context, workTitle),
    originalYear: extractOriginalYear(context),
    descriptiveClause: extractDescriptiveClause(context),
    isCoverSet: /\bcovers?\b/i.test(titleCueSource),
    isReissue: /\b(reissue|reissued|deluxe|expanded|anniversary|back in print)\b/i.test(titleCueSource) || /\b(reissue|reissued|deluxe|expanded|anniversary|back in print)\b/i.test(context),
    isReimagining: /\b(reimagine|reimagines|reimagined|reinterpret|reworking|rework|recast|inversion|inversions)\b/i.test(context),
  };
}

function buildPerformanceSummary(facts: SummaryFacts, seed: number) {
  const setting = facts.performanceSetting || "this live setting";
  const liveStopMatch = setting.match(/^a live stop at (.+)$/i);
  const detail = facts.detailCue || "the room sound";
  const secondary = buildThemeFrame(facts.themeCue, facts.moodCue) || facts.moodCue || facts.genrePhrase || "the mood";

  if (facts.guestArtist) {
    if (setting === "this live setting") {
      return chooseVariant(seed, [
        `A guest voice changes the balance of the live take, pushing ${detail} and ${secondary} closer to the surface`,
        `The live arrangement opens up around the guest feature, leaving ${detail} to do most of the reshaping`,
        `A featured voice turns the live version outward, with ${detail} carrying the extra tension`,
      ]);
    }

    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} gives the guest feature real weight, especially once ${detail} starts to reshape the performance`,
      `In ${stripLeadingArticle(setting)}, the collaboration matters because ${detail} and ${secondary} are pushed closer to the mic`,
      `${capitalizeFirst(setting)} turns the guest feature into part of the arrangement rather than a side detail, with ${detail} doing the work`,
    ]);
  }

  if (liveStopMatch?.[1]) {
    return chooseVariant(seed, [
      `At ${liveStopMatch[1]}, ${detail} does more of the storytelling than studio polish ever could`,
      `The stop at ${liveStopMatch[1]} keeps the performance tight enough for ${detail} and ${secondary} to register clearly`,
      `At ${liveStopMatch[1]}, the room sound leaves ${detail} and ${secondary} out in front`,
    ]);
  }

  if (/tiny desk/i.test(setting)) {
    return chooseVariant(seed, [
      `The Tiny Desk setup pulls ${detail} close enough to feel tactile, with ${secondary} replacing any remaining polish`,
      `In the Tiny Desk room, ${detail} carries the performance while ${secondary} gives the take a looser edge`,
      `The Tiny Desk framing trims away studio gloss and lets ${detail} handle most of the emotional lift`,
    ]);
  }

  if (/world cafe/i.test(setting)) {
    return chooseVariant(seed, [
      `The World Cafe session gives ${detail} a warmer frame, with ${secondary} spreading through the room`,
      `In the World Cafe setting, ${detail} does the heavy lifting while ${secondary} keeps the take conversational`,
      `World Cafe leaves enough air around ${detail} for the live read to feel less fixed`,
    ]);
  }

  if (/audiotree/i.test(setting)) {
    return chooseVariant(seed, [
      `The Audiotree taping makes ${detail} feel more physical, with ${secondary} coming through in the gaps`,
      `On Audiotree, the session setup leans hard on ${detail}, which gives the live take a more tactile edge`,
      `Audiotree strips the performance back to ${detail} and ${secondary}, and that narrower frame helps`,
    ]);
  }

  if (/jimmy kimmel/i.test(setting) || /late show/i.test(setting) || /late night/i.test(setting) || /fallon/i.test(setting) || /colbert/i.test(setting)) {
    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} keeps the broadcast frame tight, leaving ${detail} to cut through the stage gloss`,
      `The TV-stage setup gives ${detail} a brighter edge, while ${secondary} keeps the take from turning slick`,
      `On ${stripLeadingArticle(setting)}, ${detail} holds the focus even with the brighter broadcast framing`,
    ]);
  }

  if (/brodie sessions/i.test(setting) || /parfait palace/i.test(setting)) {
    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} keeps the room small enough for ${detail} and ${secondary} to do the work`,
      `In ${stripLeadingArticle(setting)}, the closer frame makes ${detail} feel less fixed and more human-scale`,
      `${capitalizeFirst(setting)} cuts back the distance, which pushes ${detail} closer to the surface`,
    ]);
  }

  if (setting === "this live setting") {
    return chooseVariant(seed, [
      `The live take trades studio neatness for ${detail}, letting ${secondary} carry the remaining weight`,
      `A looser room frame brings ${detail} to the front and leaves the performance feeling less sealed off`,
      `Live playback strips things back to ${detail}, with ${secondary} doing most of the scene-setting`,
      `The room sound matters here because it puts ${detail} and ${secondary} ahead of polish`,
    ]);
  }

  return chooseVariant(seed, [
    `${capitalizeFirst(setting)} brings ${detail} closer to the front, while ${secondary} fills in the rest`,
    `${capitalizeFirst(setting)} trims the arrangement back to ${detail}, which gives the performance a different weight`,
    `${capitalizeFirst(setting)} leaves ${detail} and ${secondary} exposed enough to reshape the whole take`,
    `${capitalizeFirst(setting)} turns the room itself into part of the arrangement, especially around ${detail}`,
  ]);
}

function sanitizeSummary(value: string | undefined, input?: SummaryInput) {
  if (!value) {
    return null;
  }

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(/(?<=[.!?])\s+/)[0]
    ?.trim();

  if (!normalized || shouldRegenerateAiSummary(normalized)) {
    return null;
  }

  if (input && mentionsCardIdentity(normalized, input)) {
    return null;
  }

  return finalizeSummary(normalized);
}

function mentionsCardIdentity(value: string, input: SummaryInput) {
  const normalizedValue = normalizeIdentityText(value);
  const identityCandidates = [
    input.artistName,
    input.projectTitle,
    input.title,
  ]
    .map((candidate) => normalizeIdentityText(candidate || ""))
    .filter((candidate) => candidate.length >= 4);

  return identityCandidates.some((candidate) => normalizedValue.includes(candidate));
}

function normalizeIdentityText(value: string) {
  return decodeHtmlEntities(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTypeLabel(releaseType: ReleaseType) {
  if (releaseType === ReleaseType.ALBUM) {
    return "album";
  }
  if (releaseType === ReleaseType.EP) {
    return "EP";
  }
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "performance";
  }
  return "single";
}

function sanitizeGenreForSummary(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const decoded = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
  const normalized = decoded.toLowerCase();

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized === "https:" ||
    normalized === "http:" ||
    normalized.includes("schema.org") ||
    normalized.includes("schema.googleapis.com")
  ) {
    const pathGenre = extractGenreFromUrl(decoded);
    return pathGenre ? capitalizeWords(pathGenre.replace(/-/g, " ")) : null;
  }

  return decoded;
}

function resolveSubjectName(input: SummaryInput) {
  const artist = decodeHtmlEntities(input.artistName || "").trim();
  if (artist) {
    return artist;
  }

  const title = decodeHtmlEntities(input.projectTitle || input.title);
  const byMatch = title.match(/^(.*?)\s+\|\s+/);
  if (byMatch?.[1]) {
    return byMatch[1].trim();
  }

  const colonMatch = title.match(/^([^:]+):/);
  if (colonMatch?.[1]) {
    return colonMatch[1].trim();
  }

  return title.trim();
}

function resolveWorkTitle(input: SummaryInput) {
  const raw = decodeHtmlEntities(input.projectTitle || input.title).replace(/\s+/g, " ").trim();
  const cleaned = cleanWorkTitleForSummary(raw, input.releaseType);

  if (!input.artistName) {
    const pipeMatch = cleaned.match(/^[^|]+\|\s+(.+)$/);
    if (pipeMatch?.[1]) {
      return pipeMatch[1].trim();
    }

    const colonMatch = cleaned.match(/^[^:]+:\s+(.+)$/);
    if (colonMatch?.[1]) {
      return colonMatch[1].trim();
    }
  }

  return cleaned;
}

function cleanWorkTitleForSummary(value: string, releaseType: ReleaseType) {
  let cleaned = value
    .replace(/[\u201c\u201d"]/g, '"')
    .replace(/[\u2018\u2019']/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  cleaned = cleaned.replace(/\s+\((?:[^)]*live[^)]*|full interview|studio session).*?\)$/i, "").trim();
  cleaned = cleaned.replace(/\s+(feat\.?|featuring)\s+.+$/i, "").trim();

  if (releaseType === ReleaseType.SINGLE && cleaned.includes(" / ")) {
    cleaned = cleaned.split(" / ")[0]?.trim() || cleaned;
  }

  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    cleaned = cleaned.replace(/\s+live at\s+.+$/i, "").trim();
    cleaned = cleaned.replace(/\s+live w\/\s+.+$/i, "").trim();
    cleaned = cleaned.replace(/\s+live with\s+.+$/i, "").trim();
  }

  cleaned = cleaned.replace(/\s*[/-]\s*['"]?[^'"]+['"]?\s+out\s+[A-Za-z]+\s+\d{1,2}.*$/i, "").trim();
  cleaned = cleaned.replace(/\s*\|\s*[^|]+$/i, "").trim();

  return cleaned || value;
}

function normalizeContextText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b(read more|subscribe|newsletter|cookie policy|privacy policy|all rights reserved)\b/gi, " ")
    .trim();
}

function extractCue(context: string, cues: Array<[RegExp, string]>) {
  for (const [pattern, replacement] of cues) {
    if (pattern.test(context)) {
      return replacement;
    }
  }

  return null;
}

function extractTrackCount(context: string) {
  const matches = [...context.matchAll(/\b(\d{1,2})\.\s+/g)];
  if (matches.length === 0) {
    return null;
  }

  const numbers = matches
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value));

  const max = Math.max(...numbers);
  return max > 0 ? max : numbers.length;
}

function extractFeaturedArtist(value: string) {
  const match = value.match(/\b(?:feat\.?|featuring|w\/)\s+([^/()|]+?)(?=(?:\s+in\s+[A-Z]|\s+at\s+[A-Z]|\s*\/|\s*\(|\s*\||$))/i);
  return match?.[1]?.trim() || null;
}

function extractUpcomingProject(value: string) {
  const quotedMatch = value.match(/["'\u2018\u2019\u201c\u201d]([^"'\u2018\u2019\u201c\u201d]+)["'\u2018\u2019\u201c\u201d]\s+out\s+([A-Za-z]+\s+\d{1,2})/i);
  if (quotedMatch?.[1]) {
    return `${quotedMatch[1].trim()} before its ${quotedMatch[2].trim()} release`;
  }

  const slashMatch = value.match(/[\/-]\s*([^/()]+?)\s+out\s+([A-Za-z]+\s+\d{1,2})/i);
  if (slashMatch?.[1]) {
    return `${slashMatch[1].replace(/["'\u2018\u2019\u201c\u201d]/g, "").trim()} before its ${slashMatch[2].trim()} release`;
  }

  return null;
}

function inferUpcomingProjectFrame(...values: string[]) {
  const haystack = values.join(" ").toLowerCase();
  if (/\b(lp|album|full-length|full length)\b/.test(haystack)) {
    return "the coming full-length";
  }
  if (/\bep\b/.test(haystack)) {
    return "the coming EP";
  }
  if (/\bmixtape\b/.test(haystack)) {
    return "the coming mixtape";
  }
  return "the next project";
}

function extractPerformanceSetting(value: string) {
  const liveAtMatch = value.match(/\bLive at\s+([^/()|]+?)(?=$|[.)|])/i);
  if (liveAtMatch?.[1]) {
    return `a live stop at ${liveAtMatch[1].trim()}`;
  }

  if (/jimmy kimmel/i.test(value)) {
    return "a Jimmy Kimmel Live set";
  }
  if (/colbert|late show/i.test(value)) {
    return "a Late Show set";
  }
  if (/fallon|tonight show/i.test(value)) {
    return "a Tonight Show set";
  }
  if (/seth meyers|late night/i.test(value)) {
    return "a Late Night set";
  }
  if (/cbs saturday morning/i.test(value)) {
    return "a CBS Saturday Morning performance";
  }
  if (/tiny desk/i.test(value)) {
    return "a Tiny Desk setting";
  }
  if (/world cafe/i.test(value)) {
    return "a World Cafe session";
  }
  if (/kexp/i.test(value)) {
    return "a KEXP session";
  }
  if (/audiotree/i.test(value)) {
    return "an Audiotree session";
  }
  if (/brodie sessions/i.test(value)) {
    return "a Brodie Sessions taping";
  }
  if (/parfait palace/i.test(value)) {
    return "a Parfait Palace session";
  }
  if (/studio session/i.test(value)) {
    return "a studio session";
  }

  return null;
}

function extractReferencedWork(context: string, workTitle: string) {
  const matches = [...context.matchAll(/["'\u2018\u2019\u201c\u201d]([^"'\u2018\u2019\u201c\u201d]{2,80})["'\u2018\u2019\u201c\u201d]/g)];
  const stopWords = new Set(["and", "the", "of", "to", "a", "an", "in", "on", "at", "for"]);

  for (const match of matches) {
    const value = match[1]?.trim();
    if (!value) {
      continue;
    }

    const normalized = value.toLowerCase();
    const words = value.split(/\s+/).filter(Boolean);
    const titleLikeWords = words.filter((word) => {
      const cleaned = word.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (!cleaned) {
        return false;
      }

      if (stopWords.has(cleaned.toLowerCase())) {
        return true;
      }

      return /^[A-Z0-9]/.test(cleaned);
    });

    if (
      normalized === workTitle.toLowerCase() ||
      normalized.includes("released") ||
      normalized.includes("interview") ||
      words.length > 5 ||
      !/[A-Z]/.test(value) ||
      /^(ve|ll|re|d|s)$/i.test(value) ||
      titleLikeWords.length < words.length
    ) {
      continue;
    }

    return value;
  }

  return null;
}

function extractOriginalYear(context: string) {
  const match = context.match(/\b(?:originally came out|came out|released)\s+in\s+(\d{4})\b/i);
  return match?.[1] || null;
}

function extractDescriptiveClause(context: string) {
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string | null]> = [
    [/\brips\s+["']([^"']+)["']/i, (match) => `borrows a little of ${match[1]}`],
    [/\breimagines?\s+the original recordings\b/i, () => "reimagines the original material"],
    [/\bslowing things down even further\b/i, () => "slows the material down even further"],
    [/\bcontemporary electronics\b/i, () => "threads contemporary electronics through the arrangement"],
    [/\bfeatured\s+([A-Z][^.;]+?)\s+on vocals\b/, (match) => `brings ${match[1].trim()} into the vocal picture`],
    [/\bdouble a-side\b|\bdouble a side\b/i, () => "leans into a double-A-side framing"],
    [/\bfull interview\b/i, () => "pairs the performance with an interview frame"],
    [/\bdebut release\b/i, () => "revisits debut-era material"],
    [/\bcollaboration between\b/i, () => "leans into its collaborative origin"],
  ];

  for (const [pattern, resolver] of patterns) {
    const match = context.match(pattern);
    if (match) {
      return resolver(match);
    }
  }

  return null;
}

function inferArrangementFromGenre(genreName: string | null | undefined, releaseType: ReleaseType) {
  const genre = (sanitizeGenreForSummary(genreName) || "").toLowerCase();

  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "live arrangement details";
  }
  if (genre.includes("dream") || genre.includes("shoegaze")) {
    return "hazy layers";
  }
  if (genre.includes("folk") || genre.includes("americana")) {
    return "acoustic texture";
  }
  if (genre.includes("electronic") || genre.includes("synth")) {
    return "electronic detail";
  }
  if (genre.includes("punk")) {
    return "ragged momentum";
  }
  if (genre.includes("hip-hop") || genre.includes("rap")) {
    return "rhythmic focus";
  }
  if (genre.includes("metal") || genre.includes("drone")) {
    return "heavier low-end pressure";
  }

  return null;
}

function inferMoodFromTitle(title: string) {
  const normalized = title.toLowerCase();

  if (/\?$/.test(normalized) || normalized.includes("wtf")) {
    return "unsettled";
  }
  if (normalized.includes("stars") || normalized.includes("springs")) {
    return "open-ended";
  }
  if (normalized.includes("snow") || normalized.includes("winter")) {
    return "cold-weather hush";
  }
  if (normalized.includes("ballerina")) {
    return "light-footed";
  }
  if (normalized.includes("murder") || normalized.includes("insane")) {
    return "darker";
  }

  return null;
}

function inferThemeFromTitle(title: string, context: string) {
  const normalized = `${title} ${context}`.toLowerCase();

  if (normalized.includes("live") || normalized.includes("session")) {
    return "a close-mic feel";
  }
  if (normalized.includes("cover")) {
    return "a re-framing instinct";
  }
  if (normalized.includes("tour tape")) {
    return "a road-worn looseness";
  }
  if (normalized.includes("pink moon")) {
    return "a restless folk pull";
  }

  return null;
}

function normalizeGenrePhrase(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .replace(/\s*\/\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildStyleFrame(genrePhrase: string | null, moodCue: string | null) {
  const base = genrePhrase || moodCue || null;
  if (!base) {
    return null;
  }

  return `${base.replace(/\s+and\s+/g, "-and-").replace(/\s+/g, "-")} direction`;
}

function buildThemeFrame(themeCue: string | null, moodCue: string | null) {
  const base = themeCue || moodCue || null;
  if (!base) {
    return null;
  }

  if (base.endsWith("lyrics")) {
    return base.replace(/lyrics$/, "angle").trim();
  }

  if (base.endsWith("statement") || base.endsWith("feel") || base.endsWith("pull")) {
    return base;
  }

  return `${base} angle`;
}

function extractGenreFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    return null;
  }
}

function chooseVariant(seed: number, variants: string[]) {
  return variants[Math.abs(seed) % variants.length];
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return hash;
}

function aOrAn(value: string) {
  const first = value.trim()[0]?.toLowerCase();
  return first && "aeiou".includes(first) ? "an" : "a";
}

function withArticle(value: string) {
  return `${aOrAn(value)} ${value}`;
}

function capitalizeFirst(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function capitalizeWords(value: string) {
  return value.replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function stripLeadingArticle(value: string) {
  return value.replace(/^(a|an|the)\s+/i, "");
}

function finalizeSummary(value: string) {
  const cleaned = decodeHtmlEntities(value)
    .replace(/\s+/g, " ")
    .replace(/\s([,.;!?])/g, "$1")
    .trim()
    .replace(/^["']|["']$/g, "");

  const words = cleaned.split(" ").filter(Boolean);
  const limited = words.slice(0, 28).join(" ");
  const sentence = limited.replace(/[.!?]+$/, "");
  const normalizedStart = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  return `${normalizedStart}.`;
}
