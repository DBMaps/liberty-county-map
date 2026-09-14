-- LOCAL/DISPOSABLE ONLY. Never run against a shared or production database.
BEGIN;
DROP SCHEMA agency_private CASCADE;
DROP ROLE responder_app_fixture;
DROP ROLE responder_owner_fixture;
COMMIT;
