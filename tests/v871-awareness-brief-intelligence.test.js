const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('function buildGridlyAwarenessBriefConditionSummary'), 'V871 condition summary helper is present');
assert(source.includes('activeAwarenessSamples.priority_diversity'), 'V871 reuses existing active-awareness priority samples');
assert(source.includes('Also affecting travel:'), 'V871 supports multiple active-condition brief language');
assert(source.includes('View map for the complete picture.'), 'V871 preserves map-first complete-picture guidance');
assert(source.includes('window.gridlyAwarenessBriefIntelligenceModel = textModel.awarenessBrief || null;'), 'V871 exposes Awareness Brief presentation model only after existing shared snapshot');
assert(!/gridlyBriefInteractionWeatherBridge\(\{ requireLocality: false \}\).*weather\.hidden = !model\.weather/s.test(source), 'weather rendering remains locality-gated through gridlyBriefInteractionWeatherModel');

console.log('V871 Awareness Brief Intelligence audit passed');
