const assert = require("node:assert/strict");
const fs = require("node:fs");
const boundary = require("../js/historical-intelligence-activation-boundary.js");

const selected = {
  status: "selected",
  selectedNarrative: "Weekday congestion has frequently been reported near US 90. Check current alerts for live conditions.",
  narrativeType: "congestion",
  subject: "US 90",
  historicalWindow: { firstObservedAt: "2026-05-01T13:30:00.000Z", lastObservedAt: "2026-07-20T13:30:00.000Z" },
  rankingMetadata: { usefulnessScore: 99, duplicateSuppressions: ["private"] },
  selectedCandidate: { canonicalId: "private-id", confidenceCategory: "meaningful" },
  productionIntegration: false,
  consumerVisible: false
};

const dto = boundary.createPresentationDto(selected);
assert.deepEqual(Object.keys(dto), boundary.DTO_FIELDS);
assert.equal(Object.isFrozen(dto), true);
assert.equal(dto.historicalTakeaway, selected.selectedNarrative);
assert.equal(dto.liveConditionGuidance, "Check current alerts for live conditions.");
assert.equal(dto.quiet, false);
assert.equal(dto.displayEligible, true);
["rankingMetadata", "confidenceCategory", "selectedCandidate", "canonicalId", "selectionReason", "relevanceReason", "productionIntegration", "consumerVisible"]
  .forEach((field) => assert.equal(Object.hasOwn(dto, field), false));
assert.doesNotMatch(JSON.stringify(dto), /usefulnessScore|duplicateSuppressions|private-id|confidence/i);

const quiet = boundary.createPresentationDto({ status: "quiet", rankingMetadata: { quietReason: "private" }, productionIntegration: false, consumerVisible: false });
assert.deepEqual(Object.keys(quiet), boundary.DTO_FIELDS);
assert.deepEqual(quiet, boundary.quietDto());
assert.equal(quiet.quiet, true);
assert.equal(quiet.displayEligible, false);
assert.equal(quiet.historicalTakeaway, null);
assert.doesNotMatch(JSON.stringify(quiet), /private|placeholder|unavailable/i);

assert.equal(boundary.ACTIVATION.productionIntegration, false);
assert.equal(boundary.ACTIVATION.consumerVisible, false);
assert.equal(boundary.ACTIVATION.optInRequired, true);
assert.deepEqual(boundary.ACTIVATION.prerequisiteMilestones, ["LP067", "LP068", "LP069", "LP070", "future-presentation-milestone"]);
assert.equal(boundary.OWNERSHIP.owner, "Know Before You Go Historical Intelligence surface");
assert.equal(boundary.OWNERSHIP.ownershipToken, "know-before-you-go-historical-intelligence");
assert.equal(boundary.OWNERSHIP.authorizedHost, '[data-gridly-owner="know-before-you-go-historical-intelligence"]');
assert.equal(boundary.OWNERSHIP.lifecycleOwner, boundary.OWNERSHIP.owner);
assert.equal(boundary.OWNERSHIP.detachOwner, boundary.OWNERSHIP.owner);
assert.match(boundary.OWNERSHIP.interactionExpectation, /current-alerts-remain-authoritative/);

const authority = { now: "2026-07-27T13:30:00Z", utcOffsetMinutes: -300 };
assert.deepEqual(boundary.acceptLocalTimeAuthority(authority), authority);
assert.equal(boundary.acceptLocalTimeAuthority({ now: "invalid", utcOffsetMinutes: -300 }), null);
assert.equal(boundary.acceptLocalTimeAuthority({ now: authority.now }), null);
assert.equal(boundary.LOCAL_TIME_AUTHORITY.source, "awareness-context");
assert.match(boundary.LOCAL_TIME_AUTHORITY.consumerRule, /unchanged-no-derived-clock/);

const productionDocument = fs.readFileSync("index.html", "utf8");
const productionRuntime = fs.readFileSync("js/app.js", "utf8");
assert.doesNotMatch(productionDocument, /historical-intelligence-activation-boundary|lp070/i);
assert.doesNotMatch(productionRuntime, /historical-intelligence-activation-boundary|lp070/i);
assert.equal(fs.existsSync("tests/lp070-browser-certification.html"), true);

console.log("LP070 historical intelligence activation boundary certification passed");
