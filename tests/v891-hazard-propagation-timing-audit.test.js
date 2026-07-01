const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V891-HAZARD-PROPAGATION-TIMING-AUDIT.md', 'utf8');

assert(app.includes('GRIDLY_HAZARD_PROPAGATION_TIMING_AUDIT_VERSION = "V891-hazard-propagation-timing-audit"'), 'V891 audit version is present');
assert(app.includes('window.gridlyHazardPropagationTimingAudit = gridlyHazardPropagationTimingAudit'), 'timing audit helper is exposed');
assert(app.includes('window.gridlyVerifyHazardVisibleForDevice = gridlyVerifyHazardVisibleForDevice'), 'cross-device verification helper is exposed');
assert(app.includes('window.gridlyRefreshAndVerifyHazardVisible = gridlyRefreshAndVerifyHazardVisible'), 'refresh-and-verify helper is exposed');
assert(app.includes('window.gridlyHazardPropagationReadinessAudit = gridlyHazardPropagationReadinessAudit'), 'readiness audit helper is exposed');

[
  'report_flow_opened',
  'hazard_type_selected',
  'location_selected',
  'submit_tapped',
  'validation_complete',
  'supabase_write_started',
  'supabase_write_completed',
  'local_refresh_requested',
  'local_incident_source_refreshed',
  'local_marker_rendered',
  'local_alerts_updated',
  'local_community_pulse_know_before_you_go_updated'
].forEach((stage) => assert(app.includes(stage), `stage ${stage} is instrumented`));

assert(app.includes('gridlyHazardPropagationFingerprint'), 'report fingerprint fallback exists');
assert(app.includes('protectedSystemsUnchanged: true'), 'protected systems unchanged flag exists');
assert(app.includes('auditOnly: true'), 'audit-only flag exists');
assert(app.includes('await loadSharedReports("V891_refresh_and_verify_hazard_visible")'), 'refresh helper uses existing normal refresh path');

assert(doc.includes('Purpose'), 'documentation includes purpose');
assert(doc.includes('Timing stages'), 'documentation includes timing stages');
assert(doc.includes('Local-device verification protocol'), 'documentation includes local-device protocol');
assert(doc.includes('Second-device verification protocol'), 'documentation includes second-device protocol');
assert(doc.includes('Copying the report id or fingerprint'), 'documentation explains copying id/fingerprint');
assert(doc.includes('Beta acceptance thresholds'), 'documentation includes beta thresholds');
assert(doc.includes('Protected systems confirmation'), 'documentation confirms protected systems');

console.log('v891-hazard-propagation-timing-audit.test.js passed');
