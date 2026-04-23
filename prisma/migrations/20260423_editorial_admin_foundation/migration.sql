DO $$
BEGIN
  CREATE TYPE "EditorialCollectionType" AS ENUM ('EDITORS_PICK', 'CURATED', 'ROUNDUP', 'SEASONAL', 'BEST_OF');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Release"
ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "hiddenReason" TEXT,
ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "editorialRank" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "genreOverride" TEXT,
ADD COLUMN IF NOT EXISTS "summaryOverride" TEXT,
ADD COLUMN IF NOT EXISTS "imageUrlOverride" TEXT,
ADD COLUMN IF NOT EXISTS "sourceUrlOverride" TEXT,
ADD COLUMN IF NOT EXISTS "editorialNotes" TEXT,
ADD COLUMN IF NOT EXISTS "editorialUpdatedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "editorialUpdatedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Release_isHidden_publishedAt_idx"
ON "Release"("isHidden", "publishedAt");

CREATE INDEX IF NOT EXISTS "Release_isFeatured_editorialRank_publishedAt_idx"
ON "Release"("isFeatured", "editorialRank", "publishedAt");

CREATE TABLE IF NOT EXISTS "EditorialCollection" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "type" "EditorialCollectionType" NOT NULL DEFAULT 'CURATED',
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "publishedAt" TIMESTAMP(3),
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EditorialCollection_slug_key"
ON "EditorialCollection"("slug");

CREATE INDEX IF NOT EXISTS "EditorialCollection_type_isPublished_updatedAt_idx"
ON "EditorialCollection"("type", "isPublished", "updatedAt");

CREATE TABLE IF NOT EXISTS "EditorialCollectionEntry" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EditorialCollectionEntry_collectionId_releaseId_key"
ON "EditorialCollectionEntry"("collectionId", "releaseId");

CREATE INDEX IF NOT EXISTS "EditorialCollectionEntry_collectionId_position_idx"
ON "EditorialCollectionEntry"("collectionId", "position");

CREATE INDEX IF NOT EXISTS "EditorialCollectionEntry_releaseId_createdAt_idx"
ON "EditorialCollectionEntry"("releaseId", "createdAt");

CREATE TABLE IF NOT EXISTS "ReleaseEditorialAudit" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "editorUserId" TEXT,
  "action" TEXT NOT NULL,
  "detailsJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReleaseEditorialAudit_releaseId_createdAt_idx"
ON "ReleaseEditorialAudit"("releaseId", "createdAt");

CREATE INDEX IF NOT EXISTS "ReleaseEditorialAudit_editorUserId_createdAt_idx"
ON "ReleaseEditorialAudit"("editorUserId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "EditorialCollectionEntry"
  ADD CONSTRAINT "EditorialCollectionEntry_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "EditorialCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "EditorialCollectionEntry"
  ADD CONSTRAINT "EditorialCollectionEntry_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReleaseEditorialAudit"
  ADD CONSTRAINT "ReleaseEditorialAudit_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "Release"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReleaseEditorialAudit"
  ADD CONSTRAINT "ReleaseEditorialAudit_editorUserId_fkey"
  FOREIGN KEY ("editorUserId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
