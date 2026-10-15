-- AlterTable: Add requireDualAdminApproval to OrganizationPolicy
ALTER TABLE "OrganizationPolicy" ADD COLUMN IF NOT EXISTS "requireDualAdminApproval" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum: ApprovalActionType
DO $$ BEGIN
    CREATE TYPE "ApprovalActionType" AS ENUM ('DELETE_ADMIN', 'DELETE_FOLDER', 'PURGE_TRASH', 'EXPORT_AUDIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: ApprovalRequestStatus
DO $$ BEGIN
    CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: Add approval actions to ActivityAction
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CREATE_APPROVAL_REQUEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'APPROVE_REQUEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'REJECT_REQUEST';
ALTER TYPE "ActivityAction" ADD VALUE IF NOT EXISTS 'CANCEL_APPROVAL_REQUEST';

-- CreateTable: AdminApprovalRequest
CREATE TABLE IF NOT EXISTS "AdminApprovalRequest" (
    "id" TEXT NOT NULL,
    "actionType" "ApprovalActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "responseNote" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- Safe foreign keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminApprovalRequest_requesterId_fkey') THEN
        ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_requesterId_fkey"
            FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminApprovalRequest_approverId_fkey') THEN
        ALTER TABLE "AdminApprovalRequest" ADD CONSTRAINT "AdminApprovalRequest_approverId_fkey"
            FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Safe indexes
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_status_idx" ON "AdminApprovalRequest"("status");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_requesterId_idx" ON "AdminApprovalRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "AdminApprovalRequest_approverId_idx" ON "AdminApprovalRequest"("approverId");
