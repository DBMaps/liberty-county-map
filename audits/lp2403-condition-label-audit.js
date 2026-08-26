(function lp2403ConditionLabelAudit(root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.gridlyLP240ConditionLabelAudit = api.auditMountedConditionLabels;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildLp2403AuditApi(globalScope) {
  "use strict";

  const clean = (value) => String(value ?? "").trim();
  const canonical = (value) => clean(value).toLowerCase().replace(/[\s-]+/g, "_");
  const isLowercaseLabel = (value) => /[a-z]/.test(value) && !/[A-Z]/.test(value);

  function sourceFamilyFor(node) {
    const explicit = clean(node.dataset.gridlySourceFamily || node.dataset.gridlySourceKind || node.dataset.sourceFamily);
    if (explicit) return explicit;
    const lp236Source = clean(node.closest?.("[data-gridly-lp236-source]")?.dataset.gridlyLp236Source).toLowerCase();
    if (lp236Source === "weather") return "WEATHER";
    if (lp236Source === "official_roadway") return "OFFICIAL_ROADWAYS";
    if (lp236Source === "community_report") return "COMMUNITY_REPORTS";
    const text = clean(node.dataset.gridlyAlertSource || node.dataset.provider || node.closest?.("[data-gridly-alert-source]")?.dataset.gridlyAlertSource).toLowerCase();
    if (/weather|nws|noaa/.test(text)) return "WEATHER";
    if (/official|drivetexas|txdot/.test(text)) return "OFFICIAL_ROADWAYS";
    if (/crossing|rail/.test(text)) return "CROSSING_REPORTS";
    return "COMMUNITY_REPORTS";
  }

  function rowFor(node) {
    const labelNode = node.matches?.("[data-gridly-alert-condition-line]") ? node : node.querySelector?.("[data-gridly-alert-condition-line], [data-gridly-condition-label], [data-gridly-popup-field='title'], strong");
    const currentDisplayLabel = clean(labelNode?.textContent || node.dataset.gridlyCanonicalConditionLabel || node.dataset.gridlyAlertCondition || node.dataset.gridlyConditionLabel);
    const raw = clean(node.dataset.gridlyCanonicalKey || node.dataset.gridlyCanonicalHazardType || node.dataset.gridlyAlertHazardType || node.dataset.reportType || node.dataset.incidentCategory || node.dataset.hazardType);
    return Object.freeze({
      sourceFamily: sourceFamilyFor(node),
      canonicalKey: canonical(raw || currentDisplayLabel),
      displayLabel: currentDisplayLabel,
      currentDisplayLabel,
      surface: node.closest?.(".leaflet-popup") ? "popup" : (node.closest?.("[data-gridly-kbyg], #gridlyKnowBeforeYouGo") ? "kbyg" : (node.closest?.("[data-gridly-location-context], #gridlyLocationContext") ? "locationContext" : "alerts")),
      conditionId: clean(node.dataset.gridlyLp236ConditionId || node.dataset.gridlyCanonicalIncidentId || node.dataset.gridlyAlertIncidentId || node.dataset.incidentId || node.dataset.reportId || node.id)
    });
  }

  const emptySummary = () => Object.freeze({ conditionCount: 0, uniqueCanonicalKeyCount: 0, inconsistentLabelCount: 0, rawKeyLeakCount: 0, snakeCaseLeakCount: 0, lowercaseLabelCount: 0 });

  // Match LP240.1H.4 currentness: the active Alerts sheet wins, then its
  // retained Portrait mount, then the last connected, non-template root.
  function resolveCurrentMountedRoot(doc) {
    const activeSheet = doc?.querySelector?.('#gridlyPortraitV2Sheet[data-active-sheet="alerts"]');
    const portraitSheet = doc?.querySelector?.("#gridlyPortraitV2Sheet");
    return activeSheet?.querySelector?.('[data-gridly-lp236-alerts="true"]')
      || portraitSheet?.querySelector?.('[data-gridly-lp236-alerts="true"]')
      || Array.from(doc?.querySelectorAll?.('[data-gridly-lp236-alerts="true"]') || []).filter((node) => node?.isConnected !== false && !node?.closest?.("template")).at(-1)
      || null;
  }

  function auditMountedConditions(root) {
    if (!root?.querySelectorAll) return Object.freeze({ rows: Object.freeze([]), summary: emptySummary(), authorityAvailable: true });
    const selector = [
      "[data-gridly-canonical-condition-label]", "[data-gridly-alert-condition]",
      "[data-gridly-hazard-popup='consumer']", "[data-gridly-crossing-popup='consumer']",
      "[data-gridly-condition-label]"
    ].join(",");
    const rows = [...root.querySelectorAll(selector)].filter((node, index, all) => !all.some((parent, parentIndex) => parentIndex !== index && parent.contains?.(node))).map(rowFor).filter((row) => row.currentDisplayLabel || row.canonicalKey);
    const labelsByKey = new Map();
    rows.forEach((row) => {
      const ownedKey = `${row.sourceFamily}:${row.canonicalKey}`;
      if (!labelsByKey.has(ownedKey)) labelsByKey.set(ownedKey, new Set());
      labelsByKey.get(ownedKey).add(row.displayLabel);
    });
    const summary = Object.freeze({
      conditionCount: rows.length,
      uniqueCanonicalKeyCount: labelsByKey.size,
      inconsistentLabelCount: [...labelsByKey.values()].filter((labels) => labels.size > 1).length,
      rawKeyLeakCount: rows.filter((row) => row.displayLabel === row.canonicalKey).length,
      snakeCaseLeakCount: rows.filter((row) => /_/.test(row.displayLabel)).length,
      lowercaseLabelCount: rows.filter((row) => isLowercaseLabel(row.displayLabel)).length
    });
    return Object.freeze({ rows: Object.freeze(rows), summary, authorityAvailable: true });
  }

  function auditMountedConditionLabels(doc = globalScope?.document) {
    if (!doc?.querySelectorAll) return Object.freeze({ rows: Object.freeze([]), summary: emptySummary(), authorityAvailable: false });
    const root = resolveCurrentMountedRoot(doc);
    return auditMountedConditions(root);
  }

  return Object.freeze({ auditMountedConditionLabels, auditMountedConditions, resolveCurrentMountedRoot });
});
