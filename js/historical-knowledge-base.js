(function attachHistoricalKnowledgeBase(globalScope) {
  "use strict";

  const VERSION = "LP081.historical-knowledge-base.v1";
  const VERSIONS = Object.freeze({
    registrySchema: "LP081.registry.v1",
    catalogSchema: "LP081.catalog.v1",
    relationshipSchema: "LP081.relationship.v1",
    indexSchema: "LP081.index.v1",
    knowledgeContract: "LP081.contract.v1"
  });
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticExecution: false, persistence: false, telemetry: false });
  const RELATIONSHIP_TYPES = Object.freeze(["complementary", "overlapping", "predecessor", "related", "successor"]);
  const FAILURE_CODES = Object.freeze({ UNSUPPORTED_VERSION: "unsupported_version", REGISTRY_INTEGRITY: "registry_integrity_failure", CATALOG_INTEGRITY: "catalog_integrity_failure", RELATIONSHIP_INTEGRITY: "relationship_integrity_failure", INDEX_INTEGRITY: "index_integrity_failure", REVISION_CONSISTENCY: "revision_consistency_failure", LINEAGE_CONSISTENCY: "lineage_consistency_failure" });
  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach((key) => deepFreeze(value[key])); } return value; }
  const immutable = (value) => deepFreeze(clone(value));
  function stable(value) { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; return JSON.stringify(value); }
  function fingerprint(value) { let hash = 2166136261; const text = stable(value); for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); } return `lp081-fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  const versionsSupported = (versions) => Object.keys(VERSIONS).every((key) => versions?.[key] === VERSIONS[key]);
  const reject = (code, failures) => immutable({ accepted: false, valid: false, failClosed: true, failureCodes: [code], failures: failures || [code], versions: VERSIONS });
  function versionGuard(options = {}) { return versionsSupported(options.versions || VERSIONS) ? null : reject(FAILURE_CODES.UNSUPPORTED_VERSION, ["Explicit LP081 versions are unsupported; automatic migration is prohibited."]); }
  const text = (...values) => values.find((value) => typeof value === "string" && value.length) || null;
  const list = (value) => Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.length).sort() : value ? [String(value)] : [];
  const identityOf = (pattern) => text(pattern?.canonicalIdentity, pattern?.patternId, pattern?.identity);
  const revisionOf = (pattern) => pattern?.currentRevision ?? pattern?.revision ?? 1;
  const lineageOf = (pattern) => text(pattern?.lineageReference, pattern?.lineageId, pattern?.lineage?.fingerprint, pattern?.behaviorKey);
  const archiveOf = (pattern) => text(pattern?.originatingArchiveIdentity, pattern?.archiveIdentity, pattern?.archiveId, pattern?.sourceArchiveId);
  const field = (pattern, camel, snake) => text(pattern?.[camel], pattern?.[snake]);
  function entryFrom(pattern) {
    const canonicalIdentity = identityOf(pattern), currentRevision = revisionOf(pattern), lineageReference = lineageOf(pattern), originatingArchiveIdentity = archiveOf(pattern);
    const material = { canonicalIdentity, currentRevision, lineageReference, originatingArchiveIdentity, patternFingerprint: text(pattern?.patternFingerprint, pattern?.fingerprint) || fingerprint(pattern), pattern: clone(pattern) };
    return { ...material, registryEntryFingerprint: fingerprint(material) };
  }

  function createRegistry(patterns = [], options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    const failures = [], byIdentity = new Map();
    (Array.isArray(patterns) ? patterns : []).forEach((pattern) => {
      const entry = entryFrom(pattern), id = entry.canonicalIdentity;
      if (!id || !Number.isInteger(entry.currentRevision) || entry.currentRevision < 1 || !entry.lineageReference || !entry.originatingArchiveIdentity) failures.push(`invalid_registry_entry:${id || "missing_identity"}`);
      else if (byIdentity.has(id)) failures.push(`duplicate_canonical_identity:${id}`);
      else byIdentity.set(id, entry);
    });
    if (failures.length) return reject(FAILURE_CODES.REGISTRY_INTEGRITY, failures.sort());
    const entries = [...byIdentity.values()].sort((a, b) => a.canonicalIdentity.localeCompare(b.canonicalIdentity));
    const body = { accepted: true, schemaVersion: VERSIONS.registrySchema, entries };
    return immutable({ ...body, fingerprint: fingerprint(body) });
  }

  function createCatalog(registry, options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    if (!registry?.accepted || !Array.isArray(registry.entries)) return reject(FAILURE_CODES.CATALOG_INTEGRITY);
    const entries = registry.entries.map((entry) => { const p = entry.pattern; return { canonicalIdentity: entry.canonicalIdentity, category: text(p.patternCategory, p.category, p.hazardType, p.hazard_type) || "uncategorized", knowledgeStatus: text(p.knowledgeStatus) || "governed", lifecycleStatus: text(p.lifecycleStatus, p.lifecycle?.status, p.status) || "unknown", qualityStatus: text(p.qualityStatus, p.patternQuality?.classification, p.confidence) || "unclassified", revisionReference: `${entry.canonicalIdentity}@${entry.currentRevision}` }; });
    const categories = [...new Set(entries.map((entry) => entry.category))].sort();
    const body = { accepted: true, schemaVersion: VERSIONS.catalogSchema, entries, categories };
    return immutable({ ...body, fingerprint: fingerprint(body) });
  }

  function createRelationships(registry, relationships = [], options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    const ids = new Set(registry?.entries?.map((entry) => entry.canonicalIdentity) || []), failures = [], seen = new Set();
    const entries = (Array.isArray(relationships) ? relationships : []).map((relationship) => ({ source: text(relationship.source, relationship.from), target: text(relationship.target, relationship.to), type: relationship.type })).sort((a, b) => stable(a).localeCompare(stable(b))).filter((relationship) => {
      const key = stable(relationship);
      if (!ids.has(relationship.source) || !ids.has(relationship.target) || relationship.source === relationship.target || !RELATIONSHIP_TYPES.includes(relationship.type)) failures.push(`invalid_relationship:${key}`);
      if (seen.has(key)) failures.push(`duplicate_relationship:${key}`); seen.add(key); return true;
    }).map((relationship) => ({ ...relationship, relationshipFingerprint: fingerprint(relationship) }));
    if (failures.length) return reject(FAILURE_CODES.RELATIONSHIP_INTEGRITY, failures.sort());
    const body = { accepted: true, schemaVersion: VERSIONS.relationshipSchema, entries };
    return immutable({ ...body, fingerprint: fingerprint(body) });
  }

  function createIndex(registry, catalog, options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    if (!registry?.accepted || !catalog?.accepted) return reject(FAILURE_CODES.INDEX_INTEGRITY);
    const indexes = { canonicalIdentity: {}, crossingIdentity: {}, roadwayIdentity: {}, awarenessArea: {}, community: {}, county: {}, patternCategory: {} };
    const add = (name, key, id) => { list(key).forEach((part) => { (indexes[name][part] ||= []).push(id); }); };
    registry.entries.forEach((entry) => { const p = entry.pattern, id = entry.canonicalIdentity, catalogEntry = catalog.entries.find((item) => item.canonicalIdentity === id); add("canonicalIdentity", id, id); add("crossingIdentity", field(p, "crossingIdentity", "crossing_identity") || field(p, "crossingName", "crossing_name"), id); add("roadwayIdentity", field(p, "roadwayIdentity", "roadway_identity") || field(p, "roadwayName", "roadway_name"), id); add("awarenessArea", field(p, "awarenessArea", "awareness_area"), id); add("community", p.community, id); add("county", p.county, id); add("patternCategory", catalogEntry?.category, id); });
    Object.values(indexes).forEach((index) => Object.keys(index).sort().forEach((key) => { index[key] = [...new Set(index[key])].sort(); }));
    const body = { accepted: true, schemaVersion: VERSIONS.indexSchema, indexes };
    return immutable({ ...body, fingerprint: fingerprint(body) });
  }

  function validateConsistency(registry, catalog, relationships, index, options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    const failures = [], ids = registry?.entries?.map((entry) => entry.canonicalIdentity) || [], idSet = new Set(ids);
    if (!registry?.accepted || ids.length !== idSet.size) failures.push(FAILURE_CODES.REGISTRY_INTEGRITY);
    if (!catalog?.accepted || catalog.entries.length !== ids.length || catalog.entries.some((entry) => !idSet.has(entry.canonicalIdentity))) failures.push(FAILURE_CODES.CATALOG_INTEGRITY);
    if (!relationships?.accepted || relationships.entries.some((entry) => !idSet.has(entry.source) || !idSet.has(entry.target))) failures.push(FAILURE_CODES.RELATIONSHIP_INTEGRITY);
    if (!index?.accepted || ids.some((id) => stable(index.indexes.canonicalIdentity[id]) !== stable([id]))) failures.push(FAILURE_CODES.INDEX_INTEGRITY);
    if (registry?.entries?.some((entry) => !Number.isInteger(entry.currentRevision) || catalog.entries.find((item) => item.canonicalIdentity === entry.canonicalIdentity)?.revisionReference !== `${entry.canonicalIdentity}@${entry.currentRevision}`)) failures.push(FAILURE_CODES.REVISION_CONSISTENCY);
    if (registry?.entries?.some((entry) => !entry.lineageReference || !entry.originatingArchiveIdentity)) failures.push(FAILURE_CODES.LINEAGE_CONSISTENCY);
    const unique = [...new Set(failures)].sort(), body = { accepted: unique.length === 0, valid: unique.length === 0, failClosed: unique.length > 0, failures: unique, failureCodes: unique, contractVersion: VERSIONS.knowledgeContract };
    return immutable({ ...body, fingerprint: fingerprint(body) });
  }

  function createQueryInterface(registry, index) {
    const records = new Map(registry.entries.map((entry) => [entry.canonicalIdentity, entry]));
    const retrieve = (indexName, key) => immutable((index.indexes[indexName]?.[key] || []).map((id) => records.get(id)).filter(Boolean));
    const resultFingerprint = (results) => fingerprint(results);
    return Object.freeze({ patternByIdentity: (id) => immutable(records.get(id) || null), patternsByCommunity: (key) => retrieve("community", key), patternsByCounty: (key) => retrieve("county", key), patternsByCrossing: (key) => retrieve("crossingIdentity", key), patternsByRoadway: (key) => retrieve("roadwayIdentity", key), patternsByCategory: (key) => retrieve("patternCategory", key), resultFingerprint });
  }

  function createKnowledgeBase(patterns = [], relationships = [], options = {}) {
    const denied = versionGuard(options); if (denied) return denied;
    const registry = createRegistry(patterns, options); if (!registry.accepted) return registry;
    const catalog = createCatalog(registry, options), governedRelationships = createRelationships(registry, relationships, options), index = createIndex(registry, catalog, options);
    if (![catalog, governedRelationships, index].every((item) => item.accepted)) return [catalog, governedRelationships, index].find((item) => !item.accepted);
    const consistency = validateConsistency(registry, catalog, governedRelationships, index, options); if (!consistency.valid) return consistency;
    const query = createQueryInterface(registry, index);
    const fingerprints = immutable({ registry: registry.fingerprint, catalog: catalog.fingerprint, relationships: governedRelationships.fingerprint, indexes: index.fingerprint, knowledge: fingerprint({ registry: registry.fingerprint, catalog: catalog.fingerprint, relationships: governedRelationships.fingerprint, indexes: index.fingerprint }) });
    const diagnostics = immutable({ passive: true, production: false, registeredPatternCount: registry.entries.length, catalogState: "valid", indexState: "valid", relationshipCount: governedRelationships.entries.length, consistencyValidation: consistency, versionCompatibility: true, queryReady: true, fingerprints });
    return Object.freeze({ accepted: true, passive: true, versions: VERSIONS, registry, catalog, relationships: governedRelationships, index, consistency, query, fingerprints, diagnostics });
  }

  const api = Object.freeze({ VERSION, VERSIONS, ACTIVATION, RELATIONSHIP_TYPES, FAILURE_CODES, deepFreeze, fingerprint, createRegistry, createCatalog, createRelationships, createIndex, validateConsistency, createQueryInterface, createKnowledgeBase });
  globalScope.gridlyHistoricalKnowledgeBase = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
