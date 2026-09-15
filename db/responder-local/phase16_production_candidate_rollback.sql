-- GRIDLY RESPONDER V1 PHASE 16 -- PRE-ACTIVATION ROLLBACK CANDIDATE, NOT DEPLOYED.
-- Safe only when a deployment verification proves that no responder organization,
-- membership, update, receipt, approval, rate or audit row has been created.
BEGIN;
DO $rollback_gate$
BEGIN
  IF EXISTS (SELECT 1 FROM agency_private.organizations)
     OR EXISTS (SELECT 1 FROM agency_private.principals)
     OR EXISTS (SELECT 1 FROM agency_private.organization_memberships)
     OR EXISTS (SELECT 1 FROM agency_private.gridly_admin_grants)
     OR EXISTS (SELECT 1 FROM agency_private.agency_updates)
     OR EXISTS (SELECT 1 FROM agency_private.governance_events)
     OR EXISTS (SELECT 1 FROM agency_private.operation_receipts) THEN
    RAISE EXCEPTION 'Responder evidence exists; preserve/export it and use a forward recovery migration';
  END IF;
END
$rollback_gate$;
DROP SCHEMA responder_public CASCADE;
DROP SCHEMA agency_private CASCADE;
COMMIT;
