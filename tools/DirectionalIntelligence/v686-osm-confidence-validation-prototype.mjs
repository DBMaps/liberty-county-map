import fs from 'node:fs';
import path from 'node:path';

const REQUIRED = {
  segmentInventory: 'assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json',
  v685Evidence: 'assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json',
  v684Evidence: 'assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json',
};
const OUTPUT = 'assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json';

function findByName(name) {
  const stack = ['.'];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['.git', 'node_modules', 'android'].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name === name) return full.replace(/^\.\//, '');
    }
  }
  return null;
}

function loadArtifact(label, requestedPath) {
  const resolvedPath = fs.existsSync(requestedPath) ? requestedPath : findByName(path.basename(requestedPath));
  const artifact = { label, requestedPath, resolvedPath, pathMatchedRequested: resolvedPath === requestedPath, exists: Boolean(resolvedPath), parseValid: false };
  if (!resolvedPath) return { artifact, data: null };
  try {
    const data = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    artifact.parseValid = true;
    return { artifact, data };
  } catch (error) {
    artifact.parseError = error.message;
    return { artifact, data: null };
  }
}

function segmentsFrom(data) {
  if (Array.isArray(data)) return { segments: data, shape: 'array' };
  if (Array.isArray(data?.segments)) return { segments: data.segments, shape: 'object.segments' };
  if (Array.isArray(data?.segmentInventory)) return { segments: data.segmentInventory, shape: 'object.segmentInventory' };
  if (Array.isArray(data?.records)) return { segments: data.records, shape: 'object.records' };
  return { segments: [], shape: 'unsupported' };
}

const hasValue = (v) => v !== undefined && v !== null && v !== '';
const noneReasons = (reasons) => !Array.isArray(reasons) || reasons.length === 0 || reasons.every((r) => r === 'none');
const inc = (obj, key, by = 1) => { obj[key ?? '__MISSING__'] = (obj[key ?? '__MISSING__'] || 0) + by; };
const addByState = (obj, state, key) => { obj[state] ||= {}; inc(obj[state], key); };

const loaded = Object.entries(REQUIRED).map(([label, p]) => loadArtifact(label, p));
const inputArtifacts = loaded.map((x) => x.artifact);
const [segmentLoad, v685Load, v684Load] = loaded;
const { segments, shape } = segmentLoad.data ? segmentsFrom(segmentLoad.data) : { segments: [], shape: 'missing' };
const allInputsValid = inputArtifacts.every((a) => a.exists && a.parseValid) && shape !== 'unsupported';

const distribution = { confidence_candidate_strong: 0, confidence_candidate_limited: 0, confidence_review_required: 0, confidence_blocked: 0 };
const countyDistributionByConfidenceState = {};
const highwayDistributionByConfidenceState = {};
const reviewBucketDistributionByConfidenceState = {};
const reductionSignalDistribution = {};
const cappedSamples = { confidence_candidate_strong: [], confidence_candidate_limited: [], confidence_review_required: [], confidence_blocked: [], bearingOnlyBlocked: [] };
const evidenceSummary = { coreSignals: {}, supportingSignals: {}, riskReductionSignals: {} };
let bearingOnlyCandidateCount = 0;
let bearingOnlyBlockedCount = 0;
let promotedFromReviewCount = 0;
let demotedFromReadyCount = 0;
let newlyBlockedCount = 0;

for (const s of segments) {
  const es = s.evidenceSignals || {};
  const geom = s.geometrySummary || {};
  const validGeometry = Boolean(es.hasGeometry ?? (geom.geometryType && geom.coordinateCount >= 2 && geom.startCoordinate && geom.endCoordinate && geom.bbox));
  const corridorEvidence = s.corridorId === 'us59-i69' || /(^|;)\s*(US 59|I 69)\s*(;|$)/.test(String(s.sourceRef || s.sourceFutureRef || ''));
  const countyAttribution = Boolean(es.hasCounty ?? hasValue(s.county));
  const onewayEvidence = Boolean(es.hasOneway ?? hasValue(s.oneway));
  const sourceIdentity = Boolean(hasValue(s.sourceWayId) && (hasValue(s.sourceRef) || hasValue(s.sourceFutureRef) || hasValue(s.sourceName)));
  const supporting = {
    lanes: Boolean(es.hasLanes ?? hasValue(s.lanes)),
    turnLanes: Boolean(es.hasTurnLanes ?? hasValue(s.turnLanes)),
    destinationLanes: Boolean(es.hasDestinationLanes ?? hasValue(s.destinationLanes)),
    Texas_Trunk_System: hasValue(s.strategicTags?.Texas_Trunk_System),
    NHS: hasValue(s.strategicTags?.NHS),
    'hgv:national_network': hasValue(s.strategicTags?.['hgv:national_network']),
  };
  const risks = {
    reversibleLane: Boolean(es.isReversible || String(s.onewayConditional || '').includes('-1')),
    constructionSegment: Boolean(es.isConstruction || s.highway === 'construction' || hasValue(s.riskTags?.construction)),
    hovHotLane: Boolean(es.isHovHot || hasValue(s.riskTags?.['hov:conditional']) || hasValue(s.riskTags?.['hov:minimum'])),
    fixmeTags: Boolean(es.hasFixme || hasValue(s.riskTags?.fixme) || hasValue(s.riskTags?.FIXME)),
    missingCounty: !countyAttribution,
    missingOneway: !onewayEvidence,
    missingRefFutureRef: !hasValue(s.sourceRef) && !hasValue(s.sourceFutureRef),
    missingGeometry: !validGeometry,
    rejectedExtractionStatus: s.extractionStatus === 'rejected',
  };
  const onlyBearing = Boolean(geom.approximateBearingDegrees) && !corridorEvidence && !countyAttribution && !onewayEvidence && !sourceIdentity;
  if (onlyBearing) bearingOnlyCandidateCount++;
  const existingReview = !noneReasons(s.reviewReasons) || (s.reviewBucket && s.reviewBucket !== 'none');
  const blocking = risks.rejectedExtractionStatus || !validGeometry || !corridorEvidence || !sourceIdentity || onlyBearing;
  const reviewRisk = s.extractionStatus === 'extracted_with_review' || risks.reversibleLane || risks.constructionSegment || risks.hovHotLane || risks.fixmeTags || risks.missingCounty || risks.missingOneway || risks.missingRefFutureRef || existingReview;
  let state;
  if (blocking) state = 'confidence_blocked';
  else if (reviewRisk) state = 'confidence_review_required';
  else if (validGeometry && corridorEvidence && countyAttribution && onewayEvidence && sourceIdentity && s.extractionStatus === 'extracted') state = 'confidence_candidate_strong';
  else state = 'confidence_candidate_limited';
  if (onlyBearing && state === 'confidence_blocked') bearingOnlyBlockedCount++;
  if ((s.extractionStatus === 'extracted_with_review' || existingReview) && (state === 'confidence_candidate_strong' || state === 'confidence_candidate_limited')) promotedFromReviewCount++;
  if (s.extractionStatus === 'extracted' && s.reviewBucket === 'none' && state === 'confidence_review_required') demotedFromReadyCount++;
  if (s.extractionStatus !== 'rejected' && state === 'confidence_blocked') newlyBlockedCount++;
  distribution[state]++;
  addByState(countyDistributionByConfidenceState, state, s.county || '__MISSING__');
  addByState(highwayDistributionByConfidenceState, state, s.highway || '__MISSING__');
  addByState(reviewBucketDistributionByConfidenceState, state, s.reviewBucket || '__MISSING__');
  for (const [k, v] of Object.entries(risks)) if (v) inc(reductionSignalDistribution, k);
  for (const [k, v] of Object.entries({ validGeometry, corridorEvidence, countyAttribution, onewayEvidence, sourceIdentity })) if (v) inc(evidenceSummary.coreSignals, k);
  for (const [k, v] of Object.entries(supporting)) if (v) inc(evidenceSummary.supportingSignals, k);
  for (const [k, v] of Object.entries(risks)) if (v) inc(evidenceSummary.riskReductionSignals, k);
  if (cappedSamples[state].length < 5) cappedSamples[state].push({ segmentId: s.segmentId, sourceWayId: s.sourceWayId, county: s.county || null, highway: s.highway || null, reviewBucket: s.reviewBucket || null, extractionStatus: s.extractionStatus });
  if (onlyBearing && cappedSamples.bearingOnlyBlocked.length < 5) cappedSamples.bearingOnlyBlocked.push({ segmentId: s.segmentId, sourceWayId: s.sourceWayId });
}

const v685Ready = v685Load.data?.confidencePrerequisiteReadiness?.confidence_ready_candidate ?? v685Load.data?.extractedCount ?? 0;
const v685Review = v685Load.data?.confidencePrerequisiteReadiness?.confidence_review_required ?? v685Load.data?.extractedWithReviewCount ?? 0;
const v685Blocked = v685Load.data?.confidencePrerequisiteReadiness?.confidence_blocked ?? v685Load.data?.rejectedCount ?? 0;
const v686Ready = distribution.confidence_candidate_strong + distribution.confidence_candidate_limited;
const finalDetermination = !allInputsValid
  ? 'CONFIDENCE VALIDATION RECOVERY FAILED — REQUIRED INPUTS MISSING'
  : distribution.confidence_review_required || distribution.confidence_blocked
    ? 'CONFIDENCE VALIDATION RECOVERY PARTIAL — REASSESSMENT ALLOWED WITH REVIEW BUCKETS'
    : 'CONFIDENCE VALIDATION RECOVERED — CORRIDOR READINESS REASSESSMENT ALLOWED';

const evidence = {
  milestone: 'V686R',
  recoveredArtifactFor: 'V686',
  generatedAt: new Date().toISOString(),
  inputArtifacts,
  detectedInputShapes: { segmentInventory: shape, v685Evidence: v685Load.data ? 'object' : 'missing', v684Evidence: v684Load.data ? 'object' : 'missing' },
  totalSegmentsEvaluated: segments.length,
  independentSignalModel: { coreSignals: ['valid geometry summary', 'corridor evidence', 'county attribution', 'oneway evidence', 'source identity'], supportingSignals: ['lanes', 'turn:lanes', 'destination:lanes', 'Texas_Trunk_System', 'NHS', 'hgv:national_network'], riskReductionSignals: ['reversible lane', 'oneway:conditional containing -1', 'construction segment', 'HOV/HOT lane', 'fixme/FIXME tags', 'missing county', 'missing oneway', 'missing ref/fut_ref', 'missing geometry', 'rejected extraction status'] },
  confidenceStateDistribution: distribution,
  confidenceEvidenceSummary: evidenceSummary,
  bearingOnlyPolicy: { bearingOnlyCandidateCount, bearingOnlyBlockedCount, bearingOnlyPolicyPass: bearingOnlyCandidateCount === bearingOnlyBlockedCount },
  consistencyWithV685: { v685ReadyCandidates: v685Ready, v686ReadyCandidates: v686Ready, readyCandidateDelta: v686Ready - v685Ready, v685ReviewRequired: v685Review, v686ReviewOrBlocked: distribution.confidence_review_required + distribution.confidence_blocked, reviewRequiredDelta: distribution.confidence_review_required + distribution.confidence_blocked - v685Review, v685Blocked, v686Blocked: distribution.confidence_blocked, blockedDelta: distribution.confidence_blocked - v685Blocked, promotedFromReviewCount, demotedFromReadyCount, newlyBlockedCount },
  countyDistributionByConfidenceState,
  highwayDistributionByConfidenceState,
  reviewBucketDistributionByConfidenceState,
  reductionSignalDistribution,
  cappedSamples,
  protectedSystemsVerified: { historicalReadsEnabled: false, historyUiEnabled: false, DriveTexasPaused: true, TransportationIntelligenceEnabled: false, TransportationIntelligenceDisplay: false, TransportationIntelligenceActivation: false },
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination,
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${OUTPUT}`);
console.log(JSON.stringify({ totalSegmentsEvaluated: segments.length, confidenceStateDistribution: distribution, bearingOnlyPolicy: evidence.bearingOnlyPolicy, consistencyWithV685: evidence.consistencyWithV685, finalDetermination }, null, 2));
