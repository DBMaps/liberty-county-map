const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const client = fs.readFileSync('js/gridly-geocoding-client.js', 'utf8');
const edge = fs.readFileSync('supabase/functions/gridly-geocode/index.ts', 'utf8');
const edgeBytes = fs.readFileSync('supabase/functions/gridly-geocode/index.ts');
const migration = fs.readFileSync('supabase/migrations/202607280100_lp100_geocoding_governance.sql', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
assert.doesNotMatch(app, /fetch\(`https:\/\/nominatim\.openstreetmap\.org\/search/);
assert.match(app, /gridlyGeocodingClient\.search/);
assert.match(app, /remote_search_explicit_action/);
assert.match(app, /while typing remains local-only/);
assert.match(app, /event\.key !== "Enter"/);
assert.ok(html.indexOf('gridly-geocoding-client.js') < html.indexOf('js/app.js'));
assert.match(html, /gridlyRemoteSearchBtn/);
assert.match(edge, /request\.method !== "POST"/);
assert.match(edge, /Content-Length/);
assert.match(edge, /unknown_field/);
assert.match(edge, /body\.query\.trim\(\)\.length < 3/);
assert.match(edge, /body\.limit > 15/);
assert.match(edge, /body\.context\?\.viewbox/);
assert.match(edge, /params\.set\("q", body\.query\)/);
assert.match(edge, /body\.structuredAddress\[field\]/);
assert.doesNotMatch(edge, /params\.set\("q"[^}]+structuredAddress/s);
assert.match(edge, /upstream\.status === 429/);
assert.match(edge, /Retry-After/);
assert.match(edge, /controller\.abort/);
assert.match(edge, /inflight\.has\(key\)/);
assert.match(edge, /gridly_reserve_geocode_provider_slot/);
assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(edgeBytes));
assert.match(edge, /attribution: "© OpenStreetMap contributors"/);
assert.doesNotMatch(edge, /Â© OpenStreetMap contributors/);
assert.match(edge, /http:\/\/localhost:5500/);
assert.match(edge, /http:\/\/127\.0\.0\.1:5500/);
assert.match(migration, /cache_key text primary key check \(cache_key ~ '\^\[a-f0-9\]\{64\}\$'\)/);
assert.match(migration, /greatest\(next_allowed_at, cooldown_until, clock_timestamp\(\)\)/);
for (const table of ['gridly_geocode_cache', 'gridly_geocode_provider_state']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
  assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated;`));
  assert.match(migration, new RegExp(`grant select, insert, update, delete\\s+on table public\\.${table}\\s+to service_role;`));
  assert.doesNotMatch(migration, new RegExp(`grant [^;]+on (?:table )?public\\.${table}[^;]+to (?:anon|authenticated|public)`, 'i'));
}
for (const rpc of ['gridly_reserve_geocode_provider_slot', 'gridly_cooldown_geocode_provider']) {
  assert.match(migration, new RegExp(`revoke all on function public\\.${rpc}\\(text, integer\\) from public, anon, authenticated;`));
  assert.match(migration, new RegExp(`grant execute\\s+on function public\\.${rpc}\\(text, integer\\)\\s+to service_role;`));
  assert.doesNotMatch(migration, new RegExp(`grant execute\\s+on function public\\.${rpc}\\(text, integer\\)\\s+to (?:anon|authenticated|public)`, 'i'));
}
assert.doesNotMatch(client, /localStorage|sessionStorage|console\./i);
const auditStart = app.indexOf('const gridlyLp100RuntimeEvidence = [];');
const auditEnd = app.indexOf('\nwindow.gridlySearchAddress = gridlySearchAddress;', auditStart);
assert.ok(auditStart >= 0 && auditEnd > auditStart);
const auditSource = app.slice(auditStart, auditEnd);
assert.doesNotMatch(auditSource, /localStorage|sessionStorage|indexedDB|console\.|supabase/i);
const certificationFields = {
  globalRateGovernanceVerified: true,
  rejectedOriginPass: true,
  providerStateRowObserved: true,
  providerNamespaceObserved: true,
  persistentReservationTimestampObserved: true,
  rejectedOriginHttp403Observed: true
};
function loadAudit({ reached = false, explicit = false } = {}) {
  const evidence = reached ? [{ event: 'gridly_endpoint_response_received', status: 'success', queryRedacted: true }] : [];
  const source = explicit
    ? auditSource.replace('const gridlyLp100RuntimeEvidence = [];', "const gridlyLp100RuntimeEvidence = [{ event: 'remote_search_explicit_action' }];")
    : auditSource;
  const context = {
    window: { gridlyGeocodingClient: { endpoint: 'gridly-geocode', evidence: () => evidence, directProviderRequestCount: () => 0 } },
    document: { getElementById: () => ({}) }, Object, Array, Boolean, Number, TypeError
  };
  vm.runInNewContext(source, context);
  return context.window;
}
let auditWindow = loadAudit();
assert.equal(typeof auditWindow.gridlyRecordLp100InfrastructureCertification, 'function');
assert.equal(auditWindow.gridlyLp100GeocodingBoundaryAudit().milestone, 'LP100.1');
assert.equal(auditWindow.gridlyLp100GeocodingBoundaryAudit().globalRateGovernanceVerified, false);
assert.equal(auditWindow.gridlyLp100GeocodingBoundaryAudit().rejectedOriginPass, null);
assert.equal(auditWindow.gridlyLp100GeocodingBoundaryAudit().safeToMerge, false);
for (const invalid of [
  { ...certificationFields, query: 'private' },
  { ...certificationFields, url: 'https://example.test' },
  { ...certificationFields, Origin: 'https://example.test' },
  { ...certificationFields, authorizationHeader: 'secret' },
  { ...certificationFields, coordinates: [1, 2] },
  { ...certificationFields, providerStateRow: { next_allowed_at: 'value' } },
  { ...certificationFields, checkedAt: 'timestamp' },
  { ...certificationFields, providerStateRowObserved: 'true' },
  Object.fromEntries(Object.entries(certificationFields).slice(1))
]) assert.throws(() => auditWindow.gridlyRecordLp100InfrastructureCertification(invalid), TypeError);
assert.equal(auditWindow.gridlyLp100GeocodingBoundaryAudit().infrastructureCertificationRecordedThisSession, false);
let recorded = auditWindow.gridlyRecordLp100InfrastructureCertification(certificationFields);
assert.equal(recorded.globalRateGovernanceVerified, false, 'endpoint evidence is required');
assert.equal(recorded.rejectedOriginPass, null, 'approved-origin evidence is required');
assert.equal(recorded.safeToMerge, false);
auditWindow = loadAudit({ reached: true, explicit: true });
recorded = auditWindow.gridlyRecordLp100InfrastructureCertification({ ...certificationFields, persistentReservationTimestampObserved: false });
assert.equal(recorded.globalRateGovernanceVerified, false, 'all provider-state evidence is required');
assert.equal(recorded.safeToMerge, false);
auditWindow = loadAudit({ reached: true, explicit: true });
recorded = auditWindow.gridlyRecordLp100InfrastructureCertification({ ...certificationFields, rejectedOriginHttp403Observed: false });
assert.equal(recorded.rejectedOriginPass, null, 'HTTP 403 evidence is required');
assert.equal(recorded.safeToMerge, false);
auditWindow = loadAudit({ reached: true, explicit: true });
recorded = auditWindow.gridlyRecordLp100InfrastructureCertification(certificationFields);
assert.equal(recorded.globalRateGovernanceVerified, true);
assert.equal(recorded.rejectedOriginPass, true);
assert.equal(recorded.safeToMerge, true);
assert.equal(recorded.safeForPublicLaunch, false);
assert.equal(recorded.runtimeEvidence.length, 2, 'existing runtime evidence is preserved');
const sandbox = { window: { crypto: { randomUUID: () => 'id' } }, fetch: async () => ({ json: async () => ({ ok: true, status: 'success', providerBoundary: 'gridly', cached: false, requestId: 'id', results: [] }) }) };
vm.runInNewContext(client, sandbox);
assert.equal(sandbox.window.gridlyGeocodingClient.endpoint.includes('gridly-geocode'), true);
assert.equal(sandbox.window.gridlyGeocodingClient.failureMessages.provider_timeout, 'Search is taking longer than expected. Please try again.');
console.log('LP100 geocoding boundary contracts passed.');
