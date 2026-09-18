-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Phase 21 neutral Dispatch relational prototype.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dispatch_phase21_app') THEN
    CREATE ROLE dispatch_phase21_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dispatch_phase21_public') THEN
    CREATE ROLE dispatch_phase21_public NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

CREATE SCHEMA dispatch_phase21_local;
REVOKE ALL ON SCHEMA dispatch_phase21_local FROM PUBLIC;
GRANT USAGE ON SCHEMA dispatch_phase21_local TO dispatch_phase21_app, dispatch_phase21_public;

CREATE TYPE dispatch_phase21_local.profile_status AS ENUM ('ACTIVE','DISABLED');
CREATE TYPE dispatch_phase21_local.organization_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE dispatch_phase21_local.organization_type AS ENUM
  ('FIRE','EMS','LAW_ENFORCEMENT','EMERGENCY_MANAGEMENT','UTILITY','FLEET','TRUCKING',
   'MUNICIPALITY','SCHOOL_DISTRICT','CONTRACTOR','PRIVATE_COMPANY','INDUSTRIAL_OPERATOR',
   'TRANSPORTATION_OPERATOR','INFRASTRUCTURE_OPERATOR','OTHER');
CREATE TYPE dispatch_phase21_local.verification_level AS ENUM
  ('UNVERIFIED','VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY');
CREATE TYPE dispatch_phase21_local.membership_status AS ENUM ('INVITED','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_phase21_local.role_template_key AS ENUM
  ('OWNER','ORGANIZATION_ADMIN','SUPERVISOR','OPERATOR','VIEWER');
CREATE TYPE dispatch_phase21_local.invitation_status AS ENUM
  ('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED');
CREATE TYPE dispatch_phase21_local.permission_scope AS ENUM ('ORGANIZATION','PLATFORM');
CREATE TYPE dispatch_phase21_local.scope_type AS ENUM
  ('COUNTY','MULTI_COUNTY','STATEWIDE','SERVICE_TERRITORY','CORRIDOR','ROUTE','FACILITY','SITE','NON_GEOGRAPHIC');
CREATE TYPE dispatch_phase21_local.scope_status AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_phase21_local.capability_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_phase21_local.record_type AS ENUM ('CONDITION','HAZARD','PLANNED_WORK','OPERATIONAL_NOTICE');
CREATE TYPE dispatch_phase21_local.record_status AS ENUM
  ('DRAFT','OPEN','IN_PROGRESS','MONITORING','CLOSED','CANCELLED');
CREATE TYPE dispatch_phase21_local.record_priority AS ENUM ('LOW','NORMAL','HIGH','CRITICAL');
CREATE TYPE dispatch_phase21_local.assignment_status AS ENUM ('ASSIGNED','CLEARED');
CREATE TYPE dispatch_phase21_local.source_class AS ENUM
  ('COMMUNITY','OFFICIAL_PUBLIC','ORGANIZATION','PRIVATE_OPERATIONAL');
CREATE TYPE dispatch_phase21_local.visibility_class AS ENUM
  ('PRIVATE','ORGANIZATION','PROJECTION_CANDIDATE','PUBLIC_PROJECTION');
CREATE TYPE dispatch_phase21_local.review_state AS ENUM
  ('NOT_SUBMITTED','PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_phase21_local.projection_status AS ENUM
  ('SUBMITTED','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_phase21_local.ownership_transfer_status AS ENUM
  ('PENDING','ACCEPTED','CANCELLED');
CREATE TYPE dispatch_phase21_local.audit_event_type AS ENUM
  ('ORGANIZATION_CREATED','ORGANIZATION_UPDATED','ORGANIZATION_ACTIVATED','ORGANIZATION_SUSPENDED',
   'ORGANIZATION_REINSTATED','ORGANIZATION_CLOSED','MEMBER_INVITED','INVITATION_ACCEPTED',
   'INVITATION_DECLINED','INVITATION_EXPIRED','MEMBER_SUSPENDED','MEMBER_REACTIVATED',
   'MEMBER_REVOKED','MEMBERSHIP_LEFT','ROLE_CHANGED','OWNERSHIP_TRANSFER_INITIATED',
   'OWNERSHIP_TRANSFER_CANCELLED','OWNERSHIP_TRANSFERRED','OWNERSHIP_RECOVERED','SCOPE_GRANTED',
   'SCOPE_REVOKED','CAPABILITY_GRANTED','CAPABILITY_SUSPENDED','CAPABILITY_REVOKED',
   'RECORD_CREATED','RECORD_UPDATED','RECORD_ASSIGNED','RECORD_CLOSED','RECORD_CANCELLED',
   'PROJECTION_SUBMITTED','PROJECTION_APPROVED','PROJECTION_REJECTED','PROJECTION_PUBLISHED',
   'PROJECTION_WITHDRAWN','SETTINGS_CHANGED');

CREATE TABLE dispatch_phase21_local.profiles (
  user_id uuid PRIMARY KEY,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  status dispatch_phase21_local.profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE dispatch_phase21_local.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 160),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  organization_type dispatch_phase21_local.organization_type NOT NULL,
  status dispatch_phase21_local.organization_status NOT NULL DEFAULT 'PENDING',
  verification_level dispatch_phase21_local.verification_level NOT NULL DEFAULT 'UNVERIFIED',
  governance_revision integer NOT NULL DEFAULT 0 CHECK (governance_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE dispatch_phase21_local.role_templates (
  role_key dispatch_phase21_local.role_template_key PRIMARY KEY,
  description text NOT NULL,
  fixed boolean NOT NULL DEFAULT true CHECK (fixed)
);

CREATE TABLE dispatch_phase21_local.permissions (
  permission_key text PRIMARY KEY CHECK (permission_key ~ '^[a-z]+([._][a-z]+)+$'),
  description text NOT NULL,
  scope_class dispatch_phase21_local.permission_scope NOT NULL
);

CREATE TABLE dispatch_phase21_local.role_permissions (
  role_key dispatch_phase21_local.role_template_key NOT NULL
    REFERENCES dispatch_phase21_local.role_templates(role_key) ON DELETE RESTRICT,
  permission_key text NOT NULL
    REFERENCES dispatch_phase21_local.permissions(permission_key) ON DELETE RESTRICT,
  PRIMARY KEY (role_key,permission_key)
);
CREATE INDEX role_permissions_permission_idx
  ON dispatch_phase21_local.role_permissions(permission_key);

CREATE TABLE dispatch_phase21_local.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  status dispatch_phase21_local.membership_status NOT NULL DEFAULT 'INVITED',
  role_template dispatch_phase21_local.role_template_key NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  activated_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  UNIQUE (organization_id,id),
  CHECK (status <> 'ACTIVE' OR activated_at IS NOT NULL),
  CHECK (status <> 'SUSPENDED' OR suspended_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL),
  CHECK (expires_at IS NULL OR expires_at > created_at)
);
CREATE UNIQUE INDEX organization_memberships_one_live_pair_idx
  ON dispatch_phase21_local.organization_memberships(organization_id,user_id)
  WHERE status IN ('INVITED','ACTIVE','SUSPENDED');
CREATE UNIQUE INDEX organization_memberships_one_owner_idx
  ON dispatch_phase21_local.organization_memberships(organization_id)
  WHERE status='ACTIVE' AND role_template='OWNER';
CREATE INDEX organization_memberships_user_org_status_idx
  ON dispatch_phase21_local.organization_memberships(user_id,organization_id,status);
CREATE INDEX organization_memberships_org_role_status_idx
  ON dispatch_phase21_local.organization_memberships(organization_id,role_template,status);

CREATE TABLE dispatch_phase21_local.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  email_or_identity_target text NOT NULL CHECK (char_length(email_or_identity_target) BETWEEN 3 AND 254),
  role_template dispatch_phase21_local.role_template_key NOT NULL CHECK (role_template <> 'OWNER'),
  token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest)=32),
  status dispatch_phase21_local.invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (organization_id,created_by_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (status <> 'ACCEPTED' OR accepted_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE INDEX organization_invitations_org_status_expiry_idx
  ON dispatch_phase21_local.organization_invitations(organization_id,status,expires_at);
CREATE INDEX organization_invitations_creator_idx
  ON dispatch_phase21_local.organization_invitations(created_by_membership_id);
CREATE UNIQUE INDEX organization_invitations_one_pending_target_idx
  ON dispatch_phase21_local.organization_invitations(organization_id,lower(email_or_identity_target))
  WHERE status='PENDING';

CREATE TABLE dispatch_phase21_local.operational_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  scope_type dispatch_phase21_local.scope_type NOT NULL,
  status dispatch_phase21_local.scope_status NOT NULL DEFAULT 'ACTIVE',
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  definition jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(definition)='object'),
  source_reference text NOT NULL CHECK (char_length(source_reference) BETWEEN 1 AND 240),
  source_version text NOT NULL CHECK (char_length(source_version) BETWEEN 1 AND 160),
  valid_from timestamptz NOT NULL DEFAULT statement_timestamp(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  UNIQUE (organization_id,id),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE INDEX operational_scopes_org_status_validity_idx
  ON dispatch_phase21_local.operational_scopes(organization_id,status,valid_from,valid_until);

CREATE TABLE dispatch_phase21_local.platform_admin_grants (
  user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  permission_key text NOT NULL REFERENCES dispatch_phase21_local.permissions(permission_key) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  granted_by_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id,permission_key),
  CHECK (active OR revoked_at IS NOT NULL)
);
CREATE INDEX platform_admin_grants_permission_idx
  ON dispatch_phase21_local.platform_admin_grants(permission_key,active);
CREATE INDEX platform_admin_grants_grantor_idx
  ON dispatch_phase21_local.platform_admin_grants(granted_by_user_id);

CREATE TABLE dispatch_phase21_local.capability_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  capability_key text NOT NULL CHECK (capability_key IN
    ('awareness.condition.publish','awareness.hazard.publish','awareness.planned_work.publish',
     'awareness.official_notice.publish','awareness.road_closure.publish')),
  operational_scope_id uuid NOT NULL,
  status dispatch_phase21_local.capability_status NOT NULL DEFAULT 'PENDING',
  required_verification dispatch_phase21_local.verification_level NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  granted_by_platform_actor uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  governance_reference text NOT NULL CHECK (char_length(governance_reference) BETWEEN 1 AND 240),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,operational_scope_id)
    REFERENCES dispatch_phase21_local.operational_scopes(organization_id,id) ON DELETE RESTRICT,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE INDEX capability_grants_org_scope_status_validity_idx
  ON dispatch_phase21_local.capability_grants
    (organization_id,operational_scope_id,status,valid_from,valid_until);
CREATE INDEX capability_grants_platform_actor_idx
  ON dispatch_phase21_local.capability_grants(granted_by_platform_actor);

CREATE TABLE dispatch_phase21_local.operational_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  record_type dispatch_phase21_local.record_type NOT NULL,
  status dispatch_phase21_local.record_status NOT NULL DEFAULT 'DRAFT',
  priority dispatch_phase21_local.record_priority NOT NULL DEFAULT 'NORMAL',
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  operational_scope_id uuid NOT NULL,
  location jsonb CHECK (location IS NULL OR jsonb_typeof(location)='object'),
  created_by_membership_id uuid NOT NULL,
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  closed_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,operational_scope_id)
    REFERENCES dispatch_phase21_local.operational_scopes(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,created_by_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK ((status IN ('CLOSED','CANCELLED')) = (closed_at IS NOT NULL))
);
CREATE INDEX operational_records_org_status_updated_idx
  ON dispatch_phase21_local.operational_records(organization_id,status,updated_at DESC);
CREATE INDEX operational_records_scope_idx
  ON dispatch_phase21_local.operational_records(operational_scope_id);
CREATE INDEX operational_records_creator_idx
  ON dispatch_phase21_local.operational_records(created_by_membership_id);

CREATE TABLE dispatch_phase21_local.record_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 0),
  actor_membership_id uuid NOT NULL,
  payload_snapshot jsonb NOT NULL CHECK (jsonb_typeof(payload_snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (record_id,revision_number),
  UNIQUE (organization_id,record_id,revision_number),
  FOREIGN KEY (organization_id,record_id)
    REFERENCES dispatch_phase21_local.operational_records(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,actor_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX record_revisions_org_record_idx
  ON dispatch_phase21_local.record_revisions(organization_id,record_id,revision_number DESC);
CREATE INDEX record_revisions_actor_idx
  ON dispatch_phase21_local.record_revisions(actor_membership_id);
ALTER TABLE dispatch_phase21_local.operational_records
  ADD CONSTRAINT operational_records_current_revision_fk
  FOREIGN KEY (organization_id,id,current_revision)
  REFERENCES dispatch_phase21_local.record_revisions(organization_id,record_id,revision_number)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE dispatch_phase21_local.record_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  assigned_membership_id uuid NOT NULL,
  assigned_by_membership_id uuid NOT NULL,
  status dispatch_phase21_local.assignment_status NOT NULL DEFAULT 'ASSIGNED',
  assigned_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  cleared_at timestamptz,
  FOREIGN KEY (organization_id,record_id)
    REFERENCES dispatch_phase21_local.operational_records(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,assigned_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,assigned_by_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK ((status='CLEARED') = (cleared_at IS NOT NULL))
);
CREATE UNIQUE INDEX record_assignments_one_current_idx
  ON dispatch_phase21_local.record_assignments(record_id) WHERE status='ASSIGNED';
CREATE INDEX record_assignments_org_assignee_idx
  ON dispatch_phase21_local.record_assignments(organization_id,assigned_membership_id,status);
CREATE INDEX record_assignments_assigner_idx
  ON dispatch_phase21_local.record_assignments(assigned_by_membership_id);

CREATE TABLE dispatch_phase21_local.record_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  revision_number integer NOT NULL,
  author_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  membership_id uuid NOT NULL,
  source_class dispatch_phase21_local.source_class NOT NULL,
  verification_level dispatch_phase21_local.verification_level NOT NULL,
  capability_grant_id uuid,
  operational_scope_id uuid NOT NULL,
  visibility dispatch_phase21_local.visibility_class NOT NULL DEFAULT 'PRIVATE',
  review_state dispatch_phase21_local.review_state NOT NULL DEFAULT 'NOT_SUBMITTED',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (record_id,revision_number),
  FOREIGN KEY (organization_id,record_id,revision_number)
    REFERENCES dispatch_phase21_local.record_revisions(organization_id,record_id,revision_number) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,operational_scope_id)
    REFERENCES dispatch_phase21_local.operational_scopes(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,capability_grant_id)
    REFERENCES dispatch_phase21_local.capability_grants(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX record_provenance_org_record_idx
  ON dispatch_phase21_local.record_provenance(organization_id,record_id);
CREATE INDEX record_provenance_author_idx
  ON dispatch_phase21_local.record_provenance(author_user_id);
CREATE INDEX record_provenance_membership_idx
  ON dispatch_phase21_local.record_provenance(membership_id);
CREATE INDEX record_provenance_scope_idx
  ON dispatch_phase21_local.record_provenance(operational_scope_id);
CREATE INDEX record_provenance_capability_idx
  ON dispatch_phase21_local.record_provenance(capability_grant_id) WHERE capability_grant_id IS NOT NULL;

CREATE FUNCTION dispatch_phase21_local.projection_has_forbidden_key(p_value jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v_key text; v_child jsonb;
BEGIN
  IF p_value IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(p_value)='object' THEN
    FOR v_key,v_child IN SELECT key,value FROM pg_catalog.jsonb_each(p_value) LOOP
      IF v_key = ANY (ARRAY['assigned_membership_id','assigned_to','staff_name','author_user_id',
        'membership_id','email','phone','private_notes','internal_comments','priority','audit',
        'permission_state','membership_status','internal_status','response_plan']) THEN RETURN true; END IF;
      IF dispatch_phase21_local.projection_has_forbidden_key(v_child) THEN RETURN true; END IF;
    END LOOP;
  ELSIF jsonb_typeof(p_value)='array' THEN
    FOR v_child IN SELECT value FROM pg_catalog.jsonb_array_elements(p_value) LOOP
      IF dispatch_phase21_local.projection_has_forbidden_key(v_child) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.projection_has_forbidden_key(jsonb) FROM PUBLIC;

CREATE TABLE dispatch_phase21_local.projection_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  source_revision integer NOT NULL,
  capability_grant_id uuid NOT NULL,
  status dispatch_phase21_local.projection_status NOT NULL DEFAULT 'SUBMITTED',
  requested_by_membership_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  rejection_reason text CHECK (rejection_reason IS NULL OR char_length(rejection_reason) <= 1000),
  sanitized_payload jsonb NOT NULL CHECK (jsonb_typeof(sanitized_payload)='object'
    AND NOT dispatch_phase21_local.projection_has_forbidden_key(sanitized_payload)),
  consumer_taxonomy text NOT NULL CHECK (char_length(consumer_taxonomy) BETWEEN 1 AND 120),
  freshness_deadline timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  FOREIGN KEY (organization_id,source_record_id,source_revision)
    REFERENCES dispatch_phase21_local.record_revisions(organization_id,record_id,revision_number) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,capability_grant_id)
    REFERENCES dispatch_phase21_local.capability_grants(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,requested_by_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,reviewed_by_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (freshness_deadline > requested_at),
  CHECK (status NOT IN ('APPROVED','REJECTED') OR (reviewed_by_membership_id IS NOT NULL AND reviewed_at IS NOT NULL)),
  CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL)
);
CREATE INDEX projection_candidates_org_status_idx
  ON dispatch_phase21_local.projection_candidates(organization_id,status,requested_at DESC);
CREATE INDEX projection_candidates_record_idx
  ON dispatch_phase21_local.projection_candidates(source_record_id,source_revision);
CREATE INDEX projection_candidates_capability_idx
  ON dispatch_phase21_local.projection_candidates(capability_grant_id);
CREATE INDEX projection_candidates_requester_idx
  ON dispatch_phase21_local.projection_candidates(requested_by_membership_id);
CREATE INDEX projection_candidates_reviewer_idx
  ON dispatch_phase21_local.projection_candidates(reviewed_by_membership_id)
  WHERE reviewed_by_membership_id IS NOT NULL;

CREATE TABLE dispatch_phase21_local.public_safe_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL UNIQUE REFERENCES dispatch_phase21_local.projection_candidates(id) ON DELETE RESTRICT,
  organization_public_name text NOT NULL CHECK (char_length(organization_public_name) BETWEEN 2 AND 160),
  source_label text NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 120),
  consumer_taxonomy text NOT NULL CHECK (char_length(consumer_taxonomy) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  summary text NOT NULL CHECK (char_length(summary) <= 1000),
  public_location jsonb CHECK (public_location IS NULL OR jsonb_typeof(public_location)='object'),
  published_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > published_at)
);
CREATE INDEX public_safe_projections_expiry_idx
  ON dispatch_phase21_local.public_safe_projections(expires_at);

CREATE TABLE dispatch_phase21_local.dispatch_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  actor_membership_id uuid,
  event_type dispatch_phase21_local.audit_event_type NOT NULL,
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 80),
  target_id uuid,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload)='object'),
  operation_correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  FOREIGN KEY (organization_id,actor_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX dispatch_audit_events_org_time_idx
  ON dispatch_phase21_local.dispatch_audit_events(organization_id,created_at DESC);
CREATE INDEX dispatch_audit_events_actor_idx
  ON dispatch_phase21_local.dispatch_audit_events(actor_user_id,created_at DESC);
CREATE INDEX dispatch_audit_events_membership_idx
  ON dispatch_phase21_local.dispatch_audit_events(actor_membership_id)
  WHERE actor_membership_id IS NOT NULL;
CREATE UNIQUE INDEX dispatch_audit_events_correlation_type_idx
  ON dispatch_phase21_local.dispatch_audit_events(operation_correlation_id,event_type,target_id);

CREATE TABLE dispatch_phase21_local.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  from_membership_id uuid NOT NULL,
  to_membership_id uuid NOT NULL,
  initiated_by_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  status dispatch_phase21_local.ownership_transfer_status NOT NULL DEFAULT 'PENDING',
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  FOREIGN KEY (organization_id,from_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,to_membership_id)
    REFERENCES dispatch_phase21_local.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (from_membership_id <> to_membership_id),
  CHECK (expires_at > created_at),
  CHECK (status <> 'ACCEPTED' OR accepted_at IS NOT NULL),
  CHECK (status <> 'CANCELLED' OR cancelled_at IS NOT NULL)
);
CREATE UNIQUE INDEX ownership_transfers_one_pending_org_idx
  ON dispatch_phase21_local.ownership_transfers(organization_id) WHERE status='PENDING';
CREATE INDEX ownership_transfers_from_idx ON dispatch_phase21_local.ownership_transfers(from_membership_id);
CREATE INDEX ownership_transfers_to_idx ON dispatch_phase21_local.ownership_transfers(to_membership_id);
CREATE INDEX ownership_transfers_initiator_idx ON dispatch_phase21_local.ownership_transfers(initiated_by_user_id);

CREATE TABLE dispatch_phase21_local.operation_receipts (
  token_digest bytea PRIMARY KEY CHECK (octet_length(token_digest)=32),
  actor_user_id uuid NOT NULL REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  organization_id uuid REFERENCES dispatch_phase21_local.organizations(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 120),
  target_id uuid,
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest)=32),
  bounded_result text NOT NULL CHECK (char_length(bounded_result) BETWEEN 1 AND 80),
  accepted_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE INDEX operation_receipts_actor_time_idx
  ON dispatch_phase21_local.operation_receipts(actor_user_id,accepted_at DESC);
CREATE INDEX operation_receipts_org_time_idx
  ON dispatch_phase21_local.operation_receipts(organization_id,accepted_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE TABLE dispatch_phase21_local.local_actor_bindings (
  session_role name PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES dispatch_phase21_local.profiles(user_id) ON DELETE RESTRICT,
  note text NOT NULL DEFAULT 'TEST HARNESS ACTOR - NOT PRODUCTION AUTH'
);

INSERT INTO dispatch_phase21_local.role_templates(role_key,description) VALUES
  ('OWNER','Exactly one accountable organization controller'),
  ('ORGANIZATION_ADMIN','Organization membership and settings administrator'),
  ('SUPERVISOR','Operational reviewer and assignment authority'),
  ('OPERATOR','Operational record creator and updater'),
  ('VIEWER','Bounded read-only organization member');

INSERT INTO dispatch_phase21_local.permissions(permission_key,description,scope_class) VALUES
  ('organization.read','Read bounded organization context','ORGANIZATION'),
  ('organization.manage','Manage bounded organization profile and type requests','ORGANIZATION'),
  ('members.read','Read bounded organization roster','ORGANIZATION'),
  ('members.invite','Create or revoke invitations','ORGANIZATION'),
  ('members.manage','Manage non-owner membership state and roles','ORGANIZATION'),
  ('ownership.transfer','Initiate or accept ownership transfer','ORGANIZATION'),
  ('scope.read','Read bounded operational scope summaries','ORGANIZATION'),
  ('scope.manage','Request or manage private operational scopes','ORGANIZATION'),
  ('operations.read','Read permitted private operational records','ORGANIZATION'),
  ('operations.create','Create private operational records','ORGANIZATION'),
  ('operations.update','Update permitted private operational records','ORGANIZATION'),
  ('operations.assign','Assign private operational records','ORGANIZATION'),
  ('operations.close','Close or cancel operational records','ORGANIZATION'),
  ('awareness.read','Read source-separated awareness context','ORGANIZATION'),
  ('projection.submit','Submit a projection candidate','ORGANIZATION'),
  ('projection.review','Approve or reject a projection candidate','ORGANIZATION'),
  ('projection.publish','Publish or withdraw an approved projection','ORGANIZATION'),
  ('audit.read','Read bounded organization audit history','ORGANIZATION'),
  ('settings.read','Read bounded organization settings','ORGANIZATION'),
  ('settings.manage','Manage non-authority organization settings','ORGANIZATION'),
  ('platform.organization.verify','Verify organization identity','PLATFORM'),
  ('platform.organization.suspend','Suspend or reinstate organizations','PLATFORM'),
  ('platform.capability.manage','Grant, suspend, or revoke capabilities','PLATFORM'),
  ('platform.ownership.recover','Recover orphaned ownership under two-person governance','PLATFORM'),
  ('platform.audit.investigate','Investigate bounded platform audit evidence','PLATFORM'),
  ('platform.abuse.manage','Manage platform abuse holds','PLATFORM');

INSERT INTO dispatch_phase21_local.role_permissions(role_key,permission_key)
SELECT r.role_key,p.permission_key
FROM dispatch_phase21_local.role_templates r
JOIN dispatch_phase21_local.permissions p ON p.scope_class='ORGANIZATION'
WHERE r.role_key='OWNER';

INSERT INTO dispatch_phase21_local.role_permissions(role_key,permission_key)
SELECT 'ORGANIZATION_ADMIN', permission_key FROM dispatch_phase21_local.permissions
WHERE scope_class='ORGANIZATION' AND permission_key <> 'ownership.transfer';

INSERT INTO dispatch_phase21_local.role_permissions(role_key,permission_key) VALUES
  ('SUPERVISOR','organization.read'),('SUPERVISOR','members.read'),('SUPERVISOR','scope.read'),
  ('SUPERVISOR','operations.read'),('SUPERVISOR','operations.create'),('SUPERVISOR','operations.update'),
  ('SUPERVISOR','operations.assign'),('SUPERVISOR','operations.close'),('SUPERVISOR','awareness.read'),
  ('SUPERVISOR','projection.submit'),('SUPERVISOR','projection.review'),('SUPERVISOR','projection.publish'),
  ('SUPERVISOR','audit.read'),('SUPERVISOR','settings.read'),
  ('OPERATOR','organization.read'),('OPERATOR','scope.read'),('OPERATOR','operations.read'),
  ('OPERATOR','operations.create'),('OPERATOR','operations.update'),('OPERATOR','awareness.read'),
  ('OPERATOR','projection.submit'),('OPERATOR','settings.read'),
  ('VIEWER','organization.read'),('VIEWER','scope.read'),('VIEWER','operations.read'),
  ('VIEWER','awareness.read'),('VIEWER','settings.read');

CREATE FUNCTION dispatch_phase21_local.reject_append_only_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'phase21 append-only relation cannot be mutated'; END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.reject_append_only_mutation() FROM PUBLIC;

CREATE FUNCTION dispatch_phase21_local.enforce_record_revision_step()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.organization_id <> OLD.organization_id OR NEW.id <> OLD.id THEN
    RAISE EXCEPTION 'record identity and tenant are immutable';
  END IF;
  IF NEW.current_revision <> OLD.current_revision + 1 THEN
    RAISE EXCEPTION 'record revision must advance exactly one';
  END IF;
  IF OLD.status IN ('CLOSED','CANCELLED') THEN RAISE EXCEPTION 'terminal record is immutable'; END IF;
  IF NOT (
    (OLD.status='DRAFT' AND NEW.status IN ('DRAFT','OPEN','CANCELLED')) OR
    (OLD.status='OPEN' AND NEW.status IN ('OPEN','IN_PROGRESS','MONITORING','CLOSED','CANCELLED')) OR
    (OLD.status='IN_PROGRESS' AND NEW.status IN ('IN_PROGRESS','MONITORING','CLOSED','CANCELLED')) OR
    (OLD.status='MONITORING' AND NEW.status IN ('MONITORING','IN_PROGRESS','CLOSED','CANCELLED'))
  ) THEN
    RAISE EXCEPTION 'invalid record lifecycle transition';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.enforce_record_revision_step() FROM PUBLIC;
CREATE TRIGGER operational_records_revision_step
BEFORE UPDATE ON dispatch_phase21_local.operational_records
FOR EACH ROW EXECUTE FUNCTION dispatch_phase21_local.enforce_record_revision_step();

CREATE FUNCTION dispatch_phase21_local.enforce_exactly_one_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_org uuid; v_status dispatch_phase21_local.organization_status; v_count integer;
BEGIN
  IF TG_TABLE_NAME='organizations' THEN
    v_org := COALESCE(NEW.id,OLD.id);
  ELSE
    v_org := COALESCE(NEW.organization_id,OLD.organization_id);
  END IF;
  SELECT status INTO v_status FROM dispatch_phase21_local.organizations WHERE id=v_org;
  IF NOT FOUND OR v_status='CLOSED' THEN RETURN NULL; END IF;
  SELECT count(*) INTO v_count FROM dispatch_phase21_local.organization_memberships
    WHERE organization_id=v_org AND status='ACTIVE' AND role_template='OWNER'
      AND (expires_at IS NULL OR expires_at > statement_timestamp());
  IF v_count <> 1 THEN RAISE EXCEPTION 'non-closed organization requires exactly one active owner'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.enforce_exactly_one_owner() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER organizations_exactly_one_owner
AFTER INSERT OR UPDATE OF status ON dispatch_phase21_local.organizations
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION dispatch_phase21_local.enforce_exactly_one_owner();
CREATE CONSTRAINT TRIGGER memberships_exactly_one_owner
AFTER INSERT OR UPDATE OR DELETE ON dispatch_phase21_local.organization_memberships
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
EXECUTE FUNCTION dispatch_phase21_local.enforce_exactly_one_owner();

CREATE TRIGGER revisions_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase21_local.record_revisions
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase21_local.reject_append_only_mutation();
CREATE TRIGGER provenance_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase21_local.record_provenance
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase21_local.reject_append_only_mutation();
CREATE TRIGGER audit_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase21_local.dispatch_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase21_local.reject_append_only_mutation();
CREATE TRIGGER receipts_append_only
BEFORE UPDATE OR DELETE OR TRUNCATE ON dispatch_phase21_local.operation_receipts
FOR EACH STATEMENT EXECUTE FUNCTION dispatch_phase21_local.reject_append_only_mutation();

CREATE FUNCTION dispatch_phase21_local.current_actor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT user_id FROM dispatch_phase21_local.local_actor_bindings WHERE session_role=session_user
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.current_actor_id() FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.current_actor_id() TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.requested_organization_id()
RETURNS uuid LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE v text;
BEGIN
  v := pg_catalog.current_setting('dispatch_phase21.requested_organization',true);
  IF v IS NULL OR v='' THEN RETURN NULL; END IF;
  RETURN v::uuid;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.requested_organization_id() FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.requested_organization_id() TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.has_permission(p_organization_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM dispatch_phase21_local.organization_memberships m
    JOIN dispatch_phase21_local.organizations o ON o.id=m.organization_id
    JOIN dispatch_phase21_local.role_permissions rp ON rp.role_key=m.role_template
    JOIN dispatch_phase21_local.permissions p ON p.permission_key=rp.permission_key
    WHERE m.user_id=dispatch_phase21_local.current_actor_id()
      AND m.organization_id=p_organization_id AND m.status='ACTIVE'
      AND (m.expires_at IS NULL OR m.expires_at > statement_timestamp())
      AND o.status='ACTIVE' AND p.permission_key=p_permission AND p.scope_class='ORGANIZATION')
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.has_permission(uuid,text) FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.has_permission(uuid,text) TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.can_user_access_organization(p_organization_id uuid,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE(
    p_organization_id=dispatch_phase21_local.requested_organization_id()
      AND dispatch_phase21_local.has_permission(p_organization_id,p_permission),
    false)
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.can_user_access_organization(uuid,text) FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.can_user_access_organization(uuid,text) TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.has_platform_permission(p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM dispatch_phase21_local.platform_admin_grants g
    JOIN dispatch_phase21_local.permissions p ON p.permission_key=g.permission_key
    WHERE g.user_id=dispatch_phase21_local.current_actor_id() AND g.active
      AND p.permission_key=p_permission AND p.scope_class='PLATFORM')
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.has_platform_permission(text) FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.has_platform_permission(text) TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.scope_allows(p_organization_id uuid,p_scope_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (SELECT 1 FROM dispatch_phase21_local.operational_scopes s
    JOIN dispatch_phase21_local.organizations o ON o.id=s.organization_id
    WHERE s.id=p_scope_id AND s.organization_id=p_organization_id AND s.status='ACTIVE'
      AND s.valid_from <= statement_timestamp()
      AND (s.valid_until IS NULL OR s.valid_until > statement_timestamp())
      AND o.status='ACTIVE')
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.scope_allows(uuid,uuid) FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.scope_allows(uuid,uuid) TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.capability_allows(
  p_organization_id uuid,p_capability text,p_scope_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT EXISTS (
    SELECT 1 FROM dispatch_phase21_local.capability_grants g
    JOIN dispatch_phase21_local.organizations o ON o.id=g.organization_id
    WHERE g.organization_id=p_organization_id AND g.operational_scope_id=p_scope_id
      AND g.capability_key=p_capability AND g.status='ACTIVE'
      AND g.valid_from <= statement_timestamp()
      AND (g.valid_until IS NULL OR g.valid_until > statement_timestamp())
      AND dispatch_phase21_local.scope_allows(p_organization_id,p_scope_id)
      AND CASE g.required_verification
        WHEN 'UNVERIFIED' THEN true
        WHEN 'VERIFIED_ORGANIZATION' THEN o.verification_level IN ('VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY')
        WHEN 'VERIFIED_PUBLIC_ENTITY' THEN o.verification_level='VERIFIED_PUBLIC_ENTITY'
      END)
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.capability_allows(uuid,text,uuid)
  FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.capability_allows(uuid,text,uuid)
  TO dispatch_phase21_app;

CREATE FUNCTION dispatch_phase21_local.projection_candidate_is_eligible(p_candidate_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT COALESCE((SELECT c.status='APPROVED' AND c.freshness_deadline > statement_timestamp()
    AND g.status='ACTIVE' AND g.valid_from <= statement_timestamp()
    AND (g.valid_until IS NULL OR g.valid_until > statement_timestamp())
    AND s.status='ACTIVE' AND s.valid_from <= statement_timestamp()
    AND (s.valid_until IS NULL OR s.valid_until > statement_timestamp())
    AND o.status='ACTIVE'
    AND r.operational_scope_id=g.operational_scope_id
    AND r.current_revision=c.source_revision
    AND CASE g.required_verification
      WHEN 'UNVERIFIED' THEN true
      WHEN 'VERIFIED_ORGANIZATION' THEN o.verification_level IN ('VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY')
      WHEN 'VERIFIED_PUBLIC_ENTITY' THEN o.verification_level='VERIFIED_PUBLIC_ENTITY'
    END
  FROM dispatch_phase21_local.projection_candidates c
  JOIN dispatch_phase21_local.operational_records r ON r.id=c.source_record_id AND r.organization_id=c.organization_id
  JOIN dispatch_phase21_local.capability_grants g ON g.id=c.capability_grant_id AND g.organization_id=c.organization_id
  JOIN dispatch_phase21_local.operational_scopes s ON s.id=g.operational_scope_id AND s.organization_id=g.organization_id
  JOIN dispatch_phase21_local.organizations o ON o.id=c.organization_id
  WHERE c.id=p_candidate_id),false)
$$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.projection_candidate_is_eligible(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.projection_candidate_is_eligible(uuid)
  TO dispatch_phase21_app,dispatch_phase21_public;

CREATE FUNCTION dispatch_phase21_local.enforce_public_projection_eligibility()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NOT dispatch_phase21_local.projection_candidate_is_eligible(NEW.candidate_id) THEN
    RAISE EXCEPTION 'projection candidate is not currently eligible';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.enforce_public_projection_eligibility() FROM PUBLIC;
CREATE TRIGGER public_projection_eligibility
BEFORE INSERT ON dispatch_phase21_local.public_safe_projections
FOR EACH ROW EXECUTE FUNCTION dispatch_phase21_local.enforce_public_projection_eligibility();

CREATE FUNCTION dispatch_phase21_local.local_accept_ownership_transfer(p_transfer_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid; v_transfer dispatch_phase21_local.ownership_transfers%ROWTYPE;
  v_from dispatch_phase21_local.organization_memberships%ROWTYPE;
  v_to dispatch_phase21_local.organization_memberships%ROWTYPE;
BEGIN
  v_actor := dispatch_phase21_local.current_actor_id();
  SELECT * INTO v_transfer FROM dispatch_phase21_local.ownership_transfers
    WHERE id=p_transfer_id FOR UPDATE;
  IF NOT FOUND OR v_transfer.status<>'PENDING' OR v_transfer.expires_at<=statement_timestamp() THEN
    RETURN 'forbidden';
  END IF;
  PERFORM 1 FROM dispatch_phase21_local.organizations WHERE id=v_transfer.organization_id AND status='ACTIVE' FOR UPDATE;
  IF NOT FOUND THEN RETURN 'forbidden'; END IF;
  PERFORM 1 FROM dispatch_phase21_local.organization_memberships
    WHERE id IN (v_transfer.from_membership_id,v_transfer.to_membership_id) ORDER BY id FOR UPDATE;
  SELECT * INTO v_from FROM dispatch_phase21_local.organization_memberships WHERE id=v_transfer.from_membership_id;
  SELECT * INTO v_to FROM dispatch_phase21_local.organization_memberships WHERE id=v_transfer.to_membership_id;
  IF v_to.user_id<>v_actor OR v_to.status<>'ACTIVE' OR v_to.role_template<>'ORGANIZATION_ADMIN'
     OR v_from.status<>'ACTIVE' OR v_from.role_template<>'OWNER' THEN RETURN 'forbidden'; END IF;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='ORGANIZATION_ADMIN',revision=revision+1,
    updated_at=statement_timestamp() WHERE id=v_from.id;
  UPDATE dispatch_phase21_local.organization_memberships SET role_template='OWNER',revision=revision+1,
    updated_at=statement_timestamp() WHERE id=v_to.id;
  UPDATE dispatch_phase21_local.ownership_transfers SET status='ACCEPTED',accepted_at=statement_timestamp()
    WHERE id=v_transfer.id;
  INSERT INTO dispatch_phase21_local.dispatch_audit_events
    (organization_id,actor_user_id,actor_membership_id,event_type,target_type,target_id,event_payload,operation_correlation_id)
  VALUES (v_transfer.organization_id,v_actor,v_to.id,'OWNERSHIP_TRANSFERRED','organization',
    v_transfer.organization_id,pg_catalog.jsonb_build_object('from_membership_id',v_from.id,'to_membership_id',v_to.id),
    gen_random_uuid());
  RETURN 'accepted';
END $$;
REVOKE ALL ON FUNCTION dispatch_phase21_local.local_accept_ownership_transfer(uuid)
  FROM PUBLIC, dispatch_phase21_public;
GRANT EXECUTE ON FUNCTION dispatch_phase21_local.local_accept_ownership_transfer(uuid)
  TO dispatch_phase21_app;

ALTER TABLE dispatch_phase21_local.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organization_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.organization_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operational_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operational_scopes FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.platform_admin_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.platform_admin_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.capability_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.capability_grants FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operational_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operational_records FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.record_provenance FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.projection_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.projection_candidates FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.public_safe_projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.public_safe_projections FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.dispatch_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.dispatch_audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.ownership_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.ownership_transfers FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operation_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.operation_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.local_actor_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_phase21_local.local_actor_bindings FORCE ROW LEVEL SECURITY;

CREATE POLICY profiles_self_read ON dispatch_phase21_local.profiles FOR SELECT TO dispatch_phase21_app
  USING (user_id=dispatch_phase21_local.current_actor_id());
CREATE POLICY organizations_member_read ON dispatch_phase21_local.organizations FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(id,'organization.read'));
CREATE POLICY memberships_scoped_read ON dispatch_phase21_local.organization_memberships FOR SELECT TO dispatch_phase21_app
  USING (organization_id=dispatch_phase21_local.requested_organization_id()
    AND (user_id=dispatch_phase21_local.current_actor_id()
      OR dispatch_phase21_local.has_permission(organization_id,'members.read')));
CREATE POLICY invitations_admin_read ON dispatch_phase21_local.organization_invitations FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'members.read'));
CREATE POLICY scopes_member_read ON dispatch_phase21_local.operational_scopes FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'scope.read'));
CREATE POLICY capabilities_settings_read ON dispatch_phase21_local.capability_grants FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'settings.read'));
CREATE POLICY records_member_read ON dispatch_phase21_local.operational_records FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'operations.read'));
CREATE POLICY revisions_member_read ON dispatch_phase21_local.record_revisions FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'operations.read'));
CREATE POLICY assignments_member_read ON dispatch_phase21_local.record_assignments FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'operations.read'));
CREATE POLICY provenance_member_read ON dispatch_phase21_local.record_provenance FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'operations.read'));
CREATE POLICY candidates_member_read ON dispatch_phase21_local.projection_candidates FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'awareness.read'));
CREATE POLICY audit_privileged_read ON dispatch_phase21_local.dispatch_audit_events FOR SELECT TO dispatch_phase21_app
  USING (organization_id IS NOT NULL
    AND dispatch_phase21_local.can_user_access_organization(organization_id,'audit.read'));
CREATE POLICY transfers_party_read ON dispatch_phase21_local.ownership_transfers FOR SELECT TO dispatch_phase21_app
  USING (dispatch_phase21_local.can_user_access_organization(organization_id,'organization.read'));
CREATE POLICY public_projection_current_read ON dispatch_phase21_local.public_safe_projections
  FOR SELECT TO dispatch_phase21_public USING (
    expires_at > statement_timestamp()
    AND dispatch_phase21_local.projection_candidate_is_eligible(candidate_id));

REVOKE ALL ON ALL TABLES IN SCHEMA dispatch_phase21_local FROM PUBLIC, dispatch_phase21_app, dispatch_phase21_public;
GRANT SELECT ON dispatch_phase21_local.role_templates,dispatch_phase21_local.permissions,
  dispatch_phase21_local.role_permissions,dispatch_phase21_local.profiles,
  dispatch_phase21_local.organizations,dispatch_phase21_local.organization_memberships,
  dispatch_phase21_local.organization_invitations,dispatch_phase21_local.operational_scopes,
  dispatch_phase21_local.capability_grants,dispatch_phase21_local.operational_records,
  dispatch_phase21_local.record_revisions,dispatch_phase21_local.record_assignments,
  dispatch_phase21_local.record_provenance,dispatch_phase21_local.projection_candidates,
  dispatch_phase21_local.dispatch_audit_events,dispatch_phase21_local.ownership_transfers
  TO dispatch_phase21_app;
GRANT SELECT ON dispatch_phase21_local.public_safe_projections TO dispatch_phase21_public;

COMMIT;
