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
  "the single leans on",
  "this album leans into",
  "this ep sketches",
  "the live take keeps",
  "the cover angle matters less than",
  "instead of replaying the source",
  "the reworking leans on",
  "the return feels vivid rather than dutiful",
  "the set feels defined by",
  "most of the weight lands in",
  "the strongest impression comes from",
  "rather than chasing scale",
  "this preview points toward",
  "the coming release is framed through",
  "a guest feature turns this preview",
  "the collaboration feels structural",
  "across ",
  "the archival pull stays intact",
  "the world cafe session gives",
  "the tv-stage setup gives",
  "the room sound matters here",
  "the tiny desk setup leaves",
  "in the tiny desk room",
  "the tiny desk framing",
  "an audiotree session strips",
  "a world cafe session",
  "a studio session",
  "across the release",
  "stays consistent",
  "keeps that consistency from becoming blur",
  "the live setup puts",
  "the appeal here is how",
  "keeps the release taut enough",
  "gives the album a steady center of gravity",
  "gives the ep a steady center of gravity",
  "gives the set a steady center of gravity",
  "gives the release its backbone",
  "gives the whole set a stable center",
  "stops the return from feeling ceremonial",
  "stops that consistency from turning generic",
  "keeps the set purposeful",
  "the performance gains most from how",
  "what sticks is the tension between",
  "with the sequencing making",
  "the arrangement registers as",
  "trades polish for proximity",
  "recasts the song through proximity",
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
  const subject = resolveSubjectName(input);
  const workTitle = resolveWorkTitle(input);
  const context = normalizeContextText(
    [input.sourceTitle, input.sourceExcerpt].filter(Boolean).join(". "),
  );
  const titleCueSource = normalizeContextText(
    [input.title, input.sourceTitle].filter(Boolean).join(". "),
  );
  const facts = extractFacts(input, subject, workTitle, context, titleCueSource);

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
            "Use exactly one sentence and keep it under 30 words.",
            "Do not mention Reddit.",
            "Do not repeat the main artist name, billing, or release title already visible on the card.",
            "Avoid stock phrasing such as lands with, arrives with, immediate, the single leans on, built around, forward through, easy to place on a first listen, opening moments, or clean entry point.",
            "Anchor the sentence in the most concrete fact available: venue, live framing, instrumentation, release context, cover/reissue angle, track count, label, or lyrical tension.",
            "If the context is thin, write a vivid but precise editorial description instead of a generic template.",
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
                `Specific cues: ${[
                  facts.descriptiveClause ? `detail=${facts.descriptiveClause}` : null,
                  facts.performanceSetting ? `setting=${facts.performanceSetting}` : null,
                  facts.detailCue ? `sonic=${facts.detailCue}` : null,
                  facts.themeCue ? `theme=${facts.themeCue}` : null,
                  facts.upcomingProject ? `project=${facts.upcomingProject}` : null,
                  facts.referenceWork ? `reference=${facts.referenceWork}` : null,
                  facts.trackCount ? `tracks=${facts.trackCount}` : null,
                  facts.originalYear ? `year=${facts.originalYear}` : null,
                ]
                  .filter(Boolean)
                  .join("; ") || "None"}`,
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
    return finalizeSummary(buildPerformanceFallback(facts, seed));
  }

  if (input.releaseType === ReleaseType.ALBUM || input.releaseType === ReleaseType.EP) {
    return finalizeSummary(buildCollectionFallback(facts, input, context, titleCueSource, seed));
  }

  return finalizeSummary(buildSingleFallback(facts, context, titleCueSource, seed));
}

function buildSingleFallback(
  facts: SummaryFacts,
  context: string,
  titleCueSource: string,
  seed: number,
) {
  const sonic = facts.detailCue || "the arrangement";
  const color = facts.descriptiveClause || buildColorHook(facts);

  if (facts.isCoverSet || facts.isReimagining || facts.isReissue) {
    return chooseVariant(seed, [
      `${color || "The reworking shifts the song's center of gravity"}, and ${sonic} keeps it feeling newly inhabited rather than preserved`,
      `${facts.referenceWork ? `The outline of ${facts.referenceWork} still hovers in the background` : "The original outline still hovers in the background"}, but ${sonic} bends the new version toward ${buildAtmosphereHook(facts)}`,
      `${facts.originalYear ? `Its ${facts.originalYear} lineage still peeks through` : "Its earlier lineage still peeks through"}, though ${sonic} turns the revisit into something more lived-in than reverent`,
    ]);
  }

  if (facts.upcomingProject && facts.guestArtist) {
    return chooseVariant(seed, [
      `${color || "The guest spot changes the architecture of the song"}, with ${sonic} framing a more revealing first look at ${inferUpcomingProjectFrame(context, titleCueSource)}`,
      `${facts.guestArtist} lands as part of the arrangement rather than decoration, and ${sonic} gives ${inferUpcomingProjectFrame(context, titleCueSource)} a more distinctive silhouette`,
      `${sonic} turns the collaboration into a real structural shift, while ${inferUpcomingProjectFrame(context, titleCueSource)} stays visible behind it`,
    ]);
  }

  if (facts.upcomingProject) {
    return chooseVariant(seed, [
      `${color || "This preview does more than announce the rollout"}, with ${sonic} sketching a sharper picture of ${inferUpcomingProjectFrame(context, titleCueSource)}`,
      `${sonic} makes the song feel like a real clue to ${inferUpcomingProjectFrame(context, titleCueSource)} instead of a routine advance single`,
      `${buildAtmosphereHook(facts)} sits on the surface, but ${sonic} is what makes the coming project feel specific rather than merely promised`,
    ]);
  }

  if (facts.descriptiveClause) {
    return chooseVariant(seed, [
      `The telling move is that it ${facts.descriptiveClause}, with ${sonic} making that decision feel central instead of cosmetic`,
      `${color}, and ${sonic} is what keeps the song from slipping into sketchbook territory`,
      `${sonic} gives the track its frame, but the real pull is how it ${facts.descriptiveClause}`,
    ]);
  }

  if (facts.guestArtist) {
    return chooseVariant(seed, [
      `${facts.guestArtist} changes the temperature of the track, and ${sonic} makes that contrast stick`,
      `The collaboration shows up in the shape of the arrangement as much as the billing, with ${sonic} doing the connecting work`,
      `${sonic} keeps the guest turn from feeling ornamental and nudges the song toward ${buildAtmosphereHook(facts)}`,
    ]);
  }

  return chooseVariant(seed, [
    `${sonic} keeps the emotional center close to the mic, so ${buildAtmosphereHook(facts)} reads as a choice rather than background color`,
    `${buildAtmosphereHook(facts)} lingers on the surface, but ${sonic} is what gives the track a memorable silhouette`,
    `The strongest detail is how ${sonic} rubs against ${buildThemeHook(facts)}, leaving the song with more edge than softness`,
    `${sonic} carries the tension while ${buildThemeHook(facts)} keeps leaking through the seams`,
  ]);
}

function buildCollectionFallback(
  facts: SummaryFacts,
  input: SummaryInput,
  context: string,
  titleCueSource: string,
  seed: number,
) {
  const typeLabel = getTypeLabel(input.releaseType);
  const runtimeHook = facts.trackCount ? `${facts.trackCount} tracks` : `this ${typeLabel}`;
  const sonic = facts.detailCue || "the sequencing";
  const color = facts.descriptiveClause || buildColorHook(facts);

  if (facts.isReissue || facts.isReimagining) {
    return chooseVariant(seed, [
      `${color || "The archival angle is only half the story"}, because ${sonic} keeps the set animated instead of museum-lit`,
      `${facts.originalYear ? `Its ${facts.originalYear} origin still shows` : "Its earlier origin still shows"}, but ${sonic} keeps the return from feeling ceremonial`,
      `${runtimeHook} carry a strong sense of return, though ${sonic} keeps the material vivid enough to feel current`,
    ]);
  }

  if (facts.trackCount && facts.descriptiveClause) {
    return chooseVariant(seed, [
      `${runtimeHook} are used to ${facts.descriptiveClause}, with ${sonic} making the through-line easy to follow`,
      `${color}, and ${runtimeHook} give that idea room to echo across the sequence without losing momentum`,
      `${sonic} keeps ${runtimeHook} coherent, especially once the set starts to ${facts.descriptiveClause}`,
    ]);
  }

  if (facts.trackCount) {
    return chooseVariant(seed, [
      `${runtimeHook} keep returning to ${buildThemeHook(facts)}, but ${sonic} keeps changing the scale of that idea from piece to piece`,
      `${sonic} threads through ${runtimeHook}, which is why the set feels paced rather than simply complete`,
      `${runtimeHook} sketch a durable ${buildAtmosphereHook(facts)} world, and ${sonic} gives each pass enough contrast to matter`,
    ]);
  }

  if (facts.descriptiveClause) {
    return chooseVariant(seed, [
      `${color}, with ${sonic} making the release feel shaped rather than loosely gathered`,
      `${sonic} does the quiet work of coherence here, which matters because it ${facts.descriptiveClause}`,
      `${buildAtmosphereHook(facts)} runs through the set, but the defining move is still how it ${facts.descriptiveClause}`,
    ]);
  }

  return chooseVariant(seed, [
    `${sonic} keeps the ${typeLabel} grounded, while ${buildThemeHook(facts)} keeps the mood from settling into one color`,
    `${buildAtmosphereHook(facts)} colors the whole set, but ${sonic} keeps redrawing the edges so it never turns into one wash`,
    `${sonic} and ${buildThemeHook(facts)} give the set enough movement to feel curated rather than boxed into one blunt mood`,
  ]);
}

function buildPerformanceFallback(facts: SummaryFacts, seed: number) {
  const setting = facts.performanceSetting || resolveFallbackPerformanceSetting(seed);
  const sonic = facts.detailCue || "room sound";
  const color = facts.descriptiveClause || buildColorHook(facts);
  const atmosphere = buildAtmosphereHook(facts);
  const normalizedSetting = stripLeadingArticle(setting);

  if (facts.descriptiveClause) {
    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} lets the set ${facts.descriptiveClause}, with ${sonic} making the shift easy to hear`,
      `In ${normalizedSetting}, ${color} and ${sonic} land without much distance between them`,
      `${capitalizeFirst(setting)} trims away enough polish for ${sonic} and ${facts.descriptiveClause} to reshape the performance`,
    ]);
  }

  if (/tiny desk/i.test(setting) || /world cafe/i.test(setting) || /audiotree/i.test(setting)) {
    return chooseVariant(seed, [
      `${capitalizeFirst(setting)} pulls ${sonic} close enough that ${atmosphere} stops feeling abstract`,
      `In ${normalizedSetting}, ${sonic} carries the take and leaves ${buildThemeHook(facts)} plainly exposed`,
      `${capitalizeFirst(setting)} gives the arrangement just enough room sound for ${buildThemeHook(facts)} to register at a different scale`,
    ]);
  }

  return chooseVariant(seed, [
    `${capitalizeFirst(setting)} recasts the song through proximity, with ${sonic} doing more dramatic work than any extra volume`,
    `In ${normalizedSetting}, ${sonic} becomes part of the drama while ${buildThemeHook(facts)} settles into sharper relief`,
    `${capitalizeFirst(setting)} leaves enough air around the performance for ${sonic} to roughen the edges of ${atmosphere}`,
  ]);
}

function resolveFallbackPerformanceSetting(seed: number) {
  return chooseVariant(seed, [
    "the live setup",
    "the room take",
    "this close-range setup",
    "the onstage frame",
  ]);
}

function buildColorHook(facts: SummaryFacts) {
  if (facts.descriptiveClause) {
    return `it ${facts.descriptiveClause}`;
  }

  if (facts.referenceWork) {
    return `${facts.referenceWork} stays in the background as a reference point`;
  }

  if (facts.trackCount) {
    return `${facts.trackCount} tracks keep narrowing in on ${buildThemeHook(facts)}`;
  }

  return null;
}

function buildThemeHook(facts: SummaryFacts) {
  return facts.themeCue || facts.moodCue || facts.genrePhrase || "its central tension";
}

function buildAtmosphereHook(facts: SummaryFacts) {
  return buildThemeFrame(facts.themeCue, facts.moodCue) || facts.genrePhrase || "the mood";
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

function normalizeProjectType(value: string) {
  const normalized = value.toLowerCase();

  if (normalized === "lp" || normalized === "full-length") {
    return "full-length";
  }

  return normalized;
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
    [/\bfirst taste from (?:their|the|an?)\s+(?:upcoming|forthcoming|new|debut|next)\s+(album|lp|full-length|ep)\b/i, (match) => `acts as the first clear signal of a coming ${normalizeProjectType(match[1])}`],
    [/\bfrom (?:their|the|an?)\s+(?:upcoming|forthcoming|new|debut|next)\s+(album|lp|full-length|ep)\b/i, (match) => `points toward a coming ${normalizeProjectType(match[1])}`],
    [/\bfrom (?:a|the)\s+compilation album\b/i, () => "arrives tied to a larger compilation frame"],
    [/\bunheard tracks?\b/i, () => "opens the vault on previously unheard material"],
    [/\bdebut vinyl pressing\b/i, () => "ties a debut vinyl pressing to earlier material"],
    [/\bpairs with (?:their|the) first ep\b/i, () => "connects the release to an earlier EP"],
    [/\brecorded during sessions for (?:their|the)\s+[^.]+?\s+album\b/i, () => "spills out of a broader album-session run"],
    [/\blive from\s+([^.;]+)\b/i, (match) => `brings the performance in from ${match[1].trim()}`],
    [/\bfull-band arrangement\b/i, () => "shifts the material into a fuller band arrangement"],
    [/\bsolo version\b/i, () => "pulls the song into a more solitary frame"],
    [/\bdouble album\b/i, () => "unfolds with a larger double-album scale"],
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

  if (genre.includes("dream") || genre.includes("shoegaze")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "guitar haze in the room"
      : "hazy layers";
  }
  if (genre.includes("folk") || genre.includes("americana")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "close-mic acoustic grain"
      : "acoustic texture";
  }
  if (genre.includes("electronic") || genre.includes("synth")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "synth pulse in the room"
      : "electronic detail";
  }
  if (genre.includes("punk")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "snare-and-guitar friction"
      : "ragged momentum";
  }
  if (genre.includes("hip-hop") || genre.includes("rap")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "beat-and-vocal attack"
      : "rhythmic focus";
  }
  if (genre.includes("jazz")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "ensemble interplay"
      : "ensemble interplay";
  }
  if (genre.includes("metal") || genre.includes("drone")) {
    return releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION
      ? "amplifier weight"
      : "heavier low-end pressure";
  }
  if (releaseType === ReleaseType.PERFORMANCE || releaseType === ReleaseType.LIVE_SESSION) {
    return "room sound and band interplay";
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
    if (normalized.includes("tiny desk")) {
      return "a stripped-room intimacy";
    }
    if (normalized.includes("world cafe") || normalized.includes("kexp") || normalized.includes("audiotree")) {
      return "a broadcast-room immediacy";
    }
    if (normalized.includes("jimmy kimmel") || normalized.includes("fallon") || normalized.includes("colbert")) {
      return "TV-stage tension";
    }
    return "a more exposed live feel";
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
