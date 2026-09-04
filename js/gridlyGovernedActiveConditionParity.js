(function initGridlyGovernedActiveConditionParity(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.gridlyGovernedActiveConditionParity = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildParityContract() {
  "use strict";

  const CONTRACT = "GRIDLY_GOVERNED_ACTIVE_CONDITION_PARITY_CONTRACT";
  const clean = (value) => String(value == null ? "" : value).trim().toLowerCase();
  const first = (values) => values.map(clean).find(Boolean) || "";

  function canonicalIdentity(record = {}) {
    const raw = record.raw && typeof record.raw === "object" ? record.raw : {};
    const latest = record.latestReport && typeof record.latestReport === "object" ? record.latestReport : {};
    const evidence = first([record.governedEvidenceId, record.evidenceId, raw.governedEvidenceId, raw.evidenceId]);
    const sourceFamily = first([record.sourceKind, record.source, record.providerId, raw.sourceKind, raw.source, raw.providerId]);
    const officialId = first([record.officialSituationId, record.providerIncidentId, record.providerRecordId]);
    if (/official|drivetexas|txdot/.test(sourceFamily) && (officialId || record.id)) return `official:${officialId || clean(record.id)}`;
    const reportId = first([
      record.canonicalReportIdentity, record.lifecycleIdentity, record.persistedReportId,
      record.sourceReportId, record.source_report_id, record.reportId, record.report_id,
      raw.canonicalReportIdentity, raw.lifecycleIdentity, raw.persistedReportId,
      raw.sourceReportId, raw.source_report_id, raw.reportId, raw.report_id,
      latest.canonicalReportIdentity, latest.lifecycleIdentity, latest.persistedReportId,
      latest.sourceReportId, latest.reportId, latest.report_id, latest.id,
      raw.id, record.uuid, record.id
    ]);
    const normalizedEvidence = evidence.replace(/^(?:community_report|alert):/, "");
    const canonicalReportId = normalizedEvidence || reportId;
    if (canonicalReportId) return `community_report:${canonicalReportId}`;
    if (officialId) return `official:${officialId}`;
    const crossingId = first([record.crossingId, record.crossing_id, raw.crossingId, raw.crossing_id]);
    if (crossingId) return `crossing:${crossingId}`;
    return "";
  }

  function isActive(record = {}) {
    const raw = record.raw && typeof record.raw === "object" ? record.raw : {};
    const state = first([record.lifecycleStage, record.lifecycleState, record.lifecycle, record.status, record.state, raw.lifecycleStage, raw.lifecycleState, raw.lifecycle, raw.status, raw.state]);
    if (record.expired === true || raw.expired === true) return false;
    return !/^(?:cleared|recently_cleared|hazard_cleared|expired|inactive|historical|stale)$/.test(state);
  }

  function reconcile(representations = []) {
    const accepted = [];
    const suppressed = [];
    const seen = new Map();
    representations.forEach((representation, index) => {
      const record = representation?.item || representation?.record || representation || {};
      const canonicalId = canonicalIdentity(record) || `unresolved:${index}`;
      const sample = { canonicalId, representation, index };
      if (!isActive(record)) {
        suppressed.push({ ...sample, reason: "lifecycle_ineligible" });
        return;
      }
      if (seen.has(canonicalId)) suppressed.push({ ...sample, duplicateOf: seen.get(canonicalId) });
      else {
        seen.set(canonicalId, index);
        accepted.push(sample);
      }
    });
    return Object.freeze({
      contract: CONTRACT,
      rawRepresentationCount: representations.length,
      canonicalConditionCount: accepted.length,
      duplicateSuppressionCount: suppressed.filter((entry) => entry.duplicateOf !== undefined).length,
      canonicalIds: Object.freeze(accepted.map((entry) => entry.canonicalId)),
      accepted: Object.freeze(accepted),
      suppressed: Object.freeze(suppressed)
    });
  }

  // The governed projection is already lifecycle- and geography-qualified by
  // its owner. Rejoin those exact community records at the final summary
  // writer boundary so a stale/empty presentation snapshot cannot erase them.
  function convergeAuthoritativeSummary(summary = {}, governedRows = []) {
    const current = Array.isArray(summary?.activeReportsInArea) ? summary.activeReportsInArea : [];
    const governedCommunity = (Array.isArray(governedRows) ? governedRows : [])
      .filter((row) => /^community_report:/i.test(String(row?.evidenceId || "")))
      .map((row) => {
        const record = row?.record && typeof row.record === "object" ? row.record : {};
        return { ...record, governedEvidenceId: row.evidenceId, evidenceId: row.evidenceId };
      });
    const converged = reconcile([...current, ...governedCommunity]).accepted
      .map((entry) => entry.representation?.item || entry.representation?.record || entry.representation);
    return { ...summary, activeReportsInArea: converged };
  }

  function audit(input = {}) {
    const ids = (rows) => [...new Set((rows || []).map((row) => canonicalIdentity(row?.record || row)).filter(Boolean))].sort();
    const governedConditionIds = ids(input.governed || []);
    const alertsIds = ids(input.alerts || []);
    const kbygIds = ids(input.kbyg || []);
    const communitySummaryIds = ids(input.communitySummary || []);
    const top = reconcile(input.topAwarenessRepresentations || []);
    const topAwarenessCanonicalIds = top.canonicalIds.slice().sort();
    const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
    const briefState = clean(input.awarenessBriefState || "quiet");
    const countParityPass = [alertsIds, kbygIds, communitySummaryIds, topAwarenessCanonicalIds].every((value) => value.length === governedConditionIds.length);
    const identityParityPass = [alertsIds, kbygIds, communitySummaryIds, topAwarenessCanonicalIds].every((value) => same(value, governedConditionIds));
    const briefParityPass = governedConditionIds.length === 0 || briefState !== "quiet";
    return Object.freeze({
      contract: CONTRACT,
      selectedArea: input.selectedArea || null,
      governedConditionIds, alertsIds, kbygIds, communitySummaryIds, topAwarenessCanonicalIds,
      rawRepresentationCount: top.rawRepresentationCount,
      canonicalConditionCount: top.canonicalConditionCount,
      duplicateSuppressionCount: top.duplicateSuppressionCount,
      awarenessBriefState: briefState,
      locationContextCount: Math.max(0, Number(input.locationContextCount || 0)),
      countParityPass, identityParityPass, briefParityPass,
      overallPass: countParityPass && identityParityPass && briefParityPass
    });
  }

  return Object.freeze({ CONTRACT, canonicalIdentity, isActive, reconcile, convergeAuthoritativeSummary, audit });
});
