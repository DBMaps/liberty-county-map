-- LOCAL/DISPOSABLE ONLY. Not part of supabase/migrations or a production rollout.
-- Requires PostGIS 3.6.2 already installed in this disposable database.
BEGIN;

CREATE SCHEMA agency_private;
REVOKE ALL ON SCHEMA agency_private FROM PUBLIC;
CREATE ROLE responder_app_fixture NOLOGIN;
CREATE ROLE responder_owner_fixture NOLOGIN;
GRANT USAGE ON SCHEMA agency_private TO responder_owner_fixture;

CREATE FUNCTION agency_private.reject_row_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  RAISE EXCEPTION 'responder append-only or protected row cannot be mutated' USING ERRCODE = '55000';
END $$;

CREATE FUNCTION agency_private.check_immutable_id() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'responder primary id is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE agency_private.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_key text NOT NULL UNIQUE CHECK (canonical_key ~ '^[a-z0-9][a-z0-9-]{2,99}$' AND canonical_key = lower(canonical_key)),
  legal_name text NOT NULL CHECK (char_length(legal_name) BETWEEN 2 AND 200),
  public_name text NOT NULL CHECK (char_length(public_name) BETWEEN 2 AND 160),
  organization_type text NOT NULL CHECK (organization_type IN ('county_agency','municipal_agency','district_agency')),
  verification_state text NOT NULL DEFAULT 'requested' CHECK (verification_state IN ('requested','pending_review','verified','rejected','revoked')),
  operation_state text NOT NULL DEFAULT 'inactive' CHECK (operation_state IN ('inactive','active','suspended')),
  primary_contact_name text CHECK (char_length(primary_contact_name) <= 160),
  primary_contact_email text CHECK (char_length(primary_contact_email) <= 254),
  primary_contact_phone text CHECK (char_length(primary_contact_phone) <= 40),
  operation_epoch bigint NOT NULL DEFAULT 0 CHECK (operation_epoch >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  CHECK (operation_state <> 'active' OR verification_state = 'verified'),
  CHECK (verification_state <> 'revoked' OR operation_state <> 'active')
);
CREATE INDEX organizations_verification_operation_idx ON agency_private.organizations (verification_state, operation_state);
CREATE INDEX organizations_public_name_idx ON agency_private.organizations (public_name);
CREATE TRIGGER organizations_immutable_id BEFORE UPDATE ON agency_private.organizations FOR EACH ROW EXECUTE FUNCTION agency_private.check_immutable_id();

CREATE TABLE agency_private.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','suspended','revoked')),
  invited_by uuid,
  approved_by uuid,
  joined_at timestamptz,
  suspended_at timestamptz,
  revoked_at timestamptz,
  last_role_change timestamptz,
  UNIQUE (organization_id, user_id),
  UNIQUE (organization_id, id),
  CHECK (status <> 'active' OR joined_at IS NOT NULL)
);
CREATE UNIQUE INDEX membership_one_active_org_per_user_idx ON agency_private.organization_memberships (user_id) WHERE status = 'active';
CREATE INDEX memberships_org_status_role_idx ON agency_private.organization_memberships (organization_id, status, role);
CREATE INDEX memberships_user_status_idx ON agency_private.organization_memberships (user_id, status);
CREATE TRIGGER memberships_immutable_id BEFORE UPDATE ON agency_private.organization_memberships FOR EACH ROW EXECUTE FUNCTION agency_private.check_immutable_id();

CREATE TABLE agency_private.organization_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  authority_version integer NOT NULL CHECK (authority_version > 0),
  scope_type text NOT NULL DEFAULT 'COUNTY' CHECK (scope_type = 'COUNTY'),
  county_fips char(5) NOT NULL CHECK (county_fips ~ '^48[0-9]{3}$'),
  geometry geometry(Polygon,4326) NOT NULL CHECK (NOT ST_IsEmpty(geometry) AND ST_IsValid(geometry)
    AND ST_XMin(geometry) >= -180 AND ST_XMax(geometry) <= 180
    AND ST_YMin(geometry) >= -90 AND ST_YMax(geometry) <= 90),
  source_path text NOT NULL CHECK (char_length(source_path) BETWEEN 1 AND 512),
  source_sha256 char(64) NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_schema_version text NOT NULL CHECK (char_length(source_schema_version) BETWEEN 1 AND 160),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  revoked_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  UNIQUE (organization_id, county_fips, authority_version),
  UNIQUE (organization_id, id),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND revoked_at IS NULL)),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE UNIQUE INDEX authority_one_approved_version_idx ON agency_private.organization_authorities (organization_id, county_fips) WHERE status = 'approved';
CREATE INDEX authorities_org_status_dates_idx ON agency_private.organization_authorities (organization_id, status, effective_from, effective_until);
CREATE INDEX authorities_geometry_gist_idx ON agency_private.organization_authorities USING gist (geometry);

CREATE FUNCTION agency_private.guard_authority() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
DECLARE latest integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || NEW.county_fips, 0));
    SELECT max(authority_version) INTO latest FROM agency_private.organization_authorities
      WHERE organization_id = NEW.organization_id AND county_fips = NEW.county_fips;
    IF latest IS NOT NULL AND NEW.authority_version <= latest THEN
      RAISE EXCEPTION 'authority version must advance' USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.county_fips IS DISTINCT FROM OLD.county_fips OR NEW.authority_version IS DISTINCT FROM OLD.authority_version THEN
      RAISE EXCEPTION 'authority identity/version is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'approved' AND (
      NEW.geometry::text IS DISTINCT FROM OLD.geometry::text OR NEW.source_path IS DISTINCT FROM OLD.source_path
      OR NEW.source_sha256 IS DISTINCT FROM OLD.source_sha256 OR NEW.source_schema_version IS DISTINCT FROM OLD.source_schema_version
      OR NEW.effective_from IS DISTINCT FROM OLD.effective_from OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
      OR NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.status NOT IN ('approved','revoked')) THEN
      RAISE EXCEPTION 'approved authority provenance is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'revoked' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'revoked authority is terminal' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER authorities_guard BEFORE INSERT OR UPDATE ON agency_private.organization_authorities FOR EACH ROW EXECUTE FUNCTION agency_private.guard_authority();
CREATE TRIGGER authorities_no_delete BEFORE DELETE OR TRUNCATE ON agency_private.organization_authorities FOR EACH STATEMENT EXECUTE FUNCTION agency_private.reject_row_mutation();

CREATE TABLE agency_private.agency_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  author_user_id uuid NOT NULL,
  created_authority_id uuid NOT NULL,
  current_authority_id uuid,
  source_family text NOT NULL DEFAULT 'AGENCY_OFFICIAL' CHECK (source_family = 'AGENCY_OFFICIAL'),
  condition_type text NOT NULL CHECK (condition_type IN ('road_closed','high_water','obstruction','construction','public_works_notice')),
  impact_level text NOT NULL CHECK (char_length(impact_level) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  detail text CHECK (char_length(detail) <= 1000),
  point geometry(Point,4326) NOT NULL CHECK (NOT ST_IsEmpty(point) AND ST_IsValid(point)
    AND ST_X(point) BETWEEN -180 AND 180 AND ST_Y(point) BETWEEN -90 AND 90),
  road_name text CHECK (char_length(road_name) <= 120),
  cross_street text CHECK (char_length(cross_street) <= 120),
  crossing_id text CHECK (char_length(crossing_id) <= 120),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_review','active','resolved','withdrawn')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  withdrawn_at timestamptz,
  resolved_by_user_id uuid,
  CHECK (status <> 'active' OR (current_authority_id IS NOT NULL AND activated_at IS NOT NULL AND expires_at IS NOT NULL)),
  CHECK (activated_at IS NULL OR expires_at IS NULL OR (expires_at > activated_at AND expires_at <= activated_at + interval '24 hours')),
  CHECK (status <> 'resolved' OR resolved_at IS NOT NULL),
  CHECK (status <> 'withdrawn' OR withdrawn_at IS NOT NULL),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, created_authority_id) REFERENCES agency_private.organization_authorities(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, current_authority_id) REFERENCES agency_private.organization_authorities(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX updates_org_status_expiry_idx ON agency_private.agency_updates (organization_id, status, expires_at);
CREATE INDEX updates_condition_type_idx ON agency_private.agency_updates (condition_type);
CREATE INDEX updates_point_gist_idx ON agency_private.agency_updates USING gist (point);

CREATE FUNCTION agency_private.guard_update_lifecycle() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.author_user_id IS DISTINCT FROM OLD.author_user_id OR NEW.created_authority_id IS DISTINCT FROM OLD.created_authority_id
    OR NEW.source_family IS DISTINCT FROM OLD.source_family THEN
    RAISE EXCEPTION 'update identity/source is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.revision <> OLD.revision + 1 THEN
    RAISE EXCEPTION 'update revision must advance by one' USING ERRCODE = '23514';
  END IF;
  IF OLD.status IN ('resolved','withdrawn') OR (OLD.status = 'active' AND OLD.expires_at <= clock_timestamp()) THEN
    RAISE EXCEPTION 'terminal or effectively expired update cannot be revised' USING ERRCODE = '23514';
  END IF;
  IF NOT ((OLD.status = 'draft' AND NEW.status IN ('draft','pending_review','withdrawn'))
    OR (OLD.status = 'pending_review' AND NEW.status IN ('draft','active','withdrawn'))
    OR (OLD.status = 'active' AND NEW.status IN ('active','resolved','withdrawn'))) THEN
    RAISE EXCEPTION 'prohibited update lifecycle transition' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER updates_guard BEFORE UPDATE ON agency_private.agency_updates FOR EACH ROW EXECUTE FUNCTION agency_private.guard_update_lifecycle();
CREATE TRIGGER updates_no_delete BEFORE DELETE OR TRUNCATE ON agency_private.agency_updates FOR EACH STATEMENT EXECUTE FUNCTION agency_private.reject_row_mutation();

CREATE TABLE agency_private.agency_update_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  authority_id uuid,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  previous_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(previous_snapshot) = 'object' AND octet_length(previous_snapshot::text) <= 8192),
  new_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(new_snapshot) = 'object' AND octet_length(new_snapshot::text) <= 8192),
  point geometry(Point,4326),
  reason text CHECK (char_length(reason) <= 1000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  operation_id uuid,
  revision integer NOT NULL CHECK (revision >= 0),
  UNIQUE (update_id, revision),
  FOREIGN KEY (organization_id, update_id) REFERENCES agency_private.agency_updates(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, authority_id) REFERENCES agency_private.organization_authorities(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX update_events_org_time_idx ON agency_private.agency_update_events (organization_id, occurred_at DESC);
CREATE INDEX update_events_operation_idx ON agency_private.agency_update_events (operation_id) WHERE operation_id IS NOT NULL;

CREATE TABLE agency_private.organization_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  reviewer_user_id uuid NOT NULL,
  from_state text CHECK (from_state IN ('requested','pending_review','verified','rejected','revoked')),
  to_state text NOT NULL CHECK (to_state IN ('requested','pending_review','verified','rejected','revoked')),
  method_reference jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(method_reference) = 'object' AND octet_length(method_reference::text) <= 4096),
  reason text CHECK (char_length(reason) <= 1000),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_events_org_time_idx ON agency_private.organization_verification_events (organization_id, occurred_at DESC);

CREATE TABLE agency_private.organization_governance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL,
  affected_membership_id uuid,
  affected_authority_id uuid,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  before_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(before_snapshot) = 'object' AND octet_length(before_snapshot::text) <= 4096),
  after_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(after_snapshot) = 'object' AND octet_length(after_snapshot::text) <= 4096),
  reason text CHECK (char_length(reason) <= 1000),
  correlation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, affected_membership_id) REFERENCES agency_private.organization_memberships(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, affected_authority_id) REFERENCES agency_private.organization_authorities(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX governance_events_org_time_idx ON agency_private.organization_governance_events (organization_id, occurred_at DESC);
CREATE INDEX governance_events_correlation_idx ON agency_private.organization_governance_events (correlation_id) WHERE correlation_id IS NOT NULL;

CREATE TABLE agency_private.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  inviter_user_id uuid NOT NULL,
  intended_email text NOT NULL CHECK (char_length(intended_email) BETWEEN 3 AND 254 AND intended_email = lower(trim(intended_email)) AND intended_email LIKE '%@%'),
  proposed_role text NOT NULL CHECK (proposed_role IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN')),
  token_digest bytea NOT NULL UNIQUE CHECK (octet_length(token_digest) = 32),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','redeemed','expired','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK (status <> 'redeemed' OR redeemed_at IS NOT NULL),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
);
CREATE INDEX invites_org_identity_status_idx ON agency_private.organization_invites (organization_id, intended_email, status);
CREATE INDEX invites_expiry_idx ON agency_private.organization_invites (expires_at) WHERE status = 'created';

CREATE FUNCTION agency_private.guard_invite() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || NEW.intended_email, 0));
    IF NEW.status = 'created' AND EXISTS (
      SELECT 1 FROM agency_private.organization_invites
      WHERE organization_id = NEW.organization_id AND intended_email = NEW.intended_email
        AND status = 'created' AND expires_at > clock_timestamp()) THEN
      RAISE EXCEPTION 'live invite already exists' USING ERRCODE = '23505';
    END IF;
  ELSE
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
      OR NEW.intended_email IS DISTINCT FROM OLD.intended_email OR NEW.token_digest IS DISTINCT FROM OLD.token_digest
      OR NEW.proposed_role IS DISTINCT FROM OLD.proposed_role THEN
      RAISE EXCEPTION 'invite identity and digest are immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status <> 'created' AND NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'terminal invite is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'created' AND NEW.status NOT IN ('created','redeemed','expired','revoked') THEN
      RAISE EXCEPTION 'invalid invite transition' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = 'redeemed' AND OLD.expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'expired invite cannot be redeemed' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invites_guard BEFORE INSERT OR UPDATE ON agency_private.organization_invites FOR EACH ROW EXECUTE FUNCTION agency_private.guard_invite();

CREATE TABLE agency_private.agency_operation_receipts (
  token_digest bytea PRIMARY KEY CHECK (octet_length(token_digest) = 32),
  actor_user_id uuid NOT NULL,
  organization_id uuid NOT NULL REFERENCES agency_private.organizations(id) ON DELETE RESTRICT,
  update_id uuid,
  action text NOT NULL CHECK (char_length(action) BETWEEN 1 AND 80),
  payload_digest bytea NOT NULL CHECK (octet_length(payload_digest) = 32),
  bounded_result jsonb NOT NULL CHECK (jsonb_typeof(bounded_result) = 'object' AND octet_length(bounded_result::text) <= 1024),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, update_id) REFERENCES agency_private.agency_updates(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX receipts_org_time_idx ON agency_private.agency_operation_receipts (organization_id, accepted_at DESC);
CREATE INDEX receipts_actor_time_idx ON agency_private.agency_operation_receipts (actor_user_id, accepted_at DESC);

CREATE TABLE agency_private.agency_program_controls (
  singleton_key smallint PRIMARY KEY DEFAULT 1 CHECK (singleton_key = 1),
  agency_publishing_enabled boolean NOT NULL DEFAULT false,
  policy_version text NOT NULL DEFAULT 'responder.agency.v1.phase0.1' CHECK (char_length(policy_version) BETWEEN 1 AND 120),
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO agency_private.agency_program_controls DEFAULT VALUES;
CREATE FUNCTION agency_private.guard_program_controls() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, agency_private AS $$
BEGIN
  IF TG_OP IN ('DELETE','TRUNCATE') THEN
    RAISE EXCEPTION 'singleton program control cannot be removed' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.singleton_key <> OLD.singleton_key THEN
    RAISE EXCEPTION 'singleton key is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER program_controls_guard_row BEFORE UPDATE OR DELETE ON agency_private.agency_program_controls FOR EACH ROW EXECUTE FUNCTION agency_private.guard_program_controls();
CREATE TRIGGER program_controls_guard_truncate BEFORE TRUNCATE ON agency_private.agency_program_controls FOR EACH STATEMENT EXECUTE FUNCTION agency_private.guard_program_controls();

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['agency_update_events','organization_verification_events','organization_governance_events','agency_operation_receipts'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE OR TRUNCATE ON agency_private.%I FOR EACH STATEMENT EXECUTE FUNCTION agency_private.reject_row_mutation()', table_name || '_append_only', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA agency_private TO responder_owner_fixture;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA agency_private TO responder_owner_fixture;
-- The app fixture has no schema usage or table writes. Future RLS/RPC is a separate phase.
COMMIT;
