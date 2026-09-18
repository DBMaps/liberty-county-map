-- LOCAL DISPOSABLE PROTOTYPE ONLY
-- NOT A PRODUCTION MIGRATION
-- Supabase local pgcrypto compatibility needed before Phase 22 commands load.

BEGIN;
CREATE OR REPLACE FUNCTION public.digest(p_value bytea,p_algorithm text)
RETURNS bytea LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path='' AS $$
  SELECT extensions.digest(p_value,p_algorithm)
$$;
REVOKE ALL ON FUNCTION public.digest(bytea,text) FROM PUBLIC;
COMMIT;
