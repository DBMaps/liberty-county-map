-- DESIGN ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
-- PHASE25_INERT_SQL_BEGIN
/*
PHASE25_EXPECTED_SCHEMA_COUNT=4
PHASE25_EXPECTED_TYPE_COUNT=23
PHASE25_EXPECTED_TABLE_COUNT=22
PHASE25_EXPECTED_PERMISSION_COUNT=26
PHASE25_EXPECTED_CAPABILITY_COUNT=5

CREATE SCHEMA dispatch_private;
CREATE SCHEMA dispatch_audit;
CREATE SCHEMA dispatch_projection;
CREATE SCHEMA dispatch_api;

CREATE TYPE dispatch_private.profile_status AS ENUM ('ACTIVE','DISABLED');
CREATE TYPE dispatch_private.organization_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE dispatch_private.organization_type AS ENUM
  ('FIRE','EMS','LAW_ENFORCEMENT','EMERGENCY_MANAGEMENT','UTILITY','FLEET','TRUCKING',
   'MUNICIPALITY','SCHOOL_DISTRICT','CONTRACTOR','PRIVATE_COMPANY','INDUSTRIAL_OPERATOR',
   'TRANSPORTATION_OPERATOR','INFRASTRUCTURE_OPERATOR','OTHER');
CREATE TYPE dispatch_private.verification_level AS ENUM
  ('UNVERIFIED','VERIFIED_ORGANIZATION','VERIFIED_PUBLIC_ENTITY');
CREATE TYPE dispatch_private.membership_status AS ENUM ('INVITED','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.role_template_key AS ENUM
  ('OWNER','ORGANIZATION_ADMIN','SUPERVISOR','OPERATOR','VIEWER');
CREATE TYPE dispatch_private.invitation_status AS ENUM
  ('PENDING','ACCEPTED','DECLINED','EXPIRED','REVOKED');
CREATE TYPE dispatch_private.permission_scope AS ENUM ('ORGANIZATION','PLATFORM');
CREATE TYPE dispatch_private.scope_type AS ENUM
  ('COUNTY','MULTI_COUNTY','STATEWIDE','SERVICE_TERRITORY','CORRIDOR','ROUTE','FACILITY','SITE','NON_GEOGRAPHIC');
CREATE TYPE dispatch_private.scope_status AS ENUM ('ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.capability_status AS ENUM ('PENDING','ACTIVE','SUSPENDED','REVOKED');
CREATE TYPE dispatch_private.record_type AS ENUM ('CONDITION','HAZARD','PLANNED_WORK','OPERATIONAL_NOTICE');
CREATE TYPE dispatch_private.record_status AS ENUM
  ('DRAFT','OPEN','IN_PROGRESS','MONITORING','CLOSED','CANCELLED');
CREATE TYPE dispatch_private.record_priority AS ENUM ('LOW','NORMAL','HIGH','CRITICAL');
CREATE TYPE dispatch_private.assignment_status AS ENUM ('ASSIGNED','CLEARED');
CREATE TYPE dispatch_private.source_class AS ENUM
  ('COMMUNITY','OFFICIAL_PUBLIC','ORGANIZATION','PRIVATE_OPERATIONAL');
CREATE TYPE dispatch_private.visibility_class AS ENUM
  ('PRIVATE','ORGANIZATION','PROJECTION_CANDIDATE','PUBLIC_PROJECTION');
CREATE TYPE dispatch_private.review_state AS ENUM
  ('NOT_SUBMITTED','PENDING_REVIEW','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_private.projection_status AS ENUM ('SUBMITTED','APPROVED','REJECTED','WITHDRAWN');
CREATE TYPE dispatch_private.ownership_transfer_status AS ENUM ('PENDING','ACCEPTED','CANCELLED');
CREATE TYPE dispatch_private.recovery_status AS ENUM ('FIRST_APPROVED','RECOVERED','CANCELLED');
CREATE TYPE dispatch_audit.receipt_status AS ENUM ('ACCEPTED');
CREATE TYPE dispatch_private.audit_event_type AS ENUM
  ('ORGANIZATION_CREATED','ORGANIZATION_UPDATED','ORGANIZATION_ACTIVATED','ORGANIZATION_SUSPENDED',
   'ORGANIZATION_REINSTATED','ORGANIZATION_CLOSED','MEMBER_INVITED','INVITATION_ACCEPTED',
   'INVITATION_DECLINED','INVITATION_EXPIRED','MEMBER_SUSPENDED','MEMBER_REACTIVATED',
   'MEMBER_REVOKED','MEMBERSHIP_LEFT','ROLE_CHANGED','OWNERSHIP_TRANSFER_INITIATED',
   'OWNERSHIP_TRANSFER_CANCELLED','OWNERSHIP_TRANSFERRED','OWNERSHIP_RECOVERED','SCOPE_GRANTED',
   'SCOPE_REVOKED','CAPABILITY_GRANTED','CAPABILITY_SUSPENDED','CAPABILITY_REVOKED',
   'RECORD_CREATED','RECORD_UPDATED','RECORD_ASSIGNED','RECORD_CLOSED','RECORD_CANCELLED',
   'PROJECTION_SUBMITTED','PROJECTION_APPROVED','PROJECTION_REJECTED','PROJECTION_PUBLISHED',
   'PROJECTION_WITHDRAWN','SETTINGS_CHANGED');

CREATE TABLE dispatch_private.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  status dispatch_private.profile_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE dispatch_private.organizations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 160),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  organization_type dispatch_private.organization_type NOT NULL,
  status dispatch_private.organization_status NOT NULL DEFAULT 'PENDING',
  verification_level dispatch_private.verification_level NOT NULL DEFAULT 'UNVERIFIED',
  verification_reference text,
  verification_reviewed_at timestamptz,
  governance_revision integer NOT NULL DEFAULT 0 CHECK (governance_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp()
);

CREATE TABLE dispatch_private.role_templates (
  role_key dispatch_private.role_template_key PRIMARY KEY,
  description text NOT NULL,
  fixed boolean NOT NULL DEFAULT true CHECK (fixed)
);
CREATE TABLE dispatch_private.permissions (
  permission_key text PRIMARY KEY CHECK (permission_key ~ '^[a-z]+([._][a-z]+)+$'),
  description text NOT NULL,
  scope_class dispatch_private.permission_scope NOT NULL
);
CREATE TABLE dispatch_private.role_permissions (
  role_key dispatch_private.role_template_key NOT NULL REFERENCES dispatch_private.role_templates(role_key) ON DELETE RESTRICT,
  permission_key text NOT NULL REFERENCES dispatch_private.permissions(permission_key) ON DELETE RESTRICT,
  PRIMARY KEY (role_key,permission_key)
);

CREATE TABLE dispatch_private.organization_memberships (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES dispatch_private.profiles(user_id) ON DELETE RESTRICT,
  status dispatch_private.membership_status NOT NULL DEFAULT 'INVITED',
  role_template dispatch_private.role_template_key NOT NULL,
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
  ON dispatch_private.organization_memberships(organization_id,user_id)
  WHERE status IN ('INVITED','ACTIVE','SUSPENDED');
CREATE UNIQUE INDEX organization_memberships_one_owner_idx
  ON dispatch_private.organization_memberships(organization_id)
  WHERE status='ACTIVE' AND role_template='OWNER';
CREATE INDEX organization_memberships_user_org_status_idx
  ON dispatch_private.organization_memberships(user_id,organization_id,status);

CREATE TABLE dispatch_private.organization_invitations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  email_or_identity_target text NOT NULL CHECK (char_length(email_or_identity_target) BETWEEN 3 AND 254),
  role_template dispatch_private.role_template_key NOT NULL CHECK (role_template <> 'OWNER'),
  token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest)=32),
  status dispatch_private.invitation_status NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  created_by_membership_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  FOREIGN KEY (organization_id,created_by_membership_id)
    REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (status <> 'ACCEPTED' OR accepted_at IS NOT NULL),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX organization_invitations_one_pending_target_idx
  ON dispatch_private.organization_invitations(organization_id,lower(email_or_identity_target)) WHERE status='PENDING';
CREATE INDEX organization_invitations_org_status_expiry_idx
  ON dispatch_private.organization_invitations(organization_id,status,expires_at);

CREATE TABLE dispatch_private.operational_scopes (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  scope_type dispatch_private.scope_type NOT NULL,
  status dispatch_private.scope_status NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 160),
  jurisdiction_code text,
  representation_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  source_reference text NOT NULL CHECK (char_length(source_reference) BETWEEN 1 AND 240),
  source_version text NOT NULL CHECK (char_length(source_version) BETWEEN 1 AND 160),
  review_reference text NOT NULL CHECK (char_length(review_reference) BETWEEN 1 AND 240),
  valid_from timestamptz NOT NULL DEFAULT statement_timestamp(),
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  UNIQUE (organization_id,id), UNIQUE (id,version),
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE TABLE dispatch_private.operational_scope_members (
  operational_scope_id uuid NOT NULL,
  scope_version integer NOT NULL,
  ordinal integer NOT NULL CHECK (ordinal >= 0),
  member_kind text NOT NULL CHECK (member_kind IN ('COUNTY_FIPS','SEGMENT_ID','STOP_ID','FACILITY_ID','SITE_ID')),
  member_identifier text NOT NULL CHECK (char_length(member_identifier) BETWEEN 1 AND 200),
  source_version text NOT NULL,
  PRIMARY KEY (operational_scope_id,scope_version,member_kind,member_identifier),
  UNIQUE (operational_scope_id,scope_version,ordinal),
  FOREIGN KEY (operational_scope_id,scope_version)
    REFERENCES dispatch_private.operational_scopes(id,version) ON DELETE RESTRICT
);

CREATE TABLE dispatch_private.platform_admin_grants (
  user_id uuid NOT NULL REFERENCES dispatch_private.profiles(user_id) ON DELETE RESTRICT,
  permission_key text NOT NULL REFERENCES dispatch_private.permissions(permission_key) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  granted_by_user_id uuid NOT NULL REFERENCES dispatch_private.profiles(user_id) ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  PRIMARY KEY (user_id,permission_key),
  CHECK (active OR revoked_at IS NOT NULL)
);

CREATE TABLE dispatch_private.capability_grants (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  capability_key text NOT NULL CHECK (capability_key IN
    ('awareness.condition.publish','awareness.hazard.publish','awareness.planned_work.publish',
     'awareness.official_notice.publish','awareness.road_closure.publish')),
  operational_scope_id uuid NOT NULL,
  operational_scope_version integer NOT NULL,
  status dispatch_private.capability_status NOT NULL DEFAULT 'PENDING',
  required_verification dispatch_private.verification_level NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_until timestamptz,
  granted_by_platform_actor uuid NOT NULL REFERENCES dispatch_private.profiles(user_id) ON DELETE RESTRICT,
  revoked_by_platform_actor uuid REFERENCES dispatch_private.profiles(user_id) ON DELETE RESTRICT,
  governance_reference text NOT NULL CHECK (char_length(governance_reference) BETWEEN 1 AND 240),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  revoked_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (operational_scope_id,operational_scope_version)
    REFERENCES dispatch_private.operational_scopes(id,version) ON DELETE RESTRICT,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK (status <> 'REVOKED' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX capability_grants_one_live_binding_idx
  ON dispatch_private.capability_grants(organization_id,capability_key,operational_scope_id,operational_scope_version)
  WHERE status IN ('PENDING','ACTIVE','SUSPENDED');

CREATE TABLE dispatch_private.operational_records (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  record_type dispatch_private.record_type NOT NULL,
  status dispatch_private.record_status NOT NULL DEFAULT 'DRAFT',
  priority dispatch_private.record_priority NOT NULL DEFAULT 'NORMAL',
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  operational_scope_id uuid NOT NULL,
  operational_scope_version integer NOT NULL,
  location jsonb CHECK (location IS NULL OR jsonb_typeof(location)='object'),
  created_by_membership_id uuid NOT NULL,
  current_revision integer NOT NULL DEFAULT 0 CHECK (current_revision >= 0),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  closed_at timestamptz,
  UNIQUE (organization_id,id),
  FOREIGN KEY (operational_scope_id,operational_scope_version)
    REFERENCES dispatch_private.operational_scopes(id,version) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,created_by_membership_id)
    REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK ((status IN ('CLOSED','CANCELLED')) = (closed_at IS NOT NULL))
);
CREATE INDEX operational_records_org_status_updated_idx
  ON dispatch_private.operational_records(organization_id,status,updated_at DESC);

CREATE TABLE dispatch_audit.record_revisions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number >= 0),
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  payload_snapshot jsonb NOT NULL CHECK (jsonb_typeof(payload_snapshot)='object'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (record_id,revision_number), UNIQUE (organization_id,record_id,revision_number),
  FOREIGN KEY (organization_id,record_id)
    REFERENCES dispatch_private.operational_records(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,actor_membership_id)
    REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
ALTER TABLE dispatch_private.operational_records ADD CONSTRAINT operational_records_current_revision_fk
  FOREIGN KEY (organization_id,id,current_revision)
  REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE dispatch_private.record_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  assigned_membership_id uuid NOT NULL,
  assigned_by_membership_id uuid NOT NULL,
  status dispatch_private.assignment_status NOT NULL DEFAULT 'ASSIGNED',
  assigned_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  cleared_at timestamptz,
  FOREIGN KEY (organization_id,record_id) REFERENCES dispatch_private.operational_records(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,assigned_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,assigned_by_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK ((status='CLEARED')=(cleared_at IS NOT NULL))
);
CREATE UNIQUE INDEX record_assignments_one_current_idx
  ON dispatch_private.record_assignments(record_id) WHERE status='ASSIGNED';

CREATE TABLE dispatch_private.record_provenance (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL,
  record_id uuid NOT NULL,
  revision_number integer NOT NULL,
  author_user_id uuid NOT NULL,
  membership_id uuid NOT NULL,
  source_class dispatch_private.source_class NOT NULL,
  verification_level dispatch_private.verification_level NOT NULL,
  capability_grant_id uuid,
  operational_scope_id uuid NOT NULL,
  operational_scope_version integer NOT NULL,
  visibility dispatch_private.visibility_class NOT NULL DEFAULT 'PRIVATE',
  review_state dispatch_private.review_state NOT NULL DEFAULT 'NOT_SUBMITTED',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (record_id,revision_number),
  FOREIGN KEY (organization_id,record_id,revision_number)
    REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,membership_id)
    REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,capability_grant_id)
    REFERENCES dispatch_private.capability_grants(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (operational_scope_id,operational_scope_version)
    REFERENCES dispatch_private.operational_scopes(id,version) ON DELETE RESTRICT
);

CREATE TABLE dispatch_private.ownership_transfers (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  from_membership_id uuid NOT NULL,
  to_membership_id uuid NOT NULL,
  initiated_by_user_id uuid NOT NULL,
  status dispatch_private.ownership_transfer_status NOT NULL DEFAULT 'PENDING',
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  accepted_at timestamptz,
  cancelled_at timestamptz,
  FOREIGN KEY (organization_id,from_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,to_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (from_membership_id<>to_membership_id), CHECK (expires_at>created_at)
);
CREATE UNIQUE INDEX ownership_transfers_one_pending_org_idx
  ON dispatch_private.ownership_transfers(organization_id) WHERE status='PENDING';

CREATE TABLE dispatch_private.ownership_recovery_cases (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  target_membership_id uuid NOT NULL,
  organization_revision integer NOT NULL CHECK (organization_revision>=0),
  status dispatch_private.recovery_status NOT NULL DEFAULT 'FIRST_APPROVED',
  evidence_reference text NOT NULL CHECK (char_length(evidence_reference) BETWEEN 1 AND 240),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 1000),
  first_approver_user_id uuid NOT NULL,
  second_approver_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  recovered_at timestamptz,
  FOREIGN KEY (organization_id,target_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT,
  CHECK (second_approver_user_id IS NULL OR second_approver_user_id<>first_approver_user_id),
  CHECK ((status='RECOVERED')=(recovered_at IS NOT NULL))
);
CREATE UNIQUE INDEX ownership_recovery_one_open_org_idx
  ON dispatch_private.ownership_recovery_cases(organization_id) WHERE status='FIRST_APPROVED';

CREATE TABLE dispatch_private.recovery_approvals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recovery_case_id uuid NOT NULL REFERENCES dispatch_private.ownership_recovery_cases(id) ON DELETE RESTRICT,
  approver_user_id uuid NOT NULL,
  approval_order smallint NOT NULL CHECK (approval_order IN (1,2)),
  session_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  UNIQUE (recovery_case_id,approver_user_id), UNIQUE (recovery_case_id,approval_order)
);

CREATE TABLE dispatch_audit.command_receipts (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  organization_id uuid REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  command_name text NOT NULL CHECK (char_length(command_name) BETWEEN 1 AND 120),
  idempotency_key uuid NOT NULL,
  request_hash bytea NOT NULL CHECK (octet_length(request_hash)=32),
  result_ref uuid NOT NULL,
  result_payload jsonb NOT NULL CHECK (jsonb_typeof(result_payload)='object'),
  status dispatch_audit.receipt_status NOT NULL DEFAULT 'ACCEPTED',
  created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE UNIQUE INDEX command_receipts_org_key_idx ON dispatch_audit.command_receipts
  (organization_id,actor_user_id,command_name,idempotency_key) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX command_receipts_platform_key_idx ON dispatch_audit.command_receipts
  (actor_user_id,command_name,idempotency_key) WHERE organization_id IS NULL;

CREATE TABLE dispatch_audit.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid REFERENCES dispatch_private.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  actor_membership_id uuid,
  platform_permission text,
  event_type dispatch_private.audit_event_type NOT NULL,
  target_type text NOT NULL CHECK (char_length(target_type) BETWEEN 1 AND 80),
  target_id uuid,
  target_revision integer,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_payload)='object'),
  operation_correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  FOREIGN KEY (organization_id,actor_membership_id) REFERENCES dispatch_private.organization_memberships(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX audit_events_correlation_type_target_idx
  ON dispatch_audit.audit_events(operation_correlation_id,event_type,target_id);

CREATE TABLE dispatch_projection.projection_candidates (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  source_record_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  source_revision integer NOT NULL,
  capability_grant_id uuid NOT NULL,
  capability_grant_revision integer NOT NULL,
  status dispatch_private.projection_status NOT NULL DEFAULT 'SUBMITTED',
  requested_by_membership_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  reviewed_by_membership_id uuid,
  reviewed_at timestamptz,
  rejection_reason text CHECK (rejection_reason IS NULL OR char_length(rejection_reason)<=1000),
  sanitized_payload jsonb NOT NULL CHECK (jsonb_typeof(sanitized_payload)='object'),
  consumer_taxonomy text NOT NULL CHECK (char_length(consumer_taxonomy) BETWEEN 1 AND 120),
  freshness_deadline timestamptz NOT NULL,
  revision integer NOT NULL DEFAULT 0 CHECK (revision>=0),
  FOREIGN KEY (organization_id,source_record_id,source_revision)
    REFERENCES dispatch_audit.record_revisions(organization_id,record_id,revision_number) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,capability_grant_id)
    REFERENCES dispatch_private.capability_grants(organization_id,id) ON DELETE RESTRICT,
  CHECK (freshness_deadline>requested_at)
);

CREATE TABLE dispatch_projection.public_safe_projections (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES dispatch_projection.projection_candidates(id) ON DELETE RESTRICT,
  projection_revision integer NOT NULL CHECK (projection_revision>0),
  organization_public_name text NOT NULL CHECK (char_length(organization_public_name) BETWEEN 2 AND 160),
  source_class dispatch_private.source_class NOT NULL,
  source_label text NOT NULL CHECK (char_length(source_label) BETWEEN 1 AND 120),
  consumer_taxonomy text NOT NULL CHECK (char_length(consumer_taxonomy) BETWEEN 1 AND 120),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  summary text NOT NULL CHECK (char_length(summary)<=1000),
  public_location jsonb CHECK (public_location IS NULL OR jsonb_typeof(public_location)='object'),
  published_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  invalidation_reason text,
  UNIQUE (candidate_id,projection_revision),
  CHECK (expires_at>published_at)
);
CREATE UNIQUE INDEX public_safe_projections_one_current_candidate_idx
  ON dispatch_projection.public_safe_projections(candidate_id) WHERE withdrawn_at IS NULL;

-- Frozen static seed inventory (manufactured later as idempotent, hash-checked inserts):
-- ROLES: OWNER, ORGANIZATION_ADMIN, SUPERVISOR, OPERATOR, VIEWER
-- PERMISSIONS:
-- organization.read, organization.manage, members.read, members.invite, members.manage,
-- ownership.transfer, scope.read, scope.manage, operations.read, operations.create,
-- operations.update, operations.assign, operations.close, awareness.read,
-- projection.submit, projection.review, projection.publish, audit.read, settings.read,
-- settings.manage, platform.organization.verify, platform.organization.suspend,
-- platform.capability.manage, platform.ownership.recover, platform.audit.investigate,
-- platform.abuse.manage
-- CAPABILITIES:
-- awareness.condition.publish, awareness.hazard.publish, awareness.planned_work.publish,
-- awareness.official_notice.publish, awareness.road_closure.publish
*/
-- PHASE25_INERT_SQL_END
