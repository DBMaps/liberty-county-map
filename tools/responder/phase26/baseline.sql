\set ON_ERROR_STOP on
-- LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
BEGIN;
CREATE SCHEMA gridly_rehearsal;
CREATE SCHEMA report_retention;
CREATE TABLE gridly_rehearsal.environment(
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 marker text NOT NULL CHECK(marker='GRIDLY_PHASE26_LOCAL_SYNTHETIC'),
 production_access_authorized boolean NOT NULL CHECK(NOT production_access_authorized),
 source_kind text NOT NULL CHECK(source_kind='synthetic-production-shaped-baseline'),
 migration_head text NOT NULL CHECK(migration_head='9917ceca5a680d0e69ca3f177d3e5af922c1ace1'));
INSERT INTO gridly_rehearsal.environment VALUES
 (true,'GRIDLY_PHASE26_LOCAL_SYNTHETIC',false,'synthetic-production-shaped-baseline','9917ceca5a680d0e69ca3f177d3e5af922c1ace1');
CREATE TABLE public.gridly_consumer_sentinel(id bigint PRIMARY KEY,payload text NOT NULL);
INSERT INTO public.gridly_consumer_sentinel VALUES (1,'consumer-baseline');
CREATE TABLE report_retention.admission_state(singleton boolean PRIMARY KEY,reporting_enabled boolean NOT NULL);
INSERT INTO report_retention.admission_state VALUES(true,false);
ALTER TABLE public.gridly_consumer_sentinel ENABLE ROW LEVEL SECURITY;
CREATE POLICY gridly_consumer_sentinel_anon_read ON public.gridly_consumer_sentinel FOR SELECT TO anon USING(true);
REVOKE ALL ON SCHEMA gridly_rehearsal,report_retention FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
