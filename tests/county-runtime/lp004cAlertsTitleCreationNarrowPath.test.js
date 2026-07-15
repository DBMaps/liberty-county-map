const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'app.js'), 'utf8');

const titleForMatch = source.match(/const titleFor = alert => \{([\s\S]*?)\n      \};\n\n      const isRailBlockedTitle/);
assert(titleForMatch, 'Alerts titleFor helper exists in the Alerts renderer');
const titleForBody = titleForMatch[1];

const eventTitleCallIndex = titleForBody.indexOf('return eventCenteredTitleFor(alert);');
assert(eventTitleCallIndex >= 0, 'non-rail Alerts titles resolve through the narrow event-centered title helper');

const broadCalls = [
  'buildGridlyRoadHazardTxDotStyleCandidate',
  'resolveRoadHazardSegmentHeadline',
  'chooseBestAlertLocationContext',
  'resolveGridlyV313RoadHazardCommunityDistance',
  'gridlyRoadHazardPrimaryCorridorEvidence'
];
for (const helper of broadCalls) {
  const helperIndex = titleForBody.indexOf(helper);
  assert(helperIndex === -1 || helperIndex > eventTitleCallIndex,
    `event-centered title path must not invoke broad helper ${helper}`);
}

const eventTitleMatch = source.match(/const eventCenteredTitleFor = \(alert = \{\}\) => \{([\s\S]*?)\n      \};\n      const titleFor/);
assert(eventTitleMatch, 'eventCenteredTitleFor helper exists');
const eventTitleBody = eventTitleMatch[1];
assert(eventTitleBody.includes('event-centered situation label'), 'event-centered situation label is the first title source');
assert(eventTitleBody.includes('normalized category/type label'), 'normalized category/type label is a title source');
assert(eventTitleBody.includes('consumer-safe alert title'), 'consumer-safe alert title is a title source');
assert(eventTitleBody.includes('Travel Alert'), 'small local fallback remains available');

const auditReturnMatch = source.match(/function gridlyAlertsCardRenderProfileAudit\(\) \{([\s\S]*?)\n\}\nif \(typeof window !== "undefined"\) window\.gridlyAlertsCardRenderProfileAudit/);
assert(auditReturnMatch, 'Alerts card render profile audit exists');
const auditBody = auditReturnMatch[1];
[
  'titleSource',
  'titleFunctionChain',
  'broadTitleDependencyInvoked',
  'titleFallbackUsed',
  'firstTitleDurationMs',
  'subsequentTitleDurationMs'
].forEach((field) => assert(auditBody.includes(field), `profile audit exposes ${field}`));

assert(!eventTitleBody.includes('buildGridlyRoadHazardTxDotStyleCandidate'), 'event-centered title helper does not call TxDOT road/corridor evaluation');
assert(!eventTitleBody.includes('resolveRoadHazardSegmentHeadline'), 'event-centered title helper does not call road segment resolution');
assert(!eventTitleBody.includes('chooseBestAlertLocationContext'), 'event-centered title helper does not call location resolution');
