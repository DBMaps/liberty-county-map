/* LP201.2 audit-only console harness. This file is never loaded by the application. */
const EVIDENCE_URL = "/reports/lp2012/promotion-whatif.json";
const REQUIRED_NAMES = Object.freeze([
  "Dayton", "Tyler", "Waco", "Corpus Christi", "Austin", "Dallas", "El Paso",
  "Fort Worth", "Liberty", "Abbott", "Acala", "Houston", "Kyle"
]);
const DECISIONS = new Set(["PASS_PROPOSED", "RETAIN_CURRENT", "NEEDS_REVIEW"]);
const clone = value => JSON.parse(JSON.stringify(value));

export function createLp2012VisualReview(evidence, map) {
  if (evidence?.schemaVersion !== "gridly.lp2012.promotion-whatif.v1" || evidence.runtimeActivation !== false || !Array.isArray(evidence.records)) {
    throw new Error("LP201.2 visual review failed closed: certified inactive WhatIf evidence is required");
  }
  if (!map || typeof map.setView !== "function") throw new Error("LP201.2 visual review failed closed: live map instance unavailable");
  const records = evidence.records;
  const byGeoid = new Map(records.map(row => [row.canonical.placeGeoid, row]));
  const byName = new Map();
  for (const row of records) {
    const matches = byName.get(row.canonical.name) || [];
    matches.push(row);
    byName.set(row.canonical.name, matches);
  }
  const decisions = new Map();
  let selected = null;

  function resolve(identity) {
    const key = String(identity);
    if (byGeoid.has(key)) return byGeoid.get(key);
    const matches = byName.get(key) || [];
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      const choices = matches.map(row => ({ geoid: row.canonical.placeGeoid, name: row.canonical.name }));
      const error = new Error(`Ambiguous exact canonical name ${key}; use GEOID`);
      error.matches = choices;
      throw error;
    }
    throw new Error(`No exact canonical PLACE name or GEOID match: ${key}`);
  }

  function compact(row) {
    const candidate = row.namedPlaceCandidate;
    const higherAuthority = row.decision === "RETAIN_HIGHER_AUTHORITY_CAMERA";
    return {
      canonical: {
        geoid: row.canonical.placeGeoid,
        name: row.canonical.name,
        governedType: row.canonical.governedType,
        countyMemberships: clone(row.canonical.countyMemberships)
      },
      lp2011: {
        bucket: row.lp2011Bucket,
        osmId: candidate?.osmId ?? null,
        placeClassification: candidate?.place ?? null
      },
      currentCamera: clone(row.currentCamera),
      comparison: { distanceMeters: row.comparison?.distanceMeters ?? null },
      eligibility: {
        promotionEligible: row.promotionEligible,
        decision: row.decision,
        decisionReason: row.decisionReason
      },
      proposedCamera: row.proposal ? clone(row.proposal) : null,
      comparisonCamera: higherAuthority && candidate ? {
        latitude: candidate.latitude, longitude: candidate.longitude, zoom: row.currentCamera.zoom,
        label: "COMPARISON ONLY — OWNER CAMERA REMAINS AUTHORITATIVE"
      } : null,
      protection: higherAuthority ? "HIGHER AUTHORITY RETAINED — NO LP201.2 PROMOTION PROPOSAL"
        : (!row.proposal ? "NO AUTOMATIC PROPOSAL" : null),
      ownerDecision: decisions.get(row.canonical.placeGeoid)?.ownerDecision ?? "PENDING",
      ownerNote: decisions.get(row.canonical.placeGeoid)?.ownerNote ?? "",
      review: { runtimeActivation: false, visualCertificationRequired: true, auditOnly: true }
    };
  }

  function review(identity) {
    selected = resolve(identity);
    const result = compact(selected);
    console.table({
      current: result.currentCamera,
      proposed: result.proposedCamera || { status: result.protection },
      comparisonOnly: result.comparisonCamera || { status: "not applicable" }
    });
    return result;
  }
  function move(camera, label) {
    if (!selected) throw new Error("Select a PLACE with gridlyLp2012VisualReview first");
    map.setView([camera.latitude, camera.longitude], camera.zoom, { animate: false });
    return { movement: "TEMPORARY_MAP_INSPECTION_ONLY", label, canonical: compact(selected).canonical, camera: clone(camera), runtimeActivation: false };
  }
  function showCurrent() { return move(selected?.currentCamera || (() => { throw new Error("Select a PLACE first"); })(), "CURRENT GOVERNED CAMERA"); }
  function showProposed() {
    if (!selected?.proposal) throw new Error(`${selected ? selected.canonical.name : "Selected PLACE"}: NO AUTOMATIC PROPOSAL`);
    return move(selected.proposal, "LP201.2 PROPOSED NAMED-PLACE CAMERA");
  }
  function showComparison() {
    if (!selected || selected.decision !== "RETAIN_HIGHER_AUTHORITY_CAMERA" || !selected.namedPlaceCandidate) throw new Error("No higher-authority comparison camera for selected PLACE");
    return move({ latitude: selected.namedPlaceCandidate.latitude, longitude: selected.namedPlaceCandidate.longitude, zoom: selected.currentCamera.zoom }, "COMPARISON ONLY — OWNER CAMERA REMAINS AUTHORITATIVE");
  }
  function topDistance(limit = 10) {
    return records.filter(row => row.proposal && Number.isFinite(row.comparison?.distanceMeters))
      .sort((a, b) => b.comparison.distanceMeters - a.comparison.distanceMeters || a.canonical.placeGeoid.localeCompare(b.canonical.placeGeoid))
      .slice(0, limit).map(compact);
  }
  function cohort() { return REQUIRED_NAMES.map(name => compact(resolve(name))); }
  function recordDecision(identity, ownerDecision, ownerNote = "") {
    if (!DECISIONS.has(ownerDecision)) throw new Error(`Decision must be one of: ${[...DECISIONS].join(", ")}`);
    const row = resolve(identity);
    const item = { geoid: row.canonical.placeGeoid, name: row.canonical.name, ownerDecision, ownerNote: String(ownerNote), auditOnly: true };
    decisions.set(item.geoid, item);
    return clone(item);
  }
  function exportDecisions() {
    return JSON.stringify({ schemaVersion: "gridly.lp2012.owner-visual-decisions.v1", runtimeActivation: false, auditOnly: true, persisted: false, decisions: [...decisions.values()].sort((a, b) => a.geoid.localeCompare(b.geoid)) }, null, 2);
  }
  return { review, showCurrent, showProposed, showComparison, topDistance, cohort, recordDecision, exportDecisions };
}

export async function installLp2012VisualReview({ evidenceUrl = EVIDENCE_URL, map = globalThis.gridlyMapInstance, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("LP201.2 visual review failed closed: fetch unavailable");
  const response = await fetchImpl(evidenceUrl, { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error(`LP201.2 visual review failed closed: evidence HTTP ${response.status}`);
  const helper = createLp2012VisualReview(await response.json(), map);
  globalThis.gridlyLp2012VisualReview = helper.review;
  globalThis.gridlyLp2012ShowCurrent = helper.showCurrent;
  globalThis.gridlyLp2012ShowProposed = helper.showProposed;
  globalThis.gridlyLp2012ShowComparison = helper.showComparison;
  globalThis.gridlyLp2012TopDistance = helper.topDistance;
  globalThis.gridlyLp2012RequiredCohort = helper.cohort;
  globalThis.gridlyLp2012RecordDecision = helper.recordDecision;
  globalThis.gridlyLp2012ExportDecisions = helper.exportDecisions;
  return { installed: true, evidenceUrl, runtimeActivation: false, auditOnly: true };
}
