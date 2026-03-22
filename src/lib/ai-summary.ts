import OpenAI from "openai";

import { ReleaseType } from "@/generated/prisma/enums";

type SummaryInput = {
  artistName: string | null;
  projectTitle: string | null;
  title: string;
  genreName: string | null;
  releaseType: ReleaseType;
  sourceExcerpt: string | null;
};

let client: OpenAI | null = null;

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
      max_output_tokens: 70,
      input: [
        {
          role: "system",
          content:
            "You write one-sentence music discovery blurbs. Be concrete, tasteful, non-hype, and under 22 words. Do not mention Reddit.",
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Artist: ${input.artistName || "Unknown"}`,
                `Release title: ${input.projectTitle || input.title}`,
                `Release type: ${input.releaseType}`,
                `Genre: ${input.genreName || "Unknown"}`,
                `Context: ${input.sourceExcerpt || "No extra context available."}`,
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

function buildFallbackSummary(input: SummaryInput) {
  const subject = input.artistName || input.projectTitle || input.title;
  const typeLabel = getTypeLabel(input.releaseType);
  const genreName = sanitizeGenreForSummary(input.genreName);

  if (genreName) {
    return `${subject} lands with a ${genreName}-leaning ${typeLabel} that feels immediate, melodic, and easy to place on a first listen.`;
  }

  return `${subject} arrives with a focused ${typeLabel} built for quick discovery and a clear sense of mood from the opening moments.`;
}

function sanitizeSummary(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim().replace(/^["']|["']$/g, "");

  if (normalized.includes("schema.googleapis.com") || normalized.includes("schema.org")) {
    return null;
  }

  return normalized;
}

function getTypeLabel(releaseType: ReleaseType) {
  if (releaseType === ReleaseType.ALBUM) {
    return "album";
  }
  if (releaseType === ReleaseType.EP) {
    return "EP";
  }
  if (releaseType === ReleaseType.PERFORMANCE) {
    return "performance";
  }
  return "single";
}

function sanitizeGenreForSummary(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (
    normalized.toLowerCase().startsWith("http") ||
    normalized.toLowerCase().includes("schema.org") ||
    normalized.toLowerCase().includes("schema.googleapis.com")
  ) {
    return null;
  }

  return normalized;
}
