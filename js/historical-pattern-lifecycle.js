(function attachHistoricalPatternLifecycle(globalScope) {
  "use strict";

  const VERSION = "LP078.historical-pattern-lifecycle.v1";
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticLifecycle: false });
  const POLICY = Object.freeze({ minimumNewPatternEvidence: 2, dormantAfterDays: 180, weakeningAfterDays: 90, stableEvidenceCount: 4, confidenceBaseBasisPoints: 2500, confidencePerEvidenceBasisPoints: 750, confidenceMaximumBasisPoints: 10000 });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach((key) => deepFreeze(value[key])); } return value; }
  const immutable = (value) => deepFreeze(clone(value));
  const clean = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function digest(value) { let hash = 2166136261; const text = stable(value); for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `fnv1a32-${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const observationIdentity = (record) => clean(record?.fingerprint) || clean(record?.archiveId);
  const compareEvidence = (left, right) => String(left.observationTimestamp).localeCompare(String(right.observationTimestamp)) || left.identity.localeCompare(right.identity);

  function patternIdentity(behaviorKey) {
    if (!clean(behaviorKey)) return null;
    return `historical-pattern:${digest(clean(behaviorKey))}`;
  }

  function qualifyObservation(record, existingLineage) {
    const reasons = [];
    if (!record || typeof record !== "object") reasons.push("observation_missing");
    if (record?.qualificationStatus !== "qualified") reasons.push("archive_observation_not_qualified");
    if (!clean(record?.behaviorKey)) reasons.push("behavior_key_missing");
    if (!observationIdentity(record)) reasons.push("observation_identity_missing");
    if (!Number.isFinite(Date.parse(record?.observationTimestamp))) reasons.push("observation_timestamp_invalid");
    if (existingLineage && existingLineage.behaviorKey !== record?.behaviorKey) reasons.push("pattern_behavior_mismatch");
    return immutable({ eligible: reasons.length === 0, decision: reasons.length ? "reject" : existingLineage ? "reinforce_existing" : "candidate_new", reasons: [...new Set(reasons)] });
  }

  function confidenceFor(evidenceCount) {
    const basisPoints = Math.min(POLICY.confidenceMaximumBasisPoints, POLICY.confidenceBaseBasisPoints + Math.max(0, evidenceCount) * POLICY.confidencePerEvidenceBasisPoints);
    return immutable({ basisPoints, value: basisPoints / 10000, evidenceCount, rule: "min(maximum, base + unique_evidence_count * per_evidence)" });
  }

  function stabilityFor(revision, priorRevision, addedCount, now) {
    const lastSeen = revision.evidence[revision.evidence.length - 1]?.observationTimestamp;
    const ageDays = Math.max(0, Math.floor((Date.parse(now) - Date.parse(lastSeen)) / 86400000));
    if (ageDays > POLICY.dormantAfterDays) return "dormant";
    if (ageDays > POLICY.weakeningAfterDays) return "weakening";
    if (priorRevision && addedCount >= 2) return "strengthening";
    if (revision.evidence.length < POLICY.stableEvidenceCount) return "emerging";
    return "stable";
  }

  function validateLineage(lineage) {
    const errors = [];
    if (!lineage || typeof lineage !== "object") errors.push("lineage_missing");
    const revisions = Array.isArray(lineage?.revisions) ? lineage.revisions : [];
    if (lineage && patternIdentity(lineage.behaviorKey) !== lineage.patternId) errors.push("pattern_identity_invalid");
    if (!revisions.length) errors.push("revisions_missing");
    revisions.forEach((revision, index) => {
      if (revision.revision !== index + 1) errors.push("revision_order_invalid");
      if (revision.patternId !== lineage.patternId || revision.revisionId !== `${lineage.patternId}:revision:${index + 1}`) errors.push("revision_identity_invalid");
      if (index === 0 && revision.supersedes !== null) errors.push("original_supersession_invalid");
      if (index > 0 && revision.supersedes !== revisions[index - 1].revisionId) errors.push("supersession_chain_invalid");
      if (index < revisions.length - 1 && revision.supersededBy !== revisions[index + 1].revisionId) errors.push("superseded_by_invalid");
      if (index === revisions.length - 1 && revision.supersededBy !== null) errors.push("active_revision_superseded");
    });
    if (revisions.length && lineage.originalRevisionId !== revisions[0].revisionId) errors.push("original_revision_invalid");
    if (revisions.length && lineage.activeRevisionId !== revisions[revisions.length - 1].revisionId) errors.push("active_revision_invalid");
    return immutable({ valid: errors.length === 0, errors: [...new Set(errors)], patternId: lineage?.patternId || null, revisionCount: revisions.length });
  }

  function evolve(existingLineages, archivedObservations, options = {}) {
    const now = clean(options.now) && Number.isFinite(Date.parse(options.now)) ? new Date(options.now).toISOString() : null;
    if (!now) return immutable({ updated: false, lineages: [], decisions: [], diagnostics: [{ code: "cycle_time_required", detail: "A deterministic cycle time is required." }], validation: { valid: false, errors: ["cycle_time_required"] } });
    const source = Array.isArray(existingLineages) ? clone(existingLineages) : [];
    const invalid = source.map(validateLineage).filter((entry) => !entry.valid);
    if (invalid.length) return immutable({ updated: false, lineages: source, decisions: [], diagnostics: invalid.map((entry) => ({ code: "lineage_invalid", patternId: entry.patternId, errors: entry.errors })), validation: { valid: false, errors: ["lineage_invalid"] } });
    const byBehavior = new Map(source.map((lineage) => [lineage.behaviorKey, lineage]));
    const candidates = new Map(); const decisions = []; const diagnostics = [];
    (Array.isArray(archivedObservations) ? archivedObservations : []).forEach((record) => {
      const lineage = byBehavior.get(record?.behaviorKey); const qualification = qualifyObservation(record, lineage);
      decisions.push({ observationId: observationIdentity(record), behaviorKey: record?.behaviorKey || null, ...qualification });
      if (!qualification.eligible) return;
      const evidence = { identity: observationIdentity(record), archiveId: record.archiveId || null, fingerprint: record.fingerprint || null, observationTimestamp: new Date(record.observationTimestamp).toISOString() };
      if (!candidates.has(record.behaviorKey)) candidates.set(record.behaviorKey, []);
      candidates.get(record.behaviorKey).push(evidence);
    });
    decisions.sort((left, right) => String(left.behaviorKey).localeCompare(String(right.behaviorKey)) || String(left.observationId).localeCompare(String(right.observationId)) || left.decision.localeCompare(right.decision));
    [...candidates.keys()].sort().forEach((behaviorKey) => {
      const prior = byBehavior.get(behaviorKey); const previous = prior?.revisions?.[prior.revisions.length - 1] || null;
      const known = new Map((previous?.evidence || []).map((item) => [item.identity, item]));
      const incoming = candidates.get(behaviorKey).sort(compareEvidence); incoming.forEach((item) => { if (!known.has(item.identity)) known.set(item.identity, item); });
      const evidence = [...known.values()].sort(compareEvidence); const addedCount = evidence.length - (previous?.evidence.length || 0);
      if (!prior && evidence.length < POLICY.minimumNewPatternEvidence) { diagnostics.push({ code: "new_pattern_evidence_insufficient", behaviorKey, evidenceCount: evidence.length }); return; }
      if (prior && addedCount === 0) { diagnostics.push({ code: "reinforcement_duplicate_only", patternId: prior.patternId }); return; }
      const patternId = prior?.patternId || patternIdentity(behaviorKey); const number = (previous?.revision || 0) + 1; const revisionId = `${patternId}:revision:${number}`;
      const revision = { patternId, revisionId, revision: number, behaviorKey, evidence, evidenceDigest: digest(evidence), addedEvidenceCount: addedCount, confidence: confidenceFor(evidence.length), stability: null, evaluatedAt: now, supersedes: previous?.revisionId || null, supersededBy: null };
      revision.stability = stabilityFor(revision, previous, addedCount, now);
      const revisions = prior ? clone(prior.revisions) : [];
      if (revisions.length) revisions[revisions.length - 1].supersededBy = revisionId;
      revisions.push(revision);
      const lineage = { patternId, behaviorKey, originalRevisionId: revisions[0].revisionId, activeRevisionId: revisionId, revisions };
      byBehavior.set(behaviorKey, lineage);
      diagnostics.push({ code: prior ? "pattern_superseded" : "pattern_created", patternId, revisionId, supersedes: revision.supersedes, confidenceBasisPoints: revision.confidence.basisPoints, stability: revision.stability });
    });
    const lineages = [...byBehavior.values()].sort((a, b) => a.patternId.localeCompare(b.patternId));
    const validations = lineages.map(validateLineage); const errors = validations.flatMap((entry) => entry.errors);
    return immutable({ updated: diagnostics.some((item) => item.code === "pattern_created" || item.code === "pattern_superseded"), lineages, decisions, diagnostics, validation: { valid: errors.length === 0, errors, lineageCount: lineages.length, activeRevisionCount: lineages.length } });
  }

  const api = Object.freeze({ VERSION, ACTIVATION, POLICY, patternIdentity, qualifyObservation, confidenceFor, stabilityFor, validateLineage, evolve });
  globalScope.gridlyHistoricalPatternLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
