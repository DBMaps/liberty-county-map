const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert.match(source, /let gridlyHistoricalIntelligenceContextV1 = null/, 'canonical in-memory context object exists');
assert.match(source, /function gridlySetHistoricalIntelligenceContext/, 'focused context setter is exposed');
assert.match(source, /function gridlyResolveHistoricalIntelligenceContext/, 'focused context resolver is exposed');
assert.match(source, /selectedCrossing[\s\S]*selectedCommunityIncident[\s\S]*selectedMapLocation[\s\S]*awareness_area/, 'resolver preserves exact context priority before awareness fallback');
assert.match(source, /GRIDLY_LP0545_GEO_FALLBACK_THRESHOLD_METERS = 60/, 'bounded geographic fallback threshold is documented in code');
assert.match(source, /canonical_crossing_identity/, 'canonical crossing identity matching is present');
assert.match(source, /canonical_location_identity/, 'canonical location identity matching is present');
assert.match(source, /lp0545MatchAudit/, 'context filtering audit is captured before pattern building');
assert.match(source, /gridlyLp0543BuildConsumerPatternFromFinding/, 'independent incident pattern building remains present');
assert.match(source, /data-gridly-history-consumer-subject="true"/, 'consumer-safe subject line renders from bound context');
assert.match(source, /Waco Street crossing at US 90/, 'Waco Street deterministic fixture exists');
assert.match(source, /FRA-NEARBY-SECOND/, 'nearby second crossing isolation fixture exists');
assert.match(source, /Flooding near FM 1960/, 'community flooding location fixture exists');
assert.match(source, /County Road 602/, 'same-county unrelated fixture exists');
assert.match(source, /gridlyLp0545HistoricalContextBindingCertification/, 'browser certification helper exists');
assert.match(source, /window\.gridlyLp0545HistoricalContextBindingAudit = gridlyLp0545HistoricalContextBindingAudit/, 'LP054.5 audit is exposed on window');

console.log('LP054.5 historical context binding static coverage passed');
