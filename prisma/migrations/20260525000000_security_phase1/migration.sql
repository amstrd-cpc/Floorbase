-- AlterEnum: add auth event action types
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_SUCCESS';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN_FAILURE';
ALTER TYPE "AuditAction" ADD VALUE 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE 'INVITE_ACCEPTED';

-- AlterTable: make organizationId nullable so auth events (e.g. failed logins,
-- SUPER_ADMIN actions) can be logged without an org scope.
ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" DROP NOT NULL;
