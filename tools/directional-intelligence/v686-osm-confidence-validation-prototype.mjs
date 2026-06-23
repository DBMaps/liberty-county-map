import fs from 'node:fs';
import path from 'node:path';

const segmentPath = 'assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json';
const v685EvidencePath = 'assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json';
const v684EvidencePath = 'assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json';
const outputPath = 'assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json';

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
};

function readJson(filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) return { filePath, exists, parseValid: false, data: null, error: 'missing input artifact' };
  try {
    return { filePath, exists, parseValid: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) };
  } catch (error) {
    return { filePath, exists, parseValid: false, data: null, error: error.message };
  }
}

function detectSegmentShape(data) {
  if (Array.isArray(data)) return { shape: 'array', segments: data };
  for (const key of ['segments', 'segmentRecords', 'records', 'items', 'features']) {
    if (Array.isArray(data?.[key])) return { shape: `object.${key} array`, segments: data[key] };
  }
  return { shape: 'unsupported', segments: [] };
}

function normalizeRecordText(segment) {
  return [segment.sourceRef, segment.sourceFutureRef, segment.sourceName, segment.sourceTigerNameBase, segment.highway, segment.corridorId].filter(Boolean).join(' | ');
}

function hasCorridorEvidence(segment) {
  const text = normalizeRecordText(segment);
  return segment.corridorId === 'us59-i69' || /\bI\s*-?\s*69\b/i.test(text) || /\bUS\s*-?\s*59\b/i.test(text) || /United States Highway 59/i.test(text);
}

function isGeometryValid(segment) {
  const g = segment.geometrySummary;
  return Boolean(g && g.coordinateCount >= 2 && Array.isArray(g.startCoordinate) && Array.isArray(g.endCoordinate) && Array.isArray(g.bbox));
}

function hasSourceIdentity(segment) {
  return Boolean(segment.sourceWayId || segment.osmWayId || segment.id);
}

function hasRefEvidence(segment) {
  return Boolean(segment.sourceRef || segment.sourceFutureRef || segment.evidenceSignals?.hasRef || segment.evidenceSignals?.hasFutureRef);
}

function isHovHot(segment) {
  const signals = segment.evidenceSignals || {};
  const risk = segment.riskTags || {};
  return Boolean(signals.isHovHot || risk['hov:conditional'] || risk['hov:minimum'] || /\b(HOV|HOT)\b/i.test(normalizeRecordText(segment)));
}

function hasFixme(segment) {
  const signals = segment.evidenceSignals || {};
  const risk = segment.riskTags || {};
  return Boolean(signals.hasFixme || risk.fixme || risk.FIXME);
}

function isConstruction(segment) {
  return Boolean(segment.evidenceSignals?.isConstruction || segment.riskTags?.construction || segment.highway === 'construction');
}

function isReversible(segment) {
  const conditional = String(segment.onewayConditional || '');
  return Boolean(segment.evidenceSignals?.isReversible || /-1/.test(conditional));
}

function addCount(object, key, increment = 1) {
  const normalized = key || '__MISSING__';
  object[normalized] = (object[normalized] || 0) + increment;
}

function addNestedCount(object, outer, inner) {
  const normalizedOuter = outer || '__MISSING__';
  if (!object[normalizedOuter]) object[normalizedOuter] = {};
  addCount(object[normalizedOuter], inner);
}

function samplePush(samples, key, value, limit = 10) {
  if (!samples[key]) samples[key] = [];
  if (samples[key].length < limit) samples[key].push(value);
}

const inputs = [readJson(segmentPath), readJson(v685EvidencePath), readJson(v684EvidencePath)];
if (inputs.some((input) => !input.exists || !input.parseValid)) {
  console.error('V686 input validation failed before audit could run.', inputs.map(({filePath, exists, parseValid, error}) => ({filePath, exists, parseValid, error})));
  process.exit(1);
}

const [segmentInput, v685Input, v684Input] = inputs;
const detected = detectSegmentShape(segmentInput.data);
if (detected.shape === 'unsupported') {
  console.error('V686 segment inventory shape unsupported.');
  process.exit(1);
}

const v685Distribution = v685Input.data?.confidencePrerequisiteReadiness?.distribution || {};
const v685Samples = v685Input.data?.confidencePrerequisiteReadiness?.samples || {};
const readyIds = new Set(v685Samples.confidence_ready_candidate || []);
const reviewIds = new Set(v685Samples.confidence_review_required || []);
const blockedIds = new Set(v685Samples.confidence_blocked || []);

const confidenceStateDistribution = {
  confidence_candidate_strong: 0,
  confidence_candidate_limited: 0,
  confidence_review_required: 0,
  confidence_blocked: 0
};
const countyDistributionByConfidenceState = {};
const highwayDistributionByConfidenceState = {};
const reviewBucketDistributionByConfidenceState = {};
const reductionSignalDistribution = {};
const cappedSamples = { byState: {}, byBlockingReason: {}, byReviewReason: {}, bearingOnlyBlocked: [] };
const evidenceRecords = [];
let bearingOnlyCandidateCount = 0;
let bearingOnlyBlockedCount = 0;
let promotedFromReviewCount = 0;
let demotedFromReadyCount = 0;
let newlyBlockedCount = 0;
let alignedCount = 0;

for (const segment of detected.segments) {
  const signals = segment.evidenceSignals || {};
  const coreSignals = [];
  const supportingSignals = [];
  const reductionSignals = [];
  const blockingReasons = [];
  const reviewReasons = Array.isArray(segment.reviewReasons) ? segment.reviewReasons.filter((reason) => reason !== 'none') : [];

  if (isGeometryValid(segment)) coreSignals.push('valid_geometry_summary'); else { reductionSignals.push('missing_geometry'); blockingReasons.push('geometry_invalid'); }
  if (hasCorridorEvidence(segment)) coreSignals.push('corridor_evidence'); else { reductionSignals.push('non_primary_corridor'); blockingReasons.push('non_primary_corridor'); }
  if (segment.county || signals.hasCounty) coreSignals.push('county_attribution'); else reductionSignals.push('missing_county');
  if (segment.oneway || signals.hasOneway) coreSignals.push('oneway_evidence'); else reductionSignals.push('missing_oneway');

  if (segment.lanes || signals.hasLanes) supportingSignals.push('lanes');
  if (segment.turnLanes || signals.hasTurnLanes) supportingSignals.push('turn_lanes');
  if (segment.destinationLanes || signals.hasDestinationLanes) supportingSignals.push('destination_lanes');
  if (signals.hasStrategicTags || Object.values(segment.strategicTags || {}).some(Boolean)) supportingSignals.push('strategic_tags');
  if (hasSourceIdentity(segment)) supportingSignals.push('source_identity'); else blockingReasons.push('missing_source_identity');

  if (isReversible(segment)) reductionSignals.push('reversible_lane');
  if (String(segment.onewayConditional || '').includes('-1')) reductionSignals.push('oneway_conditional_negative_one');
  if (isConstruction(segment)) reductionSignals.push('construction_segment');
  if (isHovHot(segment)) reductionSignals.push('hov_hot_lane');
  if (hasFixme(segment)) reductionSignals.push('fixme_tags');
  if (!segment.county && !signals.hasCounty) reductionSignals.push('missing_county');
  if (!segment.oneway && !signals.hasOneway) reductionSignals.push('missing_oneway');
  if (!hasRefEvidence(segment)) reductionSignals.push('missing_ref_or_fut_ref');
  if (segment.extractionStatus === 'rejected') { reductionSignals.push('rejected_extraction_status'); blockingReasons.push('rejected_extraction_status'); }

  const uniqueReductionSignals = [...new Set(reductionSignals)];
  const nonGeometryDirectionalSignals = [
    hasCorridorEvidence(segment), segment.county || signals.hasCounty, segment.oneway || signals.hasOneway,
    hasRefEvidence(segment), segment.lanes || signals.hasLanes, segment.turnLanes || signals.hasTurnLanes,
    segment.destinationLanes || signals.hasDestinationLanes, signals.hasStrategicTags || Object.values(segment.strategicTags || {}).some(Boolean), hasSourceIdentity(segment)
  ].filter(Boolean).length;
  const hasBearingOnlyEvidence = isGeometryValid(segment) && typeof segment.geometrySummary?.approximateBearingDegrees === 'number' && nonGeometryDirectionalSignals === 0;
  if (hasBearingOnlyEvidence) { bearingOnlyCandidateCount += 1; blockingReasons.push('bearing_only_geometry_evidence'); }

  let state;
  const hasBlockingRisk = blockingReasons.length > 0;
  const hasReviewRisk = segment.extractionStatus === 'extracted_with_review' || reviewReasons.length > 0 || uniqueReductionSignals.some((reason) => ['reversible_lane','oneway_conditional_negative_one','construction_segment','hov_hot_lane','fixme_tags','missing_county','missing_oneway','missing_ref_or_fut_ref'].includes(reason));
  const strongReady = coreSignals.length === 4 && supportingSignals.includes('source_identity') && reviewReasons.length === 0 && uniqueReductionSignals.length === 0 && segment.extractionStatus === 'extracted';
  const limitedReady = isGeometryValid(segment) && hasCorridorEvidence(segment) && (segment.oneway || signals.hasOneway) && hasSourceIdentity(segment) && !hasReviewRisk && !hasBlockingRisk;

  if (hasBlockingRisk || hasBearingOnlyEvidence) state = 'confidence_blocked';
  else if (reviewIds.has(segment.segmentId) || segment.extractionStatus === 'extracted_with_review' || hasReviewRisk) state = 'confidence_review_required';
  else if (strongReady) state = 'confidence_candidate_strong';
  else if (limitedReady) state = 'confidence_candidate_limited';
  else state = 'confidence_review_required';

  if (hasBearingOnlyEvidence && state === 'confidence_blocked') bearingOnlyBlockedCount += 1;
  if (reviewIds.has(segment.segmentId) && state.startsWith('confidence_candidate')) promotedFromReviewCount += 1;
  if (readyIds.has(segment.segmentId) && !state.startsWith('confidence_candidate')) demotedFromReadyCount += 1;
  if (!blockedIds.has(segment.segmentId) && state === 'confidence_blocked') newlyBlockedCount += 1;
  if ((readyIds.has(segment.segmentId) && state.startsWith('confidence_candidate')) || (reviewIds.has(segment.segmentId) && ['confidence_review_required','confidence_blocked'].includes(state)) || (blockedIds.has(segment.segmentId) && state === 'confidence_blocked')) alignedCount += 1;

  confidenceStateDistribution[state] += 1;
  addNestedCount(countyDistributionByConfidenceState, state, segment.county || '__MISSING__');
  addNestedCount(highwayDistributionByConfidenceState, state, segment.highway || '__MISSING__');
  addNestedCount(reviewBucketDistributionByConfidenceState, state, segment.reviewBucket || '__MISSING__');
  for (const reductionSignal of uniqueReductionSignals) addCount(reductionSignalDistribution, reductionSignal);

  const record = {
    segmentId: segment.segmentId,
    sourceWayId: segment.sourceWayId || null,
    extractionStatus: segment.extractionStatus || null,
    reviewBucket: segment.reviewBucket || null,
    reviewReasons,
    confidenceValidationState: state,
    independentSignalCount: coreSignals.length + supportingSignals.length,
    coreSignalCount: coreSignals.length,
    supportingSignalCount: supportingSignals.length,
    reductionSignalCount: uniqueReductionSignals.length,
    hasBearingOnlyEvidence,
    blockingReasons: [...new Set(blockingReasons)],
    evidenceSignalsUsed: { coreSignals, supportingSignals, reductionSignals: uniqueReductionSignals }
  };
  evidenceRecords.push(record);
  samplePush(cappedSamples.byState, state, record);
  for (const reason of record.blockingReasons) samplePush(cappedSamples.byBlockingReason, reason, record);
  for (const reason of reviewReasons) samplePush(cappedSamples.byReviewReason, reason, record);
  if (hasBearingOnlyEvidence) samplePush(cappedSamples, 'bearingOnlyBlocked', record);
}

const strongCandidateCount = confidenceStateDistribution.confidence_candidate_strong;
const limitedCandidateCount = confidenceStateDistribution.confidence_candidate_limited;
const reviewRequiredCount = confidenceStateDistribution.confidence_review_required;
const blockedCount = confidenceStateDistribution.confidence_blocked;
const bearingOnlyPolicyPass = bearingOnlyCandidateCount === bearingOnlyBlockedCount;
const finalDetermination = blockedCount === detected.segments.length || !bearingOnlyPolicyPass
  ? 'CONFIDENCE VALIDATION INSUFFICIENT — CORRIDOR READINESS ASSESSMENT BLOCKED'
  : (strongCandidateCount + limitedCandidateCount > 0 ? 'CONFIDENCE VALIDATION PARTIAL — CORRIDOR READINESS ASSESSMENT ALLOWED WITH REVIEW BUCKETS' : 'CONFIDENCE VALIDATION INSUFFICIENT — CORRIDOR READINESS ASSESSMENT BLOCKED');

const evidence = {
  milestone: 'V686',
  generatedAt: new Date().toISOString(),
  inputArtifacts: inputs.map(({filePath, exists, parseValid}) => ({ filePath, exists, parseValid })),
  v683Dependency: { finalDetermination: 'METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS' },
  v684Dependency: { milestone: v684Input.data?.milestone || 'V684', finalDetermination: v684Input.data?.finalDetermination || null, evidencePath: v684EvidencePath },
  v685Dependency: { milestone: v685Input.data?.milestone || 'V685', finalDetermination: v685Input.data?.finalDetermination || null, evidencePath: v685EvidencePath, readinessDistribution: v685Distribution },
  detectedInputShapes: { segmentInventory: detected.shape, v684Evidence: Array.isArray(v684Input.data) ? 'array' : 'object', v685Evidence: Array.isArray(v685Input.data) ? 'array' : 'object' },
  totalSegmentsEvaluated: detected.segments.length,
  independentSignalModel: {
    coreSignals: ['valid_geometry_summary','corridor_evidence','county_attribution','oneway_evidence'],
    supportingSignals: ['lanes','turn_lanes','destination_lanes','strategic_tags','source_identity'],
    reductionSignals: ['reversible_lane','oneway_conditional_negative_one','construction_segment','hov_hot_lane','fixme_tags','missing_county','missing_oneway','missing_ref_or_fut_ref','missing_geometry','rejected_extraction_status'],
    bearingPolicy: 'Bearing is geometry evidence only and is never sufficient by itself to produce directional confidence.'
  },
  confidenceStateDistribution,
  confidenceEvidenceSummary: { strongCandidateCount, limitedCandidateCount, reviewRequiredCount, blockedCount, evidenceRecords },
  bearingOnlyPolicy: { bearingOnlyCandidateCount, bearingOnlyBlockedCount, bearingOnlyPolicyPass },
  consistencyWithV685: {
    v685ReadyCandidateCount: v685Distribution.confidence_ready_candidate || 0,
    v686CandidateCount: strongCandidateCount + limitedCandidateCount,
    v685ReviewRequiredCount: v685Distribution.confidence_review_required || 0,
    v686ReviewOrBlockedCount: reviewRequiredCount + blockedCount,
    v685BlockedCount: v685Distribution.confidence_blocked || 0,
    v686BlockedCount: blockedCount,
    alignedCount,
    promotedFromReviewCount,
    demotedFromReadyCount,
    newlyBlockedCount,
    consistencyNotes: [
      'V686 preserves caution by preventing sampled V685 review-required records from being promoted to candidate states.',
      'V685 evidence only carries capped readiness samples, so alignment counts are calculated against available sample ids while count comparisons use V685 distributions.',
      'Newly blocked records reflect V686 stricter confidence-policy checks, including non-primary corridor and rejected extraction status.'
    ]
  },
  countyDistributionByConfidenceState,
  highwayDistributionByConfidenceState,
  reviewBucketDistributionByConfidenceState,
  reductionSignalDistribution,
  cappedSamples,
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`V686 confidence validation complete: ${finalDetermination}`);
console.log(`Segments: ${detected.segments.length}; strong=${strongCandidateCount}; limited=${limitedCandidateCount}; review=${reviewRequiredCount}; blocked=${blockedCount}`);
console.log(`Bearing-only policy: candidates=${bearingOnlyCandidateCount}; blocked=${bearingOnlyBlockedCount}; pass=${bearingOnlyPolicyPass}`);
