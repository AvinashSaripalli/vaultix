-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'RESTORE_PASSWORD_VERSION';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'VIEW_PASSWORD_HISTORY';

-- AlterTable
ALTER TABLE "PasswordEntry" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PasswordRevision" (
    "id" TEXT NOT NULL,
    "passwordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "login" TEXT NOT NULL DEFAULT '',
    "type" "ItemType" NOT NULL DEFAULT 'LOGIN',
    "encryptedPassword" TEXT NOT NULL DEFAULT '',
    "encryptedFields" TEXT,
    "encryptedNote" TEXT,
    "wrappedKeys" JSONB,
    "url" TEXT,
    "colorTag" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changeSummary" TEXT,

    CONSTRAINT "PasswordRevision_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordRevision_passwordId_fkey" FOREIGN KEY ("passwordId") REFERENCES "PasswordEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PasswordRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordRevision_passwordId_version_key" ON "PasswordRevision"("passwordId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordRevision_passwordId_idx" ON "PasswordRevision"("passwordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PasswordRevision_createdById_idx" ON "PasswordRevision"("createdById");
