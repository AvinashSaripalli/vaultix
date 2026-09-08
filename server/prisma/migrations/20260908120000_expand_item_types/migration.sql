-- Extend the ItemType enum with developer/tool-oriented credential types and
-- recovery codes so company vaults can store more than just web logins.
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'SSH_KEY';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'API_TOKEN';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'DATABASE';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'WIFI';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'LICENSE';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'RECOVERY_CODE';