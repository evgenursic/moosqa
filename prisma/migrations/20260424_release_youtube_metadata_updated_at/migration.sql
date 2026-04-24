ALTER TABLE "Release"
ADD COLUMN IF NOT EXISTS "youtubeMetadataUpdatedAt" TIMESTAMP(3);
