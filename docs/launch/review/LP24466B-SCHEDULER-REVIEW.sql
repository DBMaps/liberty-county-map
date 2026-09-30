-- REVIEW ONLY. NEVER execute this file. No production Cron approval.
-- Proposed ONE additional job after fresh ledger, role, time/cost and owner review.
-- Existing two Gridly cleanup jobs must remain unchanged.
BEGIN;
DO $review_only$
BEGIN
 RAISE EXCEPTION 'LP24466B_REVIEW_ONLY_NOT_AUTHORIZED';
END
$review_only$;
SELECT cron.schedule('gridly-subscription-housekeeping','* * * * *',
  $cron$SELECT queue_purged,cache_purged FROM public.gridly_subscription_housekeeping();$cron$);
COMMIT;
