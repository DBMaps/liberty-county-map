(function attachHistoricalKnowledgeRetrieval(globalScope) {
  "use strict";

  const VERSION = "LP082.historical-knowledge-retrieval.v1";
  const VERSIONS = Object.freeze({
    requestContract: "LP082.request.v1", contextNormalization: "LP082.context-normalization.v1",
    compatibilityPolicy: "LP082.compatibility.v1", timeRelevancePolicy: "LP082.time-relevance.v1",
    geographicRelevancePolicy: "LP082.geographic-relevance.v1", eligibilityPolicy: "LP082.eligibility.v1",
    relationshipTraversalPolicy: "LP082.relationship-traversal.v1", fallbackPolicy: "LP082.fallback.v1",
    resultContract: "LP082.result.v1"
  });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticExecution: false, persistence: false, telemetry: false, network: false });
  const MODES = Object.freeze(["exact-pattern", "crossing-context", "roadway-context", "awareness-area-context", "community-context", "county-context", "present-moment", "quiet-state-evaluation"]);
  const CATEGORIES = Object.freeze(["rail-delay", "road-closure", "flooding", "congestion", "hazard", "uncategorized"]);
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_version", UNKNOWN_FIELD: "unknown_request_field", MODE_REQUIRED: "retrieval_mode_required", UNSUPPORTED_MODE: "unsupported_retrieval_mode", REQUIRED_CONTEXT: "required_context_missing", INCOMPATIBLE_GEOGRAPHY: "incompatible_geography", INVALID_TIMEZONE: "invalid_timezone", TIMESTAMP_TIMEZONE_MISMATCH: "timestamp_timezone_mismatch", UNSUPPORTED_CATEGORY: "unsupported_category", INVALID_REQUEST: "invalid_request", MUTATED_KNOWLEDGE_BASE: "knowledge_base_mutation_detected" });
  const REJECTION_CODES = Object.freeze({ CONTEXT_MISMATCH: "context_mismatch", TIME_NOT_RELEVANT: "time_not_relevant", LIFECYCLE_INELIGIBLE: "lifecycle_ineligible", QUALITY_INELIGIBLE: "quality_ineligible", INVALID_LINEAGE: "invalid_lineage", INACTIVE_REVISION: "inactive_revision", REGISTRY_INVALID: "registry_invalid", CATEGORY_MISMATCH: "category_mismatch", MODE_INCOMPATIBLE: "mode_incompatible", LESS_SPECIFIC: "less_specific_geography" });
  const ALLOWED_FIELDS = new Set(["contractVersion", "policyVersions", "requestIdentity", "retrievalMode", "patternIdentity", "canonicalTimestamp", "localTimestamp", "canonicalTimezone", "countyIdentity", "communityIdentity", "awarenessAreaIdentity", "crossingIdentity", "roadwayIdentity", "patternCategory", "relevanceWindow", "maximumResultCount", "fallbackAuthorization", "relationshipTraversal"]);
  const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  function deepFreeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); Object.keys(v).forEach((k) => deepFreeze(v[k])); } return v; }
  const immutable = (v) => deepFreeze(clone(v));
  function stable(v) { if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`; if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`; return JSON.stringify(v); }
  function fingerprint(v) { let h = 2166136261; for (const c of stable(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return `lp082-fnv1a32:${(h >>> 0).toString(16).padStart(8, "0")}`; }
  const supportedVersions = (v) => Object.keys(VERSIONS).every((k) => v?.[k] === VERSIONS[k]);
  const failure = (codes, details = []) => immutable({ accepted: false, valid: false, failClosed: true, failureCodes: [...new Set(codes)].sort(), failures: details.slice().sort(), versions: VERSIONS });
  const id = (v) => typeof v === "string" && v.trim() ? v.trim() : null;
  const sortedStrings = (v) => Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x))].sort() : [];
  function validTimezone(zone) { try { new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0)); return true; } catch (_) { return false; } }
  function normalizeRequest(input = {}) {
    const unknown = Object.keys(input).filter((k) => !ALLOWED_FIELDS.has(k)).sort();
    if (unknown.length) return failure([FAILURE_CODES.UNKNOWN_FIELD], unknown.map((k) => `unknown_field:${k}`));
    if (input.contractVersion !== VERSIONS.requestContract || !supportedVersions(input.policyVersions || VERSIONS)) return failure([FAILURE_CODES.UNSUPPORTED_VERSION]);
    if (!id(input.retrievalMode)) return failure([FAILURE_CODES.MODE_REQUIRED]);
    if (!MODES.includes(input.retrievalMode)) return failure([FAILURE_CODES.UNSUPPORTED_MODE]);
    const request = {
      contractVersion: VERSIONS.requestContract, policyVersions: VERSIONS, requestIdentity: id(input.requestIdentity), retrievalMode: input.retrievalMode,
      patternIdentity: id(input.patternIdentity), canonicalTimestamp: id(input.canonicalTimestamp), localTimestamp: id(input.localTimestamp), canonicalTimezone: id(input.canonicalTimezone),
      countyIdentity: id(input.countyIdentity), communityIdentity: id(input.communityIdentity), awarenessAreaIdentity: id(input.awarenessAreaIdentity), crossingIdentity: id(input.crossingIdentity), roadwayIdentity: id(input.roadwayIdentity), patternCategory: id(input.patternCategory),
      relevanceWindow: input.relevanceWindow ? { nearWindowToleranceMinutes: Math.max(0, Math.min(120, Number(input.relevanceWindow.nearWindowToleranceMinutes) || 0)) } : null,
      maximumResultCount: Math.max(1, Math.min(100, Number(input.maximumResultCount) || 10)),
      fallbackAuthorization: sortedStrings(input.fallbackAuthorization),
      relationshipTraversal: input.relationshipTraversal ? { authorized: input.relationshipTraversal.authorized === true, maxDepth: Math.max(0, Math.min(3, Number(input.relationshipTraversal.maxDepth) || 0)), types: sortedStrings(input.relationshipTraversal.types) } : { authorized: false, maxDepth: 0, types: [] }
    };
    if (!request.requestIdentity) return failure([FAILURE_CODES.INVALID_REQUEST], ["request_identity_required"]);
    if (request.patternCategory && !CATEGORIES.includes(request.patternCategory)) return failure([FAILURE_CODES.UNSUPPORTED_CATEGORY]);
    if (request.canonicalTimezone && !validTimezone(request.canonicalTimezone)) return failure([FAILURE_CODES.INVALID_TIMEZONE]);
    if (request.canonicalTimestamp && Number.isNaN(Date.parse(request.canonicalTimestamp))) return failure([FAILURE_CODES.INVALID_REQUEST], ["invalid_canonical_timestamp"]);
    if (request.localTimestamp && Number.isNaN(Date.parse(request.localTimestamp))) return failure([FAILURE_CODES.INVALID_REQUEST], ["invalid_local_timestamp"]);
    return immutable({ accepted: true, valid: true, normalizedRequest: request, requestFingerprint: fingerprint(request) });
  }

  const patternField = (p, ...keys) => keys.map((k) => p?.[k]).find((v) => typeof v === "string" && v) || null;
  const specificity = Object.freeze([{ level: "crossing", field: "crossingIdentity", index: "crossingIdentity" }, { level: "roadway", field: "roadwayIdentity", index: "roadwayIdentity" }, { level: "awareness-area", field: "awarenessAreaIdentity", index: "awarenessArea" }, { level: "community", field: "communityIdentity", index: "community" }, { level: "county", field: "countyIdentity", index: "county" }]);
  const modeLevel = { "crossing-context": "crossing", "roadway-context": "roadway", "awareness-area-context": "awareness-area", "community-context": "community", "county-context": "county" };
  function validateCompatibility(request, knowledgeBase) {
    const r = request.normalizedRequest || request, errors = [];
    const required = r.retrievalMode === "exact-pattern" ? "patternIdentity" : specificity.find((x) => x.level === modeLevel[r.retrievalMode])?.field;
    if (required && !r[required]) errors.push(FAILURE_CODES.REQUIRED_CONTEXT);
    if (["present-moment"].includes(r.retrievalMode) && (!r.canonicalTimestamp || !r.localTimestamp || !r.canonicalTimezone)) errors.push(FAILURE_CODES.REQUIRED_CONTEXT);
    const entries = knowledgeBase?.registry?.entries || [];
    const matching = entries.filter((e) => { const p = e.pattern; return (!r.crossingIdentity || patternField(p,"crossingIdentity","crossing_identity") === r.crossingIdentity) && (!r.roadwayIdentity || patternField(p,"roadwayIdentity","roadway_identity") === r.roadwayIdentity); });
    const geo = (p) => (!r.countyIdentity || patternField(p,"countyIdentity","county") === r.countyIdentity) && (!r.communityIdentity || patternField(p,"communityIdentity","community") === r.communityIdentity) && (!r.awarenessAreaIdentity || patternField(p,"awarenessAreaIdentity","awarenessArea","awareness_area") === r.awarenessAreaIdentity);
    if ((r.crossingIdentity || r.roadwayIdentity) && !matching.some((e) => geo(e.pattern))) errors.push(FAILURE_CODES.INCOMPATIBLE_GEOGRAPHY);
    if ((r.communityIdentity || r.awarenessAreaIdentity) && !entries.some((e) => geo(e.pattern))) errors.push(FAILURE_CODES.INCOMPATIBLE_GEOGRAPHY);
    if (r.canonicalTimestamp && r.localTimestamp && Math.abs(Date.parse(r.canonicalTimestamp) - Date.parse(r.localTimestamp)) > 1000) errors.push(FAILURE_CODES.TIMESTAMP_TIMEZONE_MISMATCH);
    return immutable({ valid: errors.length === 0, failClosed: errors.length > 0, reasonCodes: [...new Set(errors)].sort() });
  }
  function resolveLevel(r) { if (modeLevel[r.retrievalMode]) return modeLevel[r.retrievalMode]; if (r.retrievalMode === "exact-pattern") return "pattern"; return specificity.find((x) => r[x.field])?.level || null; }
  function createPlan(normalized, knowledgeBase) {
    if (!normalized?.accepted) return normalized;
    const r = normalized.normalizedRequest, compatibility = validateCompatibility(r, knowledgeBase);
    if (!compatibility.valid) return failure(compatibility.reasonCodes);
    const level = resolveLevel(r), spec = specificity.find((x) => x.level === level);
    if (!level && r.retrievalMode !== "quiet-state-evaluation") return failure([FAILURE_CODES.REQUIRED_CONTEXT]);
    const requiredIndexes = r.retrievalMode === "exact-pattern" ? ["canonicalIdentity"] : spec ? [spec.index] : [];
    if (r.patternCategory) requiredIndexes.push("patternCategory");
    const body = { schemaVersion: "LP082.plan.v1", normalizedRequest: r, selectedRetrievalMode: r.retrievalMode, selectedGeographicLevel: level, requiredIndexes: [...new Set(requiredIndexes)].sort(), filterSequence: ["registry", "active-revision", "lineage", "lifecycle", "quality", "category", "context", "time", "mode"], timeRelevanceEvaluation: !!r.canonicalTimestamp, relationshipTraversalPolicy: r.relationshipTraversal, fallbackPolicy: r.fallbackAuthorization, maximumResultCount: r.maximumResultCount, expectedQuietStatePath: "explicit-quiet-result" };
    return immutable({ accepted: true, ...body, planFingerprint: fingerprint(body) });
  }
  const minutes = (s) => { const m = /^(\d\d):(\d\d)$/.exec(s || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
  function timeRelevance(pattern, request) {
    if (!request.canonicalTimestamp) return immutable({ relevant: true, reasonCode: "time_not_requested", distanceMinutes: 0 });
    const date = new Date(request.canonicalTimestamp), day = new Intl.DateTimeFormat("en-US", { timeZone: request.canonicalTimezone, weekday: "short" }).format(date).toLowerCase();
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: request.canonicalTimezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date), now = Number(parts.find((p) => p.type === "hour").value) * 60 + Number(parts.find((p) => p.type === "minute").value);
    const days = pattern.daysOfWeek || pattern.recurrenceDays || [], window = pattern.localTimeWindow || pattern.recurrenceWindow;
    if (days.length && !days.map((x) => String(x).slice(0,3).toLowerCase()).includes(day)) return immutable({ relevant: false, reasonCode: REJECTION_CODES.TIME_NOT_RELEVANT, distanceMinutes: null });
    if (!window) return immutable({ relevant: true, reasonCode: "timing_evidence_general", distanceMinutes: 0 });
    const start = minutes(window.start), end = minutes(window.end); if (start === null || end === null) return immutable({ relevant: false, reasonCode: REJECTION_CODES.TIME_NOT_RELEVANT, distanceMinutes: null });
    const inside = start <= end ? now >= start && now <= end : now >= start || now <= end;
    const distance = inside ? 0 : Math.min(Math.abs(now-start), Math.abs(now-end), 1440-Math.abs(now-start), 1440-Math.abs(now-end));
    const tolerance = Math.min(Number(pattern.approvedNearWindowToleranceMinutes) || 0, request.relevanceWindow?.nearWindowToleranceMinutes || 0);
    return immutable({ relevant: inside || distance <= tolerance, reasonCode: inside ? "within_historical_window" : distance <= tolerance ? "within_approved_near_window" : REJECTION_CODES.TIME_NOT_RELEVANT, distanceMinutes: distance });
  }
  function candidateEligibility(entry, request, level, distance = 0) {
    const p = entry.pattern, reasons = [], tf = timeRelevance(p, request);
    if (!entry.canonicalIdentity) reasons.push(REJECTION_CODES.REGISTRY_INVALID);
    if (!entry.lineageReference || p.lineageValid === false) reasons.push(REJECTION_CODES.INVALID_LINEAGE);
    if (p.activeRevision === false || (p.revision && entry.currentRevision !== p.revision)) reasons.push(REJECTION_CODES.INACTIVE_REVISION);
    if (!["active", "stable", "established"].includes(patternField(p,"lifecycleStatus") || "")) reasons.push(REJECTION_CODES.LIFECYCLE_INELIGIBLE);
    if (!["stable", "supported", "approved"].includes(patternField(p,"qualityStatus") || "")) reasons.push(REJECTION_CODES.QUALITY_INELIGIBLE);
    if (request.patternCategory && patternField(p,"patternCategory","category") !== request.patternCategory) reasons.push(REJECTION_CODES.CATEGORY_MISMATCH);
    if (!tf.relevant) reasons.push(REJECTION_CODES.TIME_NOT_RELEVANT);
    const rank = { contextSpecificity: level === "pattern" ? 6 : 5 - specificity.findIndex((x) => x.level === level), presentMomentRelevance: tf.relevant ? (tf.distanceMinutes === 0 ? 2 : 1) : 0, patternQuality: patternField(p,"qualityStatus") === "stable" ? 2 : 1, lifecycleStability: patternField(p,"lifecycleStatus") === "active" ? 2 : 1, evidenceStrength: Number(p.evidenceStrength) || Number(p.archiveEvidenceCount) || 0, activeRevisionStatus: p.activeRevision === false ? 0 : 1, relationshipDistance: distance, geographicSpecificity: level };
    return { eligible: reasons.length === 0, reasons: [...new Set(reasons)].sort(), time: tf, rankingInputs: immutable(rank) };
  }
  function idsAt(knowledgeBase, level, request) { if (level === "pattern") return knowledgeBase.index.indexes.canonicalIdentity[request.patternIdentity] || []; const s = specificity.find((x) => x.level === level); return s ? knowledgeBase.index.indexes[s.index][request[s.field]] || [] : []; }
  function retrieve(knowledgeBase, input) {
    const normalized = normalizeRequest(input); if (!normalized.accepted) return normalized;
    if (!knowledgeBase?.accepted || !knowledgeBase.consistency?.valid) return failure([REJECTION_CODES.REGISTRY_INVALID]);
    const initialKnowledgeFingerprint = knowledgeBase.fingerprints.knowledge, plan = createPlan(normalized, knowledgeBase); if (!plan.accepted) return plan;
    const r = normalized.normalizedRequest, entries = new Map(knowledgeBase.registry.entries.map((e) => [e.canonicalIdentity,e])), primaryLevel = plan.selectedGeographicLevel;
    if (r.retrievalMode === "quiet-state-evaluation") return buildResult([], [], plan, knowledgeBase, { reasonCode: "quiet_state_evaluation_requested" }, [], []);
    let levels = [primaryLevel];
    for (let i = (primaryLevel === "pattern" ? -1 : specificity.findIndex((x) => x.level === primaryLevel)) + 1; i < specificity.length; i++) { const transition = `${levels[levels.length-1]}->${specificity[i].level}`; if (r.fallbackAuthorization.includes(transition) && r[specificity[i].field]) levels.push(specificity[i].level); else break; }
    const considered = [], rejected = [], accepted = [], seen = new Set(); let usedLevel = primaryLevel;
    for (const level of levels) { const ids = idsAt(knowledgeBase, level, r).slice().sort(); for (const cid of ids) { if (seen.has(cid)) continue; seen.add(cid); const e = entries.get(cid), ev = candidateEligibility(e,r,level); considered.push(cid); if (ev.eligible) accepted.push({ identity:cid,rankingInputs:ev.rankingInputs,timeRelevance:ev.time,sourcePatternIdentity:cid,relationshipDistance:0}); else rejected.push({ identity:cid,reasonCodes:ev.reasons }); } if (accepted.length) { usedLevel=level; break; } }
    const traversal = [];
    if (accepted.length && r.relationshipTraversal.authorized && r.relationshipTraversal.maxDepth > 0) { const queue=accepted.map((c)=>({id:c.identity,d:0,source:c.identity})); while(queue.length){const n=queue.shift(); if(n.d>=r.relationshipTraversal.maxDepth)continue; knowledgeBase.relationships.entries.filter((x)=>x.source===n.id&&r.relationshipTraversal.types.includes(x.type)).sort((a,b)=>stable(a).localeCompare(stable(b))).forEach((rel)=>{if(seen.has(rel.target))return;seen.add(rel.target);traversal.push({source:n.source,target:rel.target,type:rel.type,distance:n.d+1});const e=entries.get(rel.target),ev=candidateEligibility(e,r,usedLevel,n.d+1);considered.push(rel.target);if(ev.eligible)accepted.push({identity:rel.target,rankingInputs:ev.rankingInputs,timeRelevance:ev.time,sourcePatternIdentity:n.source,relationshipDistance:n.d+1});else rejected.push({identity:rel.target,reasonCodes:ev.reasons});queue.push({id:rel.target,d:n.d+1,source:n.source});});} }
    accepted.sort((a,b)=>b.rankingInputs.contextSpecificity-a.rankingInputs.contextSpecificity||b.rankingInputs.presentMomentRelevance-a.rankingInputs.presentMomentRelevance||b.rankingInputs.patternQuality-a.rankingInputs.patternQuality||a.relationshipDistance-b.relationshipDistance||a.identity.localeCompare(b.identity));
    const selected=accepted.slice(0,r.maximumResultCount), quiet=selected.length?null:{reasonCode:rejected.some((x)=>x.reasonCodes.includes(REJECTION_CODES.TIME_NOT_RELEVANT))?"no_time_relevant_knowledge":rejected.length?"no_eligible_knowledge":"no_compatible_knowledge"};
    if (knowledgeBase.fingerprints.knowledge !== initialKnowledgeFingerprint) return failure([FAILURE_CODES.MUTATED_KNOWLEDGE_BASE]);
    return buildResult(selected,rejected.sort((a,b)=>a.identity.localeCompare(b.identity)),plan,knowledgeBase,quiet,considered,traversal,usedLevel);
  }
  function buildResult(candidates,rejected,plan,kb,quiet,considered,traversal,usedLevel=plan.selectedGeographicLevel){
    const explainability={normalizedContext:plan.normalizedRequest,indexesConsulted:plan.requiredIndexes,filtersApplied:plan.filterSequence,candidatesConsidered:[...new Set(considered)].sort(),candidatesRejected:rejected,relationshipTraversalPerformed:traversal,timeRelevanceDecision:candidates.map((c)=>({identity:c.identity,decision:c.timeRelevance.reasonCode})),geographicSpecificityDecision:{requested:plan.selectedGeographicLevel,used:usedLevel,fallbackUsed:usedLevel!==plan.selectedGeographicLevel},quietResultReason:quiet?.reasonCode||null,finalCandidateIdentities:candidates.map((c)=>c.identity)};
    const body={accepted:true,schemaVersion:VERSIONS.resultContract,requestIdentity:plan.normalizedRequest.requestIdentity,normalizedRequest:plan.normalizedRequest,retrievalMode:plan.selectedRetrievalMode,knowledgeBaseFingerprint:kb.fingerprints.knowledge,planFingerprint:plan.planFingerprint,candidateIdentities:candidates.map((c)=>c.identity),candidateRankingInputs:candidates.map((c)=>({identity:c.identity,...c.rankingInputs,sourcePatternIdentity:c.sourcePatternIdentity})),rejectedCandidateSummaries:rejected,quietResult:quiet,explainability,compatibilityMetadata:{versions:VERSIONS,compatible:true,productionIsolation:true}};
    const resultFingerprint=fingerprint(body);body.explainability.retrievalFingerprint=resultFingerprint;
    const diagnostics={passive:true,productionIsolation:true,requestNormalized:true,contextValid:true,selectedMode:plan.selectedRetrievalMode,planReady:true,indexesUsed:plan.requiredIndexes,candidateCount:candidates.length,rejectionCount:rejected.length,quietStateCount:quiet?1:0,fallbackUsed:explainability.geographicSpecificityDecision.fallbackUsed,relationshipTraversalCount:traversal.length,fingerprints:{knowledge:kb.fingerprints.knowledge,plan:plan.planFingerprint,result:resultFingerprint},versionCompatibility:true};
    return immutable({...body,resultFingerprint,diagnostics});
  }
  const api=Object.freeze({VERSION,VERSIONS,ACTIVATION,MODES,CATEGORIES,FAILURE_CODES,REJECTION_CODES,deepFreeze,fingerprint,normalizeRequest,validateCompatibility,createPlan,timeRelevance,candidateEligibility,retrieve});
  globalScope.gridlyHistoricalKnowledgeRetrieval=api;if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
