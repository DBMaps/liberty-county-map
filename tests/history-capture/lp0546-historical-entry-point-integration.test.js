const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /let gridlyHistoricalSelectionStateV1 = Object\.freeze/, 'LP054.6 in-memory selection owner exists');
assert.match(source, /function gridlyLp0546BindCrossingSelection/, 'crossing selection binder exists');
assert.match(source, /function gridlyLp0546BindIncidentSelection/, 'incident selection binder exists');
assert.match(source, /gridlyLp0546BindCrossingSelection\?\.\(crossing, "crossing_marker"\)/, 'crossing marker click binds exact crossing context');
assert.match(source, /gridlyLp0546BindCrossingSelection\?\.\(crossing, "crossing_popup"\)/, 'crossing popup open refreshes current crossing context only');
assert.match(source, /gridlyLp0546BindCrossingSelection\?\.\(\{[\s\S]*"crossing_alert"\)/, 'crossing alert focus binds canonical crossing context');
assert.match(source, /gridlyLp0546BindIncidentSelection\?\.\(matchingAlert[\s\S]*"community_alert"/, 'community alert focus binds canonical incident context');
assert.match(source, /marker\.on\("click", \(\) => gridlyLp0546BindIncidentSelection\?\.\(incident[\s\S]*"community_marker"/, 'community marker click binds canonical incident location');
assert.match(source, /marker\.on\("popupopen"[\s\S]*"community_popup"/, 'community popup open refreshes current incident context only');
assert.match(source, /"official_marker"|"official_alert"|"official_popup"/, 'official source surfaces are represented separately');
assert.match(source, /function gridlyLp0546SelectionValidity[\s\S]*awareness_area_changed[\s\S]*selected_crossing_unavailable[\s\S]*selected_incident_unavailable/, 'selection validity invalidates area changes and unavailable records');
assert.match(source, /function gridlyBuildHistoricalIntelligenceSheetHtmlWithBuilderMemo\(options = \{\}\)[\s\S]*gridlyLp0546ResolveSelectionContext/, 'historical sheet open resolves latest meaningful runtime selection inside the builder-scoped memo wrapper');
assert.match(source, /window\.gridlyHistoricalSelectionDebug = gridlyHistoricalSelectionDebug/, 'selection debug helper is exposed');
assert.match(source, /window\.gridlyLp0546HistoricalEntryPointIntegrationAudit = gridlyLp0546HistoricalEntryPointIntegrationAudit/, 'LP054.6 browser audit helper is exposed');
assert.match(source, /crossing_marker_selection[\s\S]*crossing_alert_selection[\s\S]*nearby_crossing_selection[\s\S]*community_marker_selection[\s\S]*community_alert_selection[\s\S]*official_marker_selection[\s\S]*selection_switch[\s\S]*awareness_area_change[\s\S]*no_selection[\s\S]*popup_close_preserves_selection/, 'all required deterministic LP054.6 audit cases are present');
const lp0546Section = source.slice(source.indexOf('const GRIDLY_LP0546_SELECTION_CONTEXT_VERSION'), source.indexOf('function gridlyLp0545DistanceMeters'));
assert.doesNotMatch(lp0546Section, /localStorage|sessionStorage|MutationObserver|setInterval/, 'LP054.6 selection state remains in memory without persistence, mutation observers, or polling');
assert.doesNotMatch(lp0546Section, /setTimeout/, 'LP054.6 selection validity uses explicit state, not timeout clearing');

console.log('LP054.6 historical entry-point integration static coverage passed');
