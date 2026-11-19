-- AlterTable
ALTER TABLE "OrganizationPolicy" ADD COLUMN IF NOT EXISTS "allowPersonalVaultExport" BOOLEAN NOT NULL DEFAULT true;

-- AlterEnum
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'EXPORT_PASSWORDS';
