-- LOCAL/DISPOSABLE ONLY. Synthetic PostgreSQL sessions, never a production dashboard or RPC.
-- Requires Phases 1-7 and preserves the Phase 4 invoker-RLS read boundary.
BEGIN;

-- These additional source columns contain bounded operational detail and a point.
-- RLS still limits every base row to the caller's live organization and role.
GRANT SELECT (created_authority_id,current_authority_id,detail,point,road_name,
  cross_street,crossing_id,updated_at,submitted_at,activated_at,resolved_at,withdrawn_at)
  ON agency_private.agency_updates TO responder_rls_agency_fixture;

CREATE FUNCTION agency_private.phase8_dashboard_entry()
RETURNS TABLE(status text,organization_id uuid,member_role text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
  WITH eligible AS MATERIALIZED (
    SELECT m.organization_id,m.role
    FROM agency_private.responder_membership_roster m
    JOIN agency_private.responder_organization_context o ON o.id=m.organization_id
    WHERE m.user_id=agency_private.phase4_actor_id() AND m.status='active'
      AND m.role IN ('VIEWER','RESPONDER','SUPERVISOR','AGENCY_ADMIN')
      AND o.verification_state='verified' AND o.operation_state='active'
    LIMIT 1
  )
  SELECT CASE WHEN EXISTS (SELECT 1 FROM eligible) THEN 'accepted' ELSE 'forbidden' END,
    (SELECT eligible.organization_id FROM eligible),
    (SELECT eligible.role FROM eligible);
$$;
REVOKE ALL ON FUNCTION agency_private.phase8_dashboard_entry() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private.phase8_dashboard_entry()
  TO responder_rls_agency_fixture;

-- One canonical bounded operational record drives left queue, center map, and
-- right inspector. The approved-current authority view hides historical source
-- provenance; a missing current authority leaves county context null.
CREATE VIEW agency_private.phase8_dashboard_records WITH (security_invoker=true) AS
  SELECT u.id AS update_id,u.organization_id,u.condition_type,u.impact_level,
    u.status AS stored_status,
    CASE WHEN u.status='active' AND u.expires_at<=now()
      THEN 'expired' ELSE u.status END AS display_status,
    u.title,u.detail,u.road_name,u.cross_street,u.crossing_id,
    COALESCE(NULLIF(concat_ws(' / ',u.road_name,u.cross_street),''),u.title)
      AS location_label,
    public.ST_X(u.point) AS longitude,public.ST_Y(u.point) AS latitude,
    a.county_fips::text AS county_fips,a.authority_version,
    u.revision,u.created_at,u.submitted_at,u.activated_at,u.updated_at,
    u.expires_at,u.resolved_at,u.withdrawn_at,
    u.author_user_id=agency_private.phase4_actor_id() AS is_author,
    'AGENCY_OFFICIAL'::text AS source_family
  FROM agency_private.agency_updates u
  LEFT JOIN agency_private.responder_current_authority a
    ON a.id=COALESCE(u.current_authority_id,u.created_authority_id)
      AND a.organization_id=u.organization_id;

CREATE VIEW agency_private.phase8_dashboard_queue WITH (security_invoker=true) AS
  SELECT update_id,organization_id,condition_type,impact_level,stored_status,
    display_status,title,location_label,county_fips,revision,created_at,
    updated_at,expires_at,is_author,source_family
  FROM agency_private.phase8_dashboard_records;

CREATE VIEW agency_private.phase8_dashboard_map WITH (security_invoker=true) AS
  SELECT update_id,organization_id,condition_type,stored_status,display_status,
    title,location_label,longitude,latitude,county_fips,revision,source_family
  FROM agency_private.phase8_dashboard_records;

CREATE VIEW agency_private.phase8_dashboard_inspector WITH (security_invoker=true) AS
  SELECT update_id,organization_id,condition_type,impact_level,stored_status,
    display_status,title,detail,road_name,cross_street,crossing_id,
    location_label,longitude,latitude,county_fips,authority_version,revision,
    created_at,submitted_at,activated_at,updated_at,expires_at,resolved_at,
    withdrawn_at,is_author,source_family
  FROM agency_private.phase8_dashboard_records;

-- Candidate buttons are role/state hints only. Phase 7 commands independently
-- recheck the live actor, county, gate, revision, and any second-actor rule.
CREATE VIEW agency_private.phase8_dashboard_affordances WITH (security_invoker=true) AS
  SELECT r.update_id,r.organization_id,r.revision,
    (r.stored_status='draft' AND
      (r.is_author OR agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN'))) AS can_edit_draft,
    (r.stored_status='draft' AND
      (r.is_author OR agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN'))) AS can_submit,
    (r.stored_status='pending_review' AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_return,
    (r.stored_status='pending_review' AND r.condition_type<>'road_closed'
      AND r.county_fips IS NOT NULL AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_activate_non_closure,
    (r.stored_status='pending_review' AND r.condition_type='road_closed'
      AND NOT r.is_author AND r.county_fips IS NOT NULL AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_activate_road_closed,
    (r.display_status='active' AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_edit_active,
    (r.display_status='active' AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_renew,
    (r.display_status='active' AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN')) AS can_resolve,
    ((r.stored_status IN ('draft','pending_review') AND r.is_author AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('RESPONDER','SUPERVISOR','AGENCY_ADMIN')) OR
      (r.display_status IN ('draft','pending_review','active') AND
      agency_private.phase4_member_role(r.organization_id)
        IN ('SUPERVISOR','AGENCY_ADMIN'))) AS can_withdraw
  FROM agency_private.phase8_dashboard_records r;

REVOKE ALL ON agency_private.phase8_dashboard_records,
  agency_private.phase8_dashboard_queue,agency_private.phase8_dashboard_map,
  agency_private.phase8_dashboard_inspector,agency_private.phase8_dashboard_affordances
  FROM PUBLIC;
GRANT SELECT ON agency_private.phase8_dashboard_records,
  agency_private.phase8_dashboard_queue,agency_private.phase8_dashboard_map,
  agency_private.phase8_dashboard_inspector,agency_private.phase8_dashboard_affordances
  TO responder_rls_agency_fixture;

-- A deliberately inert agency-facing denial surface. It cannot reach the
-- platform governance command, tables, or receipt domain, regardless of body.
CREATE FUNCTION agency_private.phase8_agency_governance_denial(p_request jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
  SELECT '{"status":"forbidden"}'::jsonb;
$$;
REVOKE ALL ON FUNCTION agency_private.phase8_agency_governance_denial(jsonb)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION agency_private.phase8_agency_governance_denial(jsonb)
  TO responder_rls_agency_fixture;

COMMIT;
