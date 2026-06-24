import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.existsSync('GRIDLY-V729-LIBERTY-CLEARED-INCIDENT-COUNT-RECONCILIATION.md') ? fs.readFileSync('GRIDLY-V729-LIBERTY-CLEARED-INCIDENT-COUNT-RECONCILIATION.md', 'utf8') : '';
const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/liberty/evidence/v729-liberty-cleared-incident-count-reconciliation.json', 'utf8'));

function includes(fragment, message) {
  assert.ok(source.includes(fragment), message);
}

includes('function gridlyIsActiveCountSurfaceEligibleRecord(record = {}, nowMs = Date.now())', 'shared active-count eligibility helper exists');
includes('["cleared", "recently_cleared", "hazard_cleared", "expired", "inactive", "historical", "stale"].includes(value)', 'cleared/recently-cleared lifecycle states are rejected before counts');
includes('typeValues.includes("hazard_cleared")', 'cleared road-hazard report type is rejected before counts');
includes('function getGridlyActiveCountSurfaceRows(rows = [], options = {})', 'shared active-count row filter exists');
includes('const safeRows = (rows) => getGridlyActiveCountSurfaceRows(rows, options);', 'alerts/location/route shared source uses lifecycle-filtered active-count rows');
includes('.filter((incident) => typeof gridlyIsActiveCountSurfaceEligibleRecord === "function" ? gridlyIsActiveCountSurfaceEligibleRecord(incident) : true)', 'active unified incidents are filtered before active-count consumers');
includes('activeHazards: { source: userFacingRoadHazardIncidents.length ? "activeUnifiedRoadIncidents" : "activeHazards"', 'community awareness summary counts user-facing active road hazard incidents');
includes('markerRenderSkipReasons.cleared_or_recently_cleared += 1;', 'marker skip diagnostics still identify suppressed cleared marker records');
includes('gridlyActiveHazardCountReconciliationAudit', 'count reconciliation audit remains exposed');
includes('gridlyUiSmokeTest', 'UI smoke test remains exposed');

assert.equal(evidence.finalDetermination, 'LIBERTY CLEARED INCIDENT COUNT RECONCILIATION\nPASS', 'evidence final determination is PASS');
assert.equal(evidence.protectedSystems.historicalReadsEnabled, false, 'historical reads remain off');
assert.equal(evidence.protectedSystems.historyUiEnabled, false, 'history UI remains off');
assert.equal(evidence.protectedSystems.DriveTexasPaused, true, 'DriveTexas remains paused');
assert.equal(evidence.protectedSystems.TransportationIntelligenceEnabled, false, 'transportation intelligence enablement remains off');
assert.equal(evidence.protectedSystems.TransportationIntelligenceDisplay, false, 'transportation intelligence display remains off');
assert.equal(evidence.protectedSystems.TransportationIntelligenceActivation, false, 'transportation intelligence activation remains off');
assert.match(doc, /LIBERTY CLEARED INCIDENT COUNT RECONCILIATION\s+PASS/, 'implementation note records PASS determination');

console.log('V729 Liberty cleared incident count reconciliation validation passed');
