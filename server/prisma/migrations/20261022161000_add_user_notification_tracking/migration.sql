-- AlterTable: Add notification tracking fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastReadNotificationAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "readNotificationIds" JSONB DEFAULT '[]'::jsonb;
