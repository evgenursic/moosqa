import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

const schemaSql = `
CREATE TABLE IF NOT EXISTS "Release" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "source" TEXT NOT NULL DEFAULT 'REDDIT',
  "sourceItemId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "artistName" TEXT,
  "projectTitle" TEXT,
  "releaseType" TEXT NOT NULL DEFAULT 'OTHER',
  "flair" TEXT,
  "summary" TEXT,
  "aiSummary" TEXT,
  "outletName" TEXT,
  "labelName" TEXT,
  "genreName" TEXT,
  "releaseDate" DATETIME,
  "publishedAt" DATETIME NOT NULL,
  "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataEnrichedAt" DATETIME,
  "updatedAt" DATETIME NOT NULL,
  "redditPermalink" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "imageUrl" TEXT,
  "thumbnailUrl" TEXT,
  "youtubeUrl" TEXT,
  "youtubeMusicUrl" TEXT,
  "bandcampUrl" TEXT,
  "musicbrainzReleaseId" TEXT,
  "musicbrainzArtistId" TEXT,
  "domain" TEXT,
  "score" INTEGER,
  "commentCount" INTEGER,
  "rawJson" TEXT,
  "scoreAverage" REAL NOT NULL DEFAULT 0,
  "scoreCount" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "Vote" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "releaseId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  "value" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Vote_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Release_sourceItemId_key" ON "Release"("sourceItemId");
CREATE UNIQUE INDEX IF NOT EXISTS "Release_slug_key" ON "Release"("slug");
CREATE INDEX IF NOT EXISTS "Release_publishedAt_idx" ON "Release"("publishedAt" DESC);
CREATE INDEX IF NOT EXISTS "Release_releaseType_publishedAt_idx" ON "Release"("releaseType", "publishedAt" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "Vote_releaseId_deviceId_key" ON "Vote"("releaseId", "deviceId");
`;

let initPromise: Promise<void> | null = null;

export async function ensureDatabase() {
  if (!initPromise) {
    initPromise = Promise.resolve().then(() => {
      const dbPath = resolveSqlitePath(process.env.DATABASE_URL || "file:./prisma/dev.db");
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const db = new Database(dbPath);
      db.pragma("journal_mode = WAL");
      db.exec(schemaSql);
      ensureReleaseColumns(db);
      db.close();
    });
  }

  return initPromise;
}

function ensureReleaseColumns(db: Database.Database) {
  const columns = db
    .prepare('PRAGMA table_info("Release")')
    .all() as Array<{ name: string }>;

  const columnNames = new Set(columns.map((column) => column.name));
  const missingColumns: Array<[string, string]> = [
    ["aiSummary", 'ALTER TABLE "Release" ADD COLUMN "aiSummary" TEXT'],
    ["labelName", 'ALTER TABLE "Release" ADD COLUMN "labelName" TEXT'],
    ["genreName", 'ALTER TABLE "Release" ADD COLUMN "genreName" TEXT'],
    ["metadataEnrichedAt", 'ALTER TABLE "Release" ADD COLUMN "metadataEnrichedAt" DATETIME'],
    ["youtubeUrl", 'ALTER TABLE "Release" ADD COLUMN "youtubeUrl" TEXT'],
    ["youtubeMusicUrl", 'ALTER TABLE "Release" ADD COLUMN "youtubeMusicUrl" TEXT'],
    ["bandcampUrl", 'ALTER TABLE "Release" ADD COLUMN "bandcampUrl" TEXT'],
    ["musicbrainzReleaseId", 'ALTER TABLE "Release" ADD COLUMN "musicbrainzReleaseId" TEXT'],
    ["musicbrainzArtistId", 'ALTER TABLE "Release" ADD COLUMN "musicbrainzArtistId" TEXT'],
  ];

  for (const [name, statement] of missingColumns) {
    if (!columnNames.has(name)) {
      db.exec(statement);
    }
  }
}

function resolveSqlitePath(url: string) {
  if (!url.startsWith("file:")) {
    throw new Error("Only sqlite file: DATABASE_URL values are supported.");
  }

  const rawPath = decodeURIComponent(url.slice(5));
  if (rawPath === ":memory:") {
    return rawPath;
  }

  if (/^\/[A-Za-z]:\//.test(rawPath)) {
    return rawPath.slice(1);
  }

  if (path.isAbsolute(rawPath)) {
    return rawPath;
  }

  return path.resolve(/* turbopackIgnore: true */ process.cwd(), rawPath);
}
