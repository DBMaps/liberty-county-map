const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const modulePath = path.join(ROOT, 'js/gridly-ugc-compliance.js');

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

function loadCompliance() {
  delete require.cache[require.resolve(modulePath)];
  global.localStorage = new MemoryStorage();
  delete global.gridlyUgcCompliance;
  return require(modulePath);
}

beforeEach(() => {
  delete global.localStorage;
  delete global.gridlyUgcCompliance;
});

test('acceptance is explicit, versioned, timestamped and invalidates older versions', () => {
  const compliance = loadCompliance();
  assert.equal(compliance.acceptance(), null);
  const accepted = compliance.acceptTerms(new Date('2026-09-16T18:00:00.000Z'));
  assert.deepEqual(accepted, { version: 'gridly-ugc-2026-09-16-v1', acceptedAt: '2026-09-16T18:00:00.000Z' });
  assert.deepEqual(compliance.acceptance(), accepted);
  global.localStorage.setItem('gridlyUgcTermsAcceptanceV1', JSON.stringify({ version: 'old', acceptedAt: accepted.acceptedAt }));
  assert.equal(compliance.acceptance(), null);
});

test('local hide is immediate, durable, bounded and filters by public report UUID only', () => {
  const compliance = loadCompliance();
  const id = '123e4567-e89b-42d3-a456-426614174000';
  assert.equal(compliance.hide('derived-incident-id'), false);
  assert.equal(compliance.hide(id), true);
  assert.equal(compliance.isHidden(id), true);
  assert.deepEqual(compliance.filterVisible([{ persistedReportId:id }, { persistedReportId:'123e4567-e89b-42d3-a456-426614174001' }]).map(row => row.persistedReportId), ['123e4567-e89b-42d3-a456-426614174001']);
  for (let index=0; index<510; index++) {
    const suffix = index.toString(16).padStart(12,'0');
    compliance.hide(`00000000-0000-4000-8000-${suffix}`);
  }
  assert.equal(compliance.hiddenIds().length, 500);
});

test('every real community report gets report, hide and verified deletion controls', () => {
  const compliance = loadCompliance();
  const html = compliance.controlsHtml('123e4567-e89b-42d3-a456-426614174000');
  assert.match(html, /data-gridly-ugc-action="report"/);
  assert.match(html, /data-gridly-ugc-action="hide"/);
  assert.match(html, /data-gridly-ugc-action="delete"/);
  assert.equal(compliance.controlsHtml('rail-derived'), '');
  assert.deepEqual(compliance.reasons.map(row => row.value), ['dangerous_content','false_information','harassment','hate_or_abuse','spam','other']);
});

test('new-report gate runs before protocol begin while retry and cancellation semantics remain untouched', () => {
  const app = fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  const start = app.indexOf('async function gridlySubmitCommunityOperation(');
  const end = app.indexOf('window.gridlyReportingAvailability',start);
  const gate = app.slice(start,end);
  assert.ok(start>0 && end>start);
  assert.ok(gate.indexOf('ensureAccepted') < gate.indexOf('gridlyReportingAvailabilityRuntime.submit'));
  assert.match(gate,/kind === "create"/);
  assert.match(gate,/terms_required/);
  assert.match(app,/gridlyGetCommunityProtocolClient\(\)\.retry\(supabaseClient, deviceId\)/);
  assert.match(app,/runtime\.submit\("cancel"|kind === "cancel"|pending\.kind === "cancel"/);
  assert.match(app,/window\.gridlyUgcComplianceBridge/);
  assert.match(app,/submit_community_moderation_report/);
  assert.match(app,/request_community_report_deletion/);
});

test('legal documents are bundled, reachable from settings and consistent with safety controls', () => {
  const app = fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
  for (const [name,file] of Object.entries({ privacy:'privacy.html', terms:'terms.html', guidelines:'community-guidelines.html' })) {
    const html = fs.readFileSync(path.join(ROOT,'legal',file),'utf8');
    assert.match(html,/<h1>Gridly/);
    assert.match(app,new RegExp(`data-document="${name}"`));
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT,'consumer-script-manifest.json'),'utf8'));
  const moduleIndex = manifest.startupScripts.findIndex(item => item.startsWith('js/gridly-ugc-compliance.js'));
  const appIndex = manifest.startupScripts.findIndex(item => item.startsWith('js/app.js'));
  assert.ok(moduleIndex>0 && moduleIndex<appIndex);
  const nativeTool = fs.readFileSync(path.join(ROOT,'tools/native-web.mjs'),'utf8');
  assert.match(nativeTool,/'legal'/);
  const worker = fs.readFileSync(path.join(ROOT,'service-worker.js'),'utf8');
  for (const file of ['privacy.html','terms.html','community-guidelines.html']) assert.match(worker,new RegExp(file));
});

test('database design keeps source identity private and moderation/deletion bounded', () => {
  const migration = fs.readFileSync(path.join(ROOT,'supabase/migrations/20260916183911_google_play_compliance_closure.sql'),'utf8');
  assert.match(migration,/create policy moderation_public_visibility_boundary[\s\S]*moderation_state = 'visible'/i);
  assert.match(migration,/security definer set search_path=''/i);
  assert.match(migration,/revoke all on all tables in schema moderation, privacy_ops/i);
  assert.match(migration,/source_suppressions[\s\S]*device_digest bytea/i);
  assert.doesNotMatch(migration,/grant select[^;]+source_suppressions/i);
  assert.match(migration,/request_community_report_deletion/i);
  assert.match(migration,/l\.device_id=reporter_device_id/i);
  assert.match(migration,/retain_until <= created_at \+ interval '149 days'/i);
  assert.match(migration,/least\(r\.linkage_deadline,clock_timestamp\(\)\+interval '180 days'\)/i);
});

test('final-draft policy sources no longer contain obsolete proposed/unpublished banners', () => {
  for (const file of ['GRIDLY-PRIVACY-POLICY.md','GRIDLY-TERMS-OF-USE.md']) {
    const text = fs.readFileSync(path.join(ROOT,'docs/LEGAL',file),'utf8');
    assert.doesNotMatch(text,/PROPOSED FOR OWNER REVIEW|PUBLICATION BLOCKED|not yet operative/i);
    assert.match(text,/September 16, 2026/);
  }
  const guidelines = fs.readFileSync(path.join(ROOT,'docs/LEGAL/GRIDLY-COMMUNITY-GUIDELINES.md'),'utf8');
  assert.match(guidelines,/Report/); assert.match(guidelines,/Hide/); assert.match(guidelines,/Delete mine/);
});
