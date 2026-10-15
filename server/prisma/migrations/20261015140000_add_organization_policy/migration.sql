-- AlterEnum: Add UPDATE_ORGANIZATION_POLICY
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'UPDATE_ORGANIZATION_POLICY';

-- CreateTable: OrganizationPolicy
CREATE TABLE IF NOT EXISTS "OrganizationPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "requireTwoFactor" BOOLEAN NOT NULL DEFAULT false,
    "maxVaultTimeoutMinutes" INTEGER,
    "minMasterPasswordLength" INTEGER NOT NULL DEFAULT 8,
    "requireMasterPasswordSpecial" BOOLEAN NOT NULL DEFAULT true,
    "clipboardTimeoutSeconds" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationPolicy_pkey" PRIMARY KEY ("id")
);

-- Insert default singleton policy row if not already present
INSERT INTO "OrganizationPolicy" ("id", "requireTwoFactor", "minMasterPasswordLength", "requireMasterPasswordSpecial", "updatedAt", "createdAt")
VALUES ('default', false, 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
