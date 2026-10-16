-- AlterEnum: Rename OWNER to SUPER_ADMIN in Role enum
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = '"Role"'::regtype AND enumlabel = 'OWNER') 
     AND NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = '"Role"'::regtype AND enumlabel = 'SUPER_ADMIN') THEN
    ALTER TYPE "Role" RENAME VALUE 'OWNER' TO 'SUPER_ADMIN';
  ELSIF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = '"Role"'::regtype AND enumlabel = 'SUPER_ADMIN') THEN
    ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
  END IF;
END $$;
