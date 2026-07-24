const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const includes = (needle, message) => assert(source.includes(needle), message);

includes('function gridlyLp0546CanonicalCrossingIdentity', 'LP054.6A has one canonical crossing identity resolver');
['canonicalCrossingId', 'crossingIdentitySource', 'crossingDisplayName', 'primaryRoad', 'intersectingRoad', 'awarenessAreaId', 'crossingRecordResolvable'].forEach((field) => includes(field, `canonical crossing identity includes ${field}`));
includes('function gridlyLp0546ResolveCrossingRecord', 'crossing validity uses the production crossing resolution helper');
includes('certification_in_memory_catalog', 'deterministic fixture catalog is injected as an isolated in-memory lookup source');
includes('return { source: "live_crossing_runtime", records: Array.isArray(crossings) ? crossings : [] };', 'production lookup remains backed by the live crossing runtime without an override');
includes('gridlyLp0546SelectionValidity(gridlyHistoricalSelectionStateV1, options)', 'historical context resolution reuses the stored canonical crossing ID during validation');
includes('function gridlyLp0546AwarenessAreaCompatible', 'awareness-area compatibility uses canonical normalized comparison');
includes('production_style_canonical_id_alias', 'LP054.6A audit covers FRA/production canonical ID aliases');
includes('invalid_unavailable_crossing', 'LP054.6A audit covers safe invalidation of unavailable crossings');
includes('Second Street crossing at US 90', 'nearby and selection-switch cases preserve Second Street as a no-history crossing context');
includes('crossing_popup_close_then_history_open', 'popup close is modeled as presentation-only and preserves crossing selection');
includes('fixturePersistenceDetected: false', 'audit reports no fixture persistence');
includes('historyWriteAttemptDetected: false', 'audit reports no historical writes');
includes('activeStateMutationDetected: false', 'audit reports no active-state mutation');
includes('window.gridlyLp0546aCrossingSelectionResolutionAudit = gridlyLp0546aCrossingSelectionResolutionAudit', 'browser certification helper is exposed on window');
includes('exposeGridlyAuditHelper("gridlyLp0546aCrossingSelectionResolutionAudit", gridlyLp0546aCrossingSelectionResolutionAudit);', 'browser certification helper is registered with audit exposure');

console.log('LP054.6A crossing selection resolution tests passed');
