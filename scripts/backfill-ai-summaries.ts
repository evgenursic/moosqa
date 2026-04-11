import "dotenv/config";
import { Pool } from "pg";

import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { resolveSourceMetadata } from "@/lib/source-metadata";
import { scoreSummaryQuality } from "@/lib/summary-quality";

type ReleaseRow = {
  id: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  genreName: string | null;
  releaseType: string;
  summary: string | null;
  summarySourceTitle: string | null;
  summarySourceExcerpt: string | null;
  sourceUrl: string;
  outletName: string | null;
  labelName: string | null;
  aiSummary: string | null;
  publishedAt: Date;
  metadataEnrichedAt: Date | null;
};

type BackfillMode = "stale" | "archive-upgrade" | "all";

const pool = new Pool({
  connectionString: process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL,
  max: 1,
});

const sql = String.raw;
const cliOptions = parseCliOptions(process.argv.slice(2));

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});

function mentionsReleaseIdentity(summary: string, row: ReleaseRow) {
  const normalizedSummary = normalizeIdentityText(summary);
  const candidates = [row.artistName, row.projectTitle, row.title]
    .map((candidate) => normalizeIdentityText(candidate || ""))
    .filter((candidate) => candidate.length >= 4);

  return candidates.some((candidate) => normalizedSummary.includes(candidate));
}

function normalizeIdentityText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const { mode, limit, beforeDays, dryRun } = cliOptions;
  const { offset } = cliOptions;
  const beforeDate =
    typeof beforeDays === "number"
      ? new Date(Date.now() - beforeDays * 24 * 60 * 60 * 1000)
      : null;
  const { rows } = await pool.query<ReleaseRow>(sql`
    select
      id,
      title,
      "artistName",
      "projectTitle",
      "genreName",
      "releaseType",
      summary,
      "summarySourceTitle",
      "summarySourceExcerpt",
      "sourceUrl",
      "outletName",
      "labelName",
      "aiSummary",
      "publishedAt",
      "metadataEnrichedAt"
    from "Release"
    order by "publishedAt" desc
  `);

  const eligibleRows = rows.filter((row) => shouldRefreshSummary(row, mode, beforeDate));
  const candidates = eligibleRows.slice(offset, offset + limit);
  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  skipped = eligibleRows.length - candidates.length;
  for (const row of candidates) {
    try {
      const shouldFetchSourceMetadata =
        !row.summary &&
        !row.summarySourceExcerpt &&
        (mode !== "archive-upgrade" || !row.summary);
      const sourceMetadata = shouldFetchSourceMetadata
        ? await resolveSourceMetadata(row.sourceUrl, {
            artistName: row.artistName,
            projectTitle: row.projectTitle,
            title: row.title,
          })
        : {
            sourceTitle: row.summarySourceTitle || row.projectTitle || row.title,
            sourceExcerpt: row.summarySourceExcerpt || row.summary,
          };

      const aiSummary = await generateAiSummary({
        artistName: row.artistName,
        projectTitle: row.projectTitle,
        title: row.title,
        genreName: row.genreName,
        releaseType: row.releaseType as never,
        sourceExcerpt: [sourceMetadata.sourceTitle, sourceMetadata.sourceExcerpt, row.summary]
          .filter(Boolean)
          .join(". "),
        sourceTitle: sourceMetadata.sourceTitle || row.title,
        outletName: row.outletName,
        labelName: row.labelName,
      });
      const summaryQualityScore = scoreSummaryQuality({
        summary: aiSummary,
        artistName: row.artistName,
        projectTitle: row.projectTitle,
        title: row.title,
      });

      if (!dryRun) {
        await pool.query(
          sql`
            update "Release"
            set "aiSummary" = $1,
                "summarySourceTitle" = $2,
                "summarySourceExcerpt" = $3,
                "summaryQualityScore" = $4,
                "summaryQualityCheckedAt" = now(),
                "metadataEnrichedAt" = now()
            where id = $5
          `,
          [aiSummary, sourceMetadata.sourceTitle || row.projectTitle || row.title, sourceMetadata.sourceExcerpt || row.summary || null, summaryQualityScore, row.id],
        );
      }

      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to refresh summary for ${row.id}`, error);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode,
        dryRun,
        beforeDays,
        offset,
        limit,
        checked: rows.length,
        eligible: eligibleRows.length,
        candidates: candidates.length,
        refreshed,
        skipped,
        failed,
      },
      null,
      2,
    ),
  );

  await pool.end();
}

function shouldRefreshSummary(
  row: ReleaseRow,
  mode: BackfillMode,
  beforeDate: Date | null,
) {
  const summaryQualityScore = scoreSummaryQuality({
    summary: row.aiSummary,
    artistName: row.artistName,
    projectTitle: row.projectTitle,
    title: row.title,
  });
  const isStale =
    !row.aiSummary ||
    shouldRegenerateAiSummary(row.aiSummary) ||
    mentionsReleaseIdentity(row.aiSummary, row) ||
    summaryQualityScore < 72;

  if (mode === "all") {
    return true;
  }

  if (mode === "archive-upgrade") {
    if (!beforeDate) {
      return true;
    }

    return row.publishedAt <= beforeDate;
  }

  return isStale;
}

function parseCliOptions(args: string[]) {
  const options: {
    mode: BackfillMode;
    limit: number;
    offset: number;
    beforeDays?: number;
    dryRun: boolean;
  } = {
    mode: "stale",
    limit: 160,
    offset: 0,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg.startsWith("--mode=")) {
      const value = arg.split("=")[1] as BackfillMode;
      if (value === "stale" || value === "archive-upgrade" || value === "all") {
        options.mode = value;
      }
      continue;
    }

    if (arg.startsWith("--limit=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value > 0) {
        options.limit = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith("--before-days=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value >= 0) {
        options.beforeDays = Math.floor(value);
      }
      continue;
    }

    if (arg.startsWith("--offset=")) {
      const value = Number(arg.split("=")[1]);
      if (Number.isFinite(value) && value >= 0) {
        options.offset = Math.floor(value);
      }
    }
  }

  return options;
}
