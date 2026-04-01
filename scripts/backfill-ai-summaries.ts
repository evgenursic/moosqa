import "dotenv/config";
import { Pool } from "pg";

import { generateAiSummary, shouldRegenerateAiSummary } from "@/lib/ai-summary";
import { resolveSourceMetadata } from "@/lib/source-metadata";

type ReleaseRow = {
  id: string;
  title: string;
  artistName: string | null;
  projectTitle: string | null;
  genreName: string | null;
  releaseType: string;
  summary: string | null;
  sourceUrl: string;
  outletName: string | null;
  labelName: string | null;
  aiSummary: string | null;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_RUNTIME_URL || process.env.DATABASE_URL,
  max: 1,
});

const sql = String.raw;

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
  const { rows } = await pool.query<ReleaseRow>(sql`
    select
      id,
      title,
      "artistName",
      "projectTitle",
      "genreName",
      "releaseType",
      summary,
      "sourceUrl",
      "outletName",
      "labelName",
      "aiSummary"
    from "Release"
    order by "publishedAt" desc
  `);

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    const shouldRefresh =
      !row.aiSummary ||
      shouldRegenerateAiSummary(row.aiSummary) ||
      mentionsReleaseIdentity(row.aiSummary, row);

    if (!shouldRefresh) {
      skipped += 1;
      continue;
    }

    try {
      const sourceMetadata = await resolveSourceMetadata(row.sourceUrl, {
        artistName: row.artistName,
        projectTitle: row.projectTitle,
        title: row.title,
      });

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

      await pool.query(
        sql`
          update "Release"
          set "aiSummary" = $1,
              "metadataEnrichedAt" = now()
          where id = $2
        `,
        [aiSummary, row.id],
      );

      refreshed += 1;
    } catch (error) {
      failed += 1;
      console.error(`Failed to refresh summary for ${row.id}`, error);
    }
  }

  console.log(
    JSON.stringify(
      {
        checked: rows.length,
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
