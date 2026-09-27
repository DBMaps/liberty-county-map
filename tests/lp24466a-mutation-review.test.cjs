const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'docs/launch/review',name),'utf8');
// Text review only: NEVER execute rollback SQL, even against local fixtures.
for(const name of ['LP24466A-ACKNOWLEDGMENT-ROLLBACK-REVIEW.sql','LP24466A-CACHE-ROLLBACK-REVIEW.sql']) {
 test(name+' unconditionally aborts before any rollback action',()=>{
  const s=read(name),guard=s.indexOf("RAISE EXCEPTION 'LP24466A_REVIEW_ONLY_NOT_AUTHORIZED'");
  assert.ok(s.indexOf('BEGIN;')<guard && guard>0);
  assert.ok(guard<s.indexOf('DO $precheck$'));
  assert.doesNotMatch(s.slice(s.indexOf('BEGIN;'),guard),/\bIF\b/i);
  assert.doesNotMatch(s,/^\s*(?:DELETE|UPDATE|INSERT|ALTER|GRANT|REVOKE|CALL)\b/im);
  assert.doesNotMatch(s,/^\s*DROP[^;]*\bCASCADE\b/im);
  assert.doesNotMatch(s,/supabase_migrations|cron\.schedule|reporting_enabled\s*=/);
 });
}
test('ack rollback refuses retained work under lock and preserves prerequisite cache',()=>{
 const s=read('LP24466A-ACKNOWLEDGMENT-ROLLBACK-REVIEW.sql');
 assert.ok(s.indexOf('LOCK TABLE')<s.indexOf('IF EXISTS (SELECT FROM subscription_ops.google_ack_work)'));
 assert.ok(s.indexOf('rollback_pending_work_refused')<s.indexOf('DROP FUNCTION'));
 assert.doesNotMatch(s,/DROP (?:TABLE subscription_ops\.store_entitlements|SCHEMA)/);
 assert.equal((s.match(/^DROP FUNCTION /gm)||[]).length,4);
 assert.equal((s.match(/^DROP TABLE /gm)||[]).length,2);
});
test('cache rollback rejects ack dependencies; drops only owned cache contract without CASCADE',()=>{
 const s=read('LP24466A-CACHE-ROLLBACK-REVIEW.sql');
 for(const name of ['google_ack_work','google_ack_health','gridly_enqueue_google_ack','gridly_claim_google_ack','gridly_resolve_google_ack','gridly_google_ack_health'])assert.ok(s.includes(name));
 assert.ok(s.indexOf('rollback_ack_dependency_present')<s.indexOf('DROP FUNCTION'));
 assert.equal((s.match(/^DROP FUNCTION /gm)||[]).length,2);
 assert.equal((s.match(/^DROP TABLE /gm)||[]).length,1);
 assert.match(s,/DROP SCHEMA subscription_ops;/);
});
