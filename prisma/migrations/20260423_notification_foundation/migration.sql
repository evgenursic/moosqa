DO $$
BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationJobType" AS ENUM ('DAILY_DIGEST', 'WEEKLY_DIGEST', 'INSTANT_ALERT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "NotificationDeliveryOutcome" AS ENUM ('SENT', 'FAILED', 'SKIPPED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "UserPreference"
ADD COLUMN IF NOT EXISTS "digestTimezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS "digestHourLocal" INTEGER NOT NULL DEFAULT 9;

CREATE TABLE IF NOT EXISTS "NotificationJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationJobType" NOT NULL,
  "channel" "NotificationChannel" NOT NULL,
  "periodKey" TEXT NOT NULL,
  "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
  "destination" TEXT,
  "subject" TEXT,
  "payloadJson" TEXT,
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "message" TEXT,
  "providerMessageId" TEXT,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationDeliveryLog" (
  "id" TEXT NOT NULL,
  "jobId" TEXT,
  "userId" TEXT,
  "type" "NotificationJobType",
  "channel" "NotificationChannel" NOT NULL,
  "outcome" "NotificationDeliveryOutcome" NOT NULL,
  "destination" TEXT,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "responseStatus" INTEGER,
  "latencyMs" INTEGER,
  "message" TEXT,
  "providerMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationJob_userId_type_channel_periodKey_key"
ON "NotificationJob"("userId", "type", "channel", "periodKey");

CREATE INDEX IF NOT EXISTS "NotificationJob_status_queuedAt_idx"
ON "NotificationJob"("status", "queuedAt");

CREATE INDEX IF NOT EXISTS "NotificationJob_type_queuedAt_idx"
ON "NotificationJob"("type", "queuedAt");

CREATE INDEX IF NOT EXISTS "NotificationJob_userId_queuedAt_idx"
ON "NotificationJob"("userId", "queuedAt");

CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_createdAt_idx"
ON "NotificationDeliveryLog"("createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_channel_createdAt_idx"
ON "NotificationDeliveryLog"("channel", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_jobId_createdAt_idx"
ON "NotificationDeliveryLog"("jobId", "createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDeliveryLog_userId_createdAt_idx"
ON "NotificationDeliveryLog"("userId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "NotificationJob"
  ADD CONSTRAINT "NotificationJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "NotificationDeliveryLog"
  ADD CONSTRAINT "NotificationDeliveryLog_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "NotificationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "NotificationDeliveryLog"
  ADD CONSTRAINT "NotificationDeliveryLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "UserProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
