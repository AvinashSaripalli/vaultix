-- AlterTable
ALTER TABLE "Folder" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Folder_deletedAt_idx" ON "Folder"("deletedAt");
CREATE INDEX "Folder_vaultId_idx" ON "Folder"("vaultId");
