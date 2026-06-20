const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(fragment, message) {
  assert(source.includes(fragment), message);
}

// Top Awareness crossing headlines must not promote raw source-title phrasing like
// "ROGERS ROAD train blocking crossing" ahead of the cleaned crossing formatter.
includes('function isGridlyRawSourceTitleCrossingAlertText(value = "")', 'raw source-title crossing detector exists');
includes('if (isGridlyRawSourceTitleCrossingAlertText(text)) return true;', 'raw source-title crossing copy is treated as generic before crossing location fallback');
includes('/^(?!train blocking crossing\\b)[a-z0-9 .\'-]+\\s+train blocking crossing$/i.test(text)', 'detector catches road-prefixed train blocking crossing source titles');
includes('text: road && crossing ? `Train Blocking Crossing near ${road} at ${crossing}` : (road ? `Train Blocking Crossing near ${road}` : "Train Blocking Crossing")', 'clean crossing formatter remains the location-field fallback');
includes('if (text && !isGridlyGenericCrossingAlertText(text)) return { text, source: "crossing.alreadyRenderedCleanAlertText", location: specificLocation || null };', 'already-clean alert card wording remains reusable and unchanged');
includes('addCandidate(crossing.text, crossing.source || "crossing.locationFields", "crossing_location_headline");', 'top awareness still uses the shared crossing alert candidate source');

console.log('v633_8TopAwarenessCrossingCopyFormatter.test.js passed');
