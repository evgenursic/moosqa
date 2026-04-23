CREATE TABLE IF NOT EXISTS "UserRoleAssignmentAudit" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "targetUserId" TEXT NOT NULL,
  "previousRole" "UserRole",
  "nextRole" "UserRole" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRoleAssignmentAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserRoleAssignmentAudit_createdAt_idx"
ON "UserRoleAssignmentAudit"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS "UserRoleAssignmentAudit_actorUserId_createdAt_idx"
ON "UserRoleAssignmentAudit"("actorUserId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "UserRoleAssignmentAudit_targetUserId_createdAt_idx"
ON "UserRoleAssignmentAudit"("targetUserId", "createdAt" DESC);

DO $$
BEGIN
  ALTER TABLE "UserRoleAssignmentAudit"
  ADD CONSTRAINT "UserRoleAssignmentAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "UserProfile"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "UserRoleAssignmentAudit"
  ADD CONSTRAINT "UserRoleAssignmentAudit_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "UserProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
