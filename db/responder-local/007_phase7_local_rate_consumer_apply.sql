-- LOCAL/DISPOSABLE ONLY. Requires responder Phases 1-6 and PostGIS 3.6.2.
-- This fixture never installs a production RPC or enables the publishing gate.
BEGIN;

-- Store the operation epoch at the first successful activation. The frozen
-- update guard still enforces one revision advance per mutation.
ALTER TABLE agency_private.agency_updates
  ADD COLUMN activation_operation_epoch bigint CHECK (activation_operation_epoch >= 0);
CREATE FUNCTION agency_private.phase7_capture_activation_epoch() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF OLD.status='pending_review' AND NEW.status='active' THEN
    SELECT operation_epoch INTO NEW.activation_operation_epoch
      FROM agency_private.organizations WHERE id=NEW.organization_id;
  ELSIF NEW.activation_operation_epoch IS DISTINCT FROM OLD.activation_operation_epoch THEN
    RAISE EXCEPTION 'activation operation epoch is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER zz_phase7_capture_activation_epoch BEFORE UPDATE
  ON agency_private.agency_updates FOR EACH ROW
  EXECUTE FUNCTION agency_private.phase7_capture_activation_epoch();

-- Count successful activation rows, including resolved and withdrawn history.
-- The strict lower bound is the owner-approved rolling-window edge.
CREATE INDEX phase7_activation_rate_idx ON agency_private.agency_updates
  (organization_id,activated_at) WHERE activated_at IS NOT NULL;
CREATE FUNCTION agency_private.phase7_recent_activation_count(
  p_organization uuid,p_as_of timestamptz) RETURNS integer
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
  SELECT count(*)::integer FROM agency_private.agency_updates u
  WHERE u.organization_id=p_organization AND u.activated_at>p_as_of-interval '60 minutes'
    AND u.activated_at<=p_as_of
    AND EXISTS (SELECT 1 FROM agency_private.agency_update_events e
      WHERE e.update_id=u.id AND e.organization_id=u.organization_id
        AND e.action IN ('update_activated','road_closure_activated')
        AND e.revision<=u.revision
        AND e.previous_snapshot->>'status'='pending_review'
        AND e.new_snapshot->>'status'='active');
$$;
REVOKE ALL ON FUNCTION agency_private.phase7_recent_activation_count(uuid,timestamptz) FROM PUBLIC;
GRANT SELECT ON agency_private.agency_update_events TO responder_command_fixture;
GRANT UPDATE ON agency_private.organizations TO responder_command_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase7_recent_activation_count(uuid,timestamptz)
  TO responder_command_fixture;

-- Serialize every attempted activation against the organization row before
-- delegating to the fully validated Phase 5 command. An accepted 61st command
-- is rolled back as a subtransaction, including its event and replay receipt.
CREATE FUNCTION agency_private.phase7_agency_update_command(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_action text; v_org uuid; v_result jsonb; v_as_of timestamptz;
BEGIN
  IF p_request IS NULL OR jsonb_typeof(p_request)<>'object' THEN
    RETURN agency_private.phase5_agency_update_command(p_request); END IF;
  v_action:=p_request->>'action';
  IF v_action IN ('activate_non_closure','activate_road_closed')
    AND coalesce(p_request->>'organization_id','') ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_org:=(p_request->>'organization_id')::uuid;
    PERFORM 1 FROM agency_private.organizations WHERE id=v_org FOR UPDATE;
  END IF;
  BEGIN
    v_result:=agency_private.phase5_agency_update_command(p_request);
    IF v_action IN ('activate_non_closure','activate_road_closed')
      AND v_result->>'status'='accepted' THEN
      v_as_of:=clock_timestamp();
      IF agency_private.phase7_recent_activation_count(v_org,v_as_of)>60 THEN
        RAISE EXCEPTION 'local publication rate exceeded' USING ERRCODE='P7001';
      END IF;
    END IF;
    RETURN v_result;
  EXCEPTION WHEN SQLSTATE 'P7001' THEN
    RETURN jsonb_build_object('status','rate_limited');
  END;
END $$;
REVOKE ALL ON FUNCTION agency_private.phase7_agency_update_command(jsonb) FROM PUBLIC;
ALTER FUNCTION agency_private.phase7_agency_update_command(jsonb) OWNER TO responder_command_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase7_agency_update_command(jsonb)
  TO responder_rls_agency_fixture;
REVOKE EXECUTE ON FUNCTION agency_private.phase5_agency_update_command(jsonb)
  FROM responder_rls_agency_fixture;

-- This non-login view owner has read-only access to precisely the private
-- inputs used to construct the public document. The public role has none.
CREATE ROLE responder_projection_fixture NOLOGIN BYPASSRLS;
CREATE ROLE responder_public_reader_fixture NOLOGIN;
GRANT USAGE ON SCHEMA agency_private TO responder_projection_fixture;
GRANT SELECT ON agency_private.agency_program_controls,
  agency_private.organizations,agency_private.organization_authorities,
  agency_private.agency_updates,agency_private.agency_update_events
  TO responder_projection_fixture;
CREATE SCHEMA responder_public AUTHORIZATION responder_projection_fixture;
GRANT USAGE ON SCHEMA responder_public TO responder_public_reader_fixture;

-- Owner-only deterministic clock parameter supports exact expiry tests.
-- Public readers receive only the view, which supplies server time.
CREATE FUNCTION agency_private.phase7_consumer_projection_at(p_as_of timestamptz)
RETURNS TABLE(document jsonb) LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT jsonb_build_object(
    'update_id',u.id,
    'organization_public_name',o.public_name,
    'approved_department_name',NULL::text,
    'verified_agency',true,
    'verified_agency_label','Verified Agency',
    'condition_type',u.condition_type,
    'impact_level',u.impact_level,
    'title',u.title,
    'detail',u.detail,
    'location',jsonb_build_object('latitude',public.ST_Y(u.point),
      'longitude',public.ST_X(u.point)),
    'road_name',u.road_name,
    'cross_street',u.cross_street,
    'crossing_id',u.crossing_id,
    'source_family',u.source_family,
    'activated_at',u.activated_at,
    'updated_at',u.updated_at,
    'expires_at',u.expires_at,
    'display_lifecycle_state','active')
  FROM agency_private.agency_updates u
  JOIN agency_private.organizations o ON o.id=u.organization_id
  JOIN agency_private.organization_authorities a ON a.id=u.current_authority_id
    AND a.organization_id=u.organization_id
  WHERE (SELECT agency_publishing_enabled FROM agency_private.agency_program_controls
      WHERE singleton_key=1)=true
    AND u.source_family='AGENCY_OFFICIAL' AND u.status='active'
    AND u.activated_at IS NOT NULL AND u.activated_at<=p_as_of
    AND u.expires_at>p_as_of AND u.activation_operation_epoch=o.operation_epoch
    AND o.verification_state='verified' AND o.operation_state='active'
    AND a.status='approved' AND a.revoked_at IS NULL
    AND a.effective_from<=p_as_of AND (a.effective_until IS NULL OR a.effective_until>p_as_of)
    AND public.ST_Contains(a.geometry,u.point)
    AND u.crossing_id IS NULL
    AND char_length(u.title) BETWEEN 1 AND 120 AND u.title !~ '[<>]'
    AND char_length(u.impact_level) BETWEEN 1 AND 40
    AND u.condition_type IN ('road_closed','high_water','obstruction','construction','public_works_notice')
    AND (SELECT count(*) FROM agency_private.agency_update_events activation
      WHERE activation.update_id=u.id AND activation.organization_id=u.organization_id
        AND activation.revision<=u.revision
        AND activation.action IN ('update_activated','road_closure_activated')
        AND activation.previous_snapshot->>'status'='pending_review'
        AND activation.new_snapshot->>'status'='active'
        AND activation.authority_id IS NOT NULL
        AND ((u.condition_type<>'road_closed' AND activation.action='update_activated')
          OR (u.condition_type='road_closed' AND activation.action='road_closure_activated'
            AND activation.actor_user_id<>u.author_user_id
            AND activation.new_snapshot->>'author_user_id'=u.author_user_id::text)))=1
    AND EXISTS (SELECT 1 FROM agency_private.agency_update_events current_event
      WHERE current_event.update_id=u.id AND current_event.organization_id=u.organization_id
        AND current_event.revision=u.revision AND current_event.authority_id=u.current_authority_id
        AND current_event.action IN ('update_activated','road_closure_activated','update_edited','update_renewed')
        AND current_event.new_snapshot->>'status'='active'
        AND current_event.new_snapshot->>'revision'=u.revision::text
        AND ((current_event.action IN ('update_activated','road_closure_activated')
          AND current_event.previous_snapshot->>'status'='pending_review')
          OR (current_event.action IN ('update_edited','update_renewed')
            AND current_event.previous_snapshot->>'status'='active')));
$$;
REVOKE ALL ON FUNCTION agency_private.phase7_consumer_projection_at(timestamptz) FROM PUBLIC;
ALTER FUNCTION agency_private.phase7_consumer_projection_at(timestamptz)
  OWNER TO responder_projection_fixture;

CREATE FUNCTION agency_private.phase7_consumer_projection_now()
RETURNS TABLE(document jsonb) LANGUAGE sql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog AS $$
  SELECT document FROM agency_private.phase7_consumer_projection_at(clock_timestamp());
$$;
REVOKE ALL ON FUNCTION agency_private.phase7_consumer_projection_now() FROM PUBLIC;
ALTER FUNCTION agency_private.phase7_consumer_projection_now()
  OWNER TO responder_projection_fixture;
GRANT EXECUTE ON FUNCTION agency_private.phase7_consumer_projection_now()
  TO responder_public_reader_fixture;

CREATE VIEW responder_public.agency_updates AS
  SELECT document FROM agency_private.phase7_consumer_projection_now();
ALTER VIEW responder_public.agency_updates OWNER TO responder_projection_fixture;
REVOKE ALL ON responder_public.agency_updates FROM PUBLIC;
GRANT SELECT ON responder_public.agency_updates TO responder_public_reader_fixture;
COMMIT;
