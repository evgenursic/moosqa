import { shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { decodeHtmlEntities } from "@/lib/utils";

type SummaryQualityInput = {
  summary: string | null | undefined;
  artistName?: string | null | undefined;
  projectTitle?: string | null | undefined;
  title?: string | null | undefined;
};

type SummaryAuditRow = {
  id: string;
  slug: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  aiSummary: string | null;
  publishedAt: Date;
};

export type SummaryAuditResult = {
  lowQuality: number;
  repetitive: number;
  repeatedPatterns: Array<{
    patternLabel: string;
    count: number;
    examples: string[];
  }>;
  flaggedCards: Array<{
    id: string;
    slug: string;
    title: string;
    artistName: string | null;
    projectTitle: string | null;
    aiSummary: string | null;
    summaryQualityScore: number;
    patternLabel: string | null;
    publishedAt: Date;
  }>;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "here",
  "in",
  "into",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "their",
  "this",
  "through",
  "to",
  "with",
]);

const GENERIC_OPENINGS = [
  "the release",
  "the track",
  "the song",
  "the single",
  "the album",
  "the ep",
  "this release",
  "this track",
  "this song",
  "this single",
  "this album",
  "this ep",
  "what sticks",
  "what carries",
  "one telling move",
];

const ABSTRACT_TEMPLATE_PATTERNS = [
  /\b(?:center of gravity|stable center|steady center)\b/,
  /\b(?:background color|one color|one wash|museum lit|ceremonial)\b/,
  /\b(?:memorable silhouette|distinctive silhouette|different scale|clear contour|internal shape)\b/,
  /\b(?:through the seams|surface|the edges|enough contrast to matter)\b/,
  /\b(?:does the quiet work|the strongest detail|the telling move|what sticks is)\b/,
  /\b(?:rather than background color|rather than merely promised|rather than preserved)\b/,
  /\b(?:keeps? (?:the )?(?:song|single|track|release|album|ep|set|mood|material) from)\b/,
  /\b(?:gives? (?:the )?(?:song|single|track|release|album|ep|set|arrangement) (?:a|its|enough))\b/,
];

const SUMMARY_SCAFFOLD_PATTERNS: Array<[RegExp, string]> = [
  [/\b(acoustic texture|electronic detail|live arrangement details|guitar texture|piano led phrasing|stacked harmonies|percussive drive|drone weight|a sharp hook|distorted weight|hazy layers|ragged momentum|room sound)\b/g, "<detail>"],
  [/\b(the release|the track|the song|the single|the album|the ep|the set|this release|this track|this song|this single|this album|this ep|this set|release|track|song|single|album|ep|set)\b/g, "<format>"],
  [/\b(the live setup|a tiny desk setting|a world cafe session|a kexp session|an audiotree session|a studio session|a late show set|a jimmy kimmel live set|a cbs saturday morning performance)\b/g, "<performance>"],
  [/\b((?:steady|stable)\s+center\s+of\s+gravity|center of gravity|stable center|steady center|internal shape|memorable silhouette|different scale|structural shift|clear contour|sharp picture)\b/g, "<shape>"],
  [/\b(background color|surface|the seams|one color|museum lit|ceremonial|proximity)\b/g, "<texture>"],
];

export function scoreSummaryQuality(input: SummaryQualityInput) {
  const normalizedSummary = normalizeSummaryText(input.summary);
  if (!normalizedSummary) {
    return 0;
  }

  let score = 100;
  const words = normalizedSummary.split(" ").filter(Boolean);
  const significantWords = words.filter((word) => !STOP_WORDS.has(word));
  const uniqueWords = new Set(significantWords);
  const lexicalDiversity =
    significantWords.length > 0 ? uniqueWords.size / significantWords.length : 0;

  if (shouldRegenerateAiSummary(normalizedSummary)) {
    score -= 42;
  }

  if (mentionsReleaseIdentity(normalizedSummary, input)) {
    score -= 22;
  }

  if (words.length < 10) {
    score -= 18;
  } else if (words.length > 30) {
    score -= 12;
  }

  if (lexicalDiversity < 0.62) {
    score -= 14;
  } else if (lexicalDiversity < 0.72) {
    score -= 8;
  }

  const opener = words.slice(0, 3).join(" ");
  if (GENERIC_OPENINGS.some((pattern) => opener.startsWith(pattern))) {
    score -= 10;
  }

  const abstractTemplateHits = ABSTRACT_TEMPLATE_PATTERNS.filter((pattern) =>
    pattern.test(normalizedSummary),
  ).length;
  if (abstractTemplateHits >= 2) {
    score -= 22;
  } else if (abstractTemplateHits === 1) {
    score -= 12;
  }

  if (hasHeavyWordRepetition(significantWords)) {
    score -= 8;
  }

  if (!/[,.]/.test(normalizedSummary)) {
    score -= 6;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildSummaryPatternKey(summary: string | null | undefined) {
  const normalizedSummary = normalizeSummaryText(summary);
  if (!normalizedSummary) {
    return null;
  }

  const scaffold = buildSummaryScaffold(normalizedSummary);
  const signatureTokens = scaffold
    .split(" ")
    .filter(Boolean)
    .map(normalizeToken)
    .filter((token) => (token.startsWith("<") && token.endsWith(">")) || (token.length >= 3 && !STOP_WORDS.has(token)))
    .slice(0, 8);

  if (signatureTokens.length < 3) {
    return null;
  }

  return signatureTokens.join(" ");
}

export function buildSummaryAudit(
  rows: SummaryAuditRow[],
): SummaryAuditResult {
  const patternMap = new Map<
    string,
    {
      count: number;
      examples: Set<string>;
    }
  >();
  const flaggedCards: SummaryAuditResult["flaggedCards"] = [];
  let lowQuality = 0;

  const scoredRows = rows.map((row) => {
    const summaryQualityScore = scoreSummaryQuality({
      summary: row.aiSummary,
      artistName: row.artistName,
      projectTitle: row.projectTitle,
      title: row.title,
    });
    const patternKey = buildSummaryPatternKey(row.aiSummary);

    if (summaryQualityScore < 72) {
      lowQuality += 1;
    }

    if (patternKey) {
      const existing = patternMap.get(patternKey) || {
        count: 0,
        examples: new Set<string>(),
      };
      existing.count += 1;
      if (existing.examples.size < 3) {
        existing.examples.add(row.projectTitle || row.title);
      }
      patternMap.set(patternKey, existing);
    }

    return {
      ...row,
      summaryQualityScore,
      patternKey,
    };
  });

  const repeatedPatterns = [...patternMap.entries()]
    .filter(([, entry]) => entry.count >= 3)
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 12)
    .map(([patternLabel, entry]) => ({
      patternLabel,
      count: entry.count,
      examples: [...entry.examples],
    }));

  const repeatedPatternSet = new Set(repeatedPatterns.map((entry) => entry.patternLabel));
  let repetitive = 0;

  for (const row of scoredRows) {
    const isRepetitive = Boolean(row.patternKey && repeatedPatternSet.has(row.patternKey));
    if (isRepetitive) {
      repetitive += 1;
    }

    if (flaggedCards.length >= 24) {
      continue;
    }

    if (row.summaryQualityScore < 72 || isRepetitive) {
      flaggedCards.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        artistName: row.artistName,
        projectTitle: row.projectTitle,
        aiSummary: row.aiSummary,
        summaryQualityScore: row.summaryQualityScore,
        patternLabel: isRepetitive ? row.patternKey : null,
        publishedAt: row.publishedAt,
      });
    }
  }

  return {
    lowQuality,
    repetitive,
    repeatedPatterns,
    flaggedCards,
  };
}

function normalizeSummaryText(value: string | null | undefined) {
  return decodeHtmlEntities(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSummaryScaffold(value: string) {
  let scaffold = value;

  for (const [pattern, replacement] of SUMMARY_SCAFFOLD_PATTERNS) {
    scaffold = scaffold.replace(pattern, replacement);
  }

  return scaffold.replace(/\s+/g, " ").trim();
}

function normalizeToken(token: string) {
  return token
    .replace(/\d+/g, "#")
    .replace(/(ing|ed|ly|ies|es|s)$/g, "")
    .trim();
}

function mentionsReleaseIdentity(value: string, input: SummaryQualityInput) {
  const candidates = [input.artistName, input.projectTitle, input.title]
    .map((candidate) => normalizeSummaryText(candidate || ""))
    .filter((candidate) => candidate.length >= 4);

  return candidates.some((candidate) => value.includes(candidate));
}

function hasHeavyWordRepetition(tokens: string[]) {
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  return [...counts.values()].some((count) => count >= 3);
}
