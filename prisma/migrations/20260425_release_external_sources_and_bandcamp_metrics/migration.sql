DO $$
BEGIN
  CREATE TYPE "ReleaseExternalSourceType" AS ENUM (
    'REVIEW',
    'FEATURE',
    'INTERVIEW',
    'NEWS',
    'OFFICIAL',
    'USER_CURATED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Release"
  ADD COLUMN IF NOT EXISTS "bandcampSupporterCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "bandcampFollowerCount" INTEGER,
  ADD COLUMN IF NOT EXISTS "bandcampMetadataUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ReleaseExternalSource" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "sourceName" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "sourceType" "ReleaseExternalSourceType" NOT NULL DEFAULT 'USER_CURATED',
  "publishedAt" TIMESTAMP(3),
  "isVisible" BOOLEAN NOT NULL DEFAULT true,
  "addedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReleaseExternalSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReleaseExternalSource_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReleaseExternalSource_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReleaseExternalSource_releaseId_isVisible_publishedAt_idx"
  ON "ReleaseExternalSource"("releaseId", "isVisible", "publishedAt" DESC);

CREATE INDEX IF NOT EXISTS "ReleaseExternalSource_sourceType_isVisible_updatedAt_idx"
  ON "ReleaseExternalSource"("sourceType", "isVisible", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "ReleaseExternalSource_addedByUserId_createdAt_idx"
  ON "ReleaseExternalSource"("addedByUserId", "createdAt" DESC);
