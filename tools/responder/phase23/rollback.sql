-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
BEGIN;
DROP TRIGGER IF EXISTS phase23_invitation_transitions ON dispatch_phase21_local.organization_invitations;
DROP SCHEMA IF EXISTS dispatch_phase23_auth CASCADE;
COMMIT;
