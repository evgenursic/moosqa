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
            "Avoid stock phrasing such as lands with, arrives with, immediate, easy to place on a first listen, opening moments, or clean entry point.",
            "Prefer concrete details from the source text: collaborators, venue, cover/reissue angle, track count, label, outlet, or release framing.",
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

    return sanitizeSummary(response.output_text) || buildFallbackSummary(input);
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

  if (facts.upcomingProject && facts.guestArtist) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} pairs ${facts.subject} with ${facts.guestArtist}, giving the single a direct path into ${facts.upcomingProject}`,
        `${facts.guestArtist} enters ${facts.workTitle}, turning it into the clearest preview yet of ${facts.upcomingProject}`,
        `${facts.workTitle} uses ${facts.guestArtist} as the hinge into ${facts.upcomingProject}, rather than treating the collaboration like decoration`,
      ]),
    );
  }

  if (facts.upcomingProject) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} acts as the first proper look at ${facts.upcomingProject}, with ${facts.detailCue || facts.genrePhrase || "the arrangement"} carrying most of the momentum`,
        `${facts.upcomingProject} sits just ahead of ${facts.workTitle}, which frames ${facts.subject} through ${withArticle(facts.detailCue || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "sharper detail")}`,
        `${facts.workTitle} sets up ${facts.upcomingProject} without overstating it, leaning instead on ${facts.detailCue || facts.themeCue || "the song's central idea"}`,
      ]),
    );
  }

  if (facts.isCoverSet) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} makes the cover angle explicit, giving ${facts.subject} room to reshape familiar material through ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.detailCue || "more personal lens")}`,
        `${facts.workTitle} treats the source material like something to reframe, not just replay, with ${facts.detailCue || facts.themeCue || "its own character"} doing the heavy lifting`,
        `${facts.workTitle} lands as a covers-minded turn for ${facts.subject}, with ${facts.guestArtist ? `${facts.guestArtist} helping tilt the mood` : `${facts.detailCue || "the arrangement"} setting the tone`}`,
      ]),
    );
  }

  if (facts.isReimagining) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} reworks the material through ${facts.detailCue || withArticle(facts.genrePhrase || "more radical frame")}, giving ${facts.subject} something more than a straight revisit`,
        `${facts.workTitle} treats the source like a reimagining project, pulling ${facts.detailCue || facts.themeCue || "new tension"} out of familiar ground`,
        `${facts.originalYear ? `${facts.workTitle} revisits material first issued in ${facts.originalYear}` : facts.workTitle} and pushes it through ${facts.detailCue || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "a different frame"}`,
      ]),
    );
  }

  if (facts.isReissue) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} comes back with an archival pull, keeping ${facts.subject} tied to ${withArticle(facts.genrePhrase || facts.themeCue || "sharper historical frame")}`,
        `${facts.workTitle} comes back with an archival pull, keeping ${facts.subject} tied to ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "sharper historical frame")}`,
        `${facts.workTitle} reads like more than a simple reissue, especially with ${facts.detailCue || facts.themeCue || "the original atmosphere"} still intact`,
        `${facts.workTitle} returns with its archival angle upfront, leaving ${facts.subject} in ${withArticle(facts.genrePhrase || "well-worn but vivid")} lane`,
      ]),
    );
  }

  if (
    (input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP) &&
    facts.trackCount
  ) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} arrives as ${aOrAn(`${facts.trackCount}-track`)} ${facts.trackCount}-track ${getTypeLabel(input.releaseType)} from ${facts.subject}, built around ${facts.detailCue || facts.genrePhrase || "a clear sonic identity"}`,
        `${facts.trackCount} tracks in, ${facts.workTitle} already sketches ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "clear silhouette")} for ${facts.subject}`,
        `${facts.workTitle} spreads ${facts.subject} across ${facts.trackCount} tracks, with ${facts.detailCue || facts.themeCue || "the strongest details"} carrying the release`,
      ]),
    );
  }

  if (facts.referenceWork) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} nods to ${facts.referenceWork}, but ${facts.subject} turns that reference toward ${withArticle(buildThemeFrame(facts.themeCue, facts.moodCue) || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "more personal angle")}`,
        `${facts.referenceWork} sits somewhere behind ${facts.workTitle}, but ${facts.subject} uses it more as a springboard than a template`,
        `${facts.workTitle} borrows the outline of ${facts.referenceWork} and pushes ${facts.subject} toward ${withArticle(buildThemeFrame(facts.themeCue, facts.moodCue) || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "different texture")}`,
      ]),
    );
  }

  if (facts.descriptiveClause) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} ${facts.descriptiveClause}, which gives ${facts.subject} a more specific shape than the title alone suggests`,
        `${facts.descriptiveClause} becomes the key to ${facts.workTitle}, keeping ${facts.subject} anchored in ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "distinct lane")}`,
        `${facts.workTitle} stands out because it ${facts.descriptiveClause}, not because it follows the usual rollout script`,
      ]),
    );
  }

  if (input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP) {
    return finalizeSummary(
      chooseVariant(seed, [
        `${facts.workTitle} gives ${facts.subject} ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || "broader frame")} for this ${getTypeLabel(input.releaseType)}, with ${facts.detailCue || buildThemeFrame(facts.themeCue, facts.moodCue) || "the sequencing"} doing the real work`,
        `${facts.workTitle} feels less like background catalog and more like a defined ${getTypeLabel(input.releaseType)} statement from ${facts.subject}, especially around ${facts.detailCue || facts.genrePhrase || "the sonic palette"}`,
        `${facts.workTitle} keeps ${facts.subject} centered on ${facts.detailCue || facts.themeCue || facts.genrePhrase || "its strongest ideas"}, rather than just filling out the runtime`,
      ]),
    );
  }

  return finalizeSummary(
    chooseVariant(seed, [
      `${facts.workTitle} gives ${facts.subject} ${withArticle(buildThemeFrame(facts.themeCue, facts.moodCue) || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "cleaner angle")}, with ${facts.detailCue || "the main idea"} pushed close to the front`,
      `${facts.workTitle} keeps ${facts.subject} moving through ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.moodCue || "more deliberate mood")}, while ${facts.detailCue || "the arrangement"} handles the shape`,
      `${facts.workTitle} leans on ${facts.detailCue || "a clear melodic center"}, which gives ${facts.subject} a more defined outline`,
      `${facts.workTitle} reads as ${withArticle(buildThemeFrame(facts.themeCue, facts.moodCue) || facts.moodCue || buildStyleFrame(facts.genrePhrase, facts.moodCue) || "more purposeful move")} for ${facts.subject}, especially through ${facts.detailCue || "the arrangement"}`,
      `${facts.workTitle} gives ${facts.subject} a sharper route into ${withArticle(buildStyleFrame(facts.genrePhrase, facts.moodCue) || facts.themeCue || "its own lane")}, with ${facts.detailCue || "the pacing"} setting the contour`,
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

  if (facts.guestArtist) {
    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} gives ${facts.subject} and ${facts.guestArtist} enough space for ${facts.detailCue || "the interplay"} to come forward`,
      `${capitalizeFirst(setting)} keeps ${facts.subject} close to the mic while ${facts.guestArtist} changes the balance around the arrangement`,
      `${capitalizeFirst(setting)} sharpens the exchange between ${facts.subject} and ${facts.guestArtist}, especially through ${facts.detailCue || "the exposed setup"}`,
    ]);
  }

  if (liveStopMatch?.[1]) {
    return chooseVariant(seed, [
      `At ${liveStopMatch[1]}, ${facts.subject} lets ${facts.detailCue || "the room sound"} do more of the storytelling`,
      `At ${liveStopMatch[1]}, ${facts.subject} gets a tighter frame, which pushes ${facts.detailCue || "small arrangement details"} forward`,
      `At ${liveStopMatch[1]}, ${facts.subject} comes through with more space around ${facts.detailCue || "the live setup"}`,
    ]);
  }

  if (/tiny desk/i.test(setting)) {
    return chooseVariant(seed, [
      `The Tiny Desk setup leaves ${facts.subject} exposed in the right way, with ${facts.detailCue || "ensemble detail"} rising to the surface`,
      `In the Tiny Desk room, ${facts.subject} sounds more tactile, especially once ${facts.detailCue || "the arrangement"} takes over`,
      `The Tiny Desk framing brings ${facts.subject} close enough for ${facts.detailCue || "small ensemble moves"} to register clearly`,
    ]);
  }

  return chooseVariant(seed, [
    `${capitalizeFirst(setting)} brings ${facts.subject} into closer view, with ${facts.detailCue || facts.themeCue || "the arrangement"} doing more of the storytelling`,
    `${capitalizeFirst(setting)} strips ${facts.subject} back to ${facts.detailCue || facts.themeCue || "the essentials"}, which gives the performance a different weight`,
    `${capitalizeFirst(setting)} leaves ${facts.subject} with nowhere to hide, pushing ${facts.detailCue || facts.themeCue || "the room sound"} to the front`,
    `${capitalizeFirst(setting)} gives ${facts.subject} a tighter frame, letting ${facts.detailCue || facts.themeCue || "small details"} reshape the performance`,
  ]);
}

function sanitizeSummary(value: string | undefined) {
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

  return finalizeSummary(normalized);
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

  cleaned = cleaned.replace(/\s+\((live|full interview|studio session).*?\)$/i, "").trim();
  cleaned = cleaned.replace(/\s+(feat\.?|featuring)\s+.+$/i, "").trim();

  if (releaseType === ReleaseType.SINGLE && cleaned.includes(" / ")) {
    cleaned = cleaned.split(" / ")[0]?.trim() || cleaned;
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
  const match = value.match(/\b(?:feat\.?|featuring|w\/)\s+([^/()|]+?)(?=(?:\s*\/|\s*\(|\s*\||$))/i);
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

function extractPerformanceSetting(value: string) {
  const liveAtMatch = value.match(/\bLive at\s+([^/()|]+?)(?=$|[.)|])/i);
  if (liveAtMatch?.[1]) {
    return `a live stop at ${liveAtMatch[1].trim()}`;
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
