\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
CREATE VIEW dispatch_api.responder_public_projection WITH (security_invoker=true) AS
SELECT id,organization_public_name AS agency_name,source_class,source_label,consumer_taxonomy,
 title,summary,public_location,published_at,expires_at,withdrawn_at,invalidation_reason,
 candidate_id,projection_revision,NULL::text AS county_name,NULL::text AS state_code,
 NULL::text AS legacy_status,NULL::text AS legacy_source
FROM dispatch_projection.public_safe_projections
WHERE dispatch_private.projection_eligible(id);
