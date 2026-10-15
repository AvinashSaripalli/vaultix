-- AlterEnum: Add OWNER to Role enum for organization ownership hierarchy
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';
