(function attachHistoricalArchivePersistence(globalScope) {
  "use strict";

  const VERSION = "LP077.historical-archive-persistence.v1";
  const SUPPORTED_ARCHIVE_VERSIONS = Object.freeze([1]);
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, automaticBackfill: false });
  const REQUIRED_RECORD_FIELDS = Object.freeze(["archiveId", "fingerprint", "archiveVersion", "observationTimestamp", "qualificationStatus", "areaKey", "behaviorKey"]);
  const MIGRATIONS = Object.freeze([]);
  const TIMEZONES = Object.freeze({
    "liberty-county": Object.freeze({ canonical: "America/Chicago", aliases: Object.freeze(["US/Central"]), strategy: "iana", daylightSaving: "iana-rules" }),
    utc: Object.freeze({ canonical: "UTC", aliases: Object.freeze(["Etc/UTC", "Z"]), strategy: "iana", daylightSaving: "none" })
  });
  const GEOGRAPHY = Object.freeze({
    registryVersion: "LP077.geography.v1",
    counties: Object.freeze({ "liberty-county": Object.freeze({ id: "liberty-county", name: "Liberty County", state: "TX" }) }),
    communities: Object.freeze({ dayton: Object.freeze({ id: "dayton", name: "Dayton", countyId: "liberty-county" }), liberty: Object.freeze({ id: "liberty", name: "Liberty", countyId: "liberty-county" }) }),
    awarenessAreas: Object.freeze({ dayton: Object.freeze({ id: "dayton", countyId: "liberty-county" }), liberty: Object.freeze({ id: "liberty", countyId: "liberty-county" }) }),
    crossings: Object.freeze({}), roadwayReferences: Object.freeze({})
  });

  const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  function deepFreeze(value) { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); Object.keys(value).forEach((key) => deepFreeze(value[key])); } return value; }
  const result = (value) => deepFreeze(clone(value));
  const diagnostics = (code, path, detail) => ({ code, path, detail });
  function stable(value) {
    if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }
  function digest(value) { let hash = 2166136261; const text = stable(value); for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); } return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`; }
  function recordFingerprint(record) {
    const key = (value) => typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null;
    return [key(record.awarenessArea), key(record.community), key(record.crossing || record.roadway || record.subject), key(record.hazardType), key(record.eventType), new Date(record.observationTimestamp).toISOString()].join("|");
  }

  function createArchive(records, metadata) {
    const rows = Array.isArray(records) ? clone(records) : [];
    const meta = { archiveVersion: metadata?.archiveVersion, archiveId: metadata?.archiveId, createdAt: metadata?.createdAt, timezoneId: metadata?.timezoneId, geographyRegistryVersion: metadata?.geographyRegistryVersion };
    const ordered = rows.map((record, sequence) => ({ sequence, record }));
    return result({ ...meta, records: ordered, archiveFingerprint: digest({ ...meta, records: ordered }) });
  }

  function createReadOnlyAdapter(provider) {
    if (!provider || typeof provider.read !== "function") throw new TypeError("A read-only provider with read() is required");
    return Object.freeze({ kind: "read-only", async readArchive(archiveId) { return result(await provider.read(archiveId)); } });
  }

  function compatibility(version) {
    if (!Number.isInteger(version)) return result({ compatible: false, code: "archive_version_missing", version });
    if (!SUPPORTED_ARCHIVE_VERSIONS.includes(version)) return result({ compatible: false, code: version > Math.max(...SUPPORTED_ARCHIVE_VERSIONS) ? "archive_version_newer_than_runtime" : "archive_version_unsupported", version });
    return result({ compatible: true, code: "archive_version_supported", version });
  }
  function migrationPlan(fromVersion, toVersion) {
    const registered = MIGRATIONS.filter((entry) => entry.fromVersion >= fromVersion && entry.toVersion <= toVersion);
    return result({ automatic: false, fromVersion, toVersion, available: registered.length > 0, registrations: registered, code: registered.length ? "manual_migration_registered" : "no_migration_registered" });
  }

  function validateArchive(archive) {
    const errors = [];
    if (!archive || typeof archive !== "object") errors.push(diagnostics("archive_missing", "$", "Archive must be an object."));
    if (errors.length) return result({ valid: false, eligible: false, errors, evidence: null });
    for (const field of ["archiveId", "createdAt", "timezoneId", "geographyRegistryVersion", "archiveFingerprint"]) if (!archive[field]) errors.push(diagnostics("required_metadata_missing", field, `${field} is required.`));
    const version = compatibility(archive.archiveVersion); if (!version.compatible) errors.push(diagnostics(version.code, "archiveVersion", `Archive version ${String(archive.archiveVersion)} is not supported.`));
    if (!TIMEZONES[archive.timezoneId]) errors.push(diagnostics("timezone_unsupported", "timezoneId", "Archived timezone identity is not registered."));
    if (archive.geographyRegistryVersion !== GEOGRAPHY.registryVersion) errors.push(diagnostics("geography_version_unsupported", "geographyRegistryVersion", "Archived geography registry is not deterministically compatible."));
    if (!Array.isArray(archive.records)) errors.push(diagnostics("records_missing", "records", "Ordered records are required."));
    else archive.records.forEach((entry, index) => {
      if (!entry || entry.sequence !== index) errors.push(diagnostics("record_order_invalid", `records[${index}].sequence`, "Sequence must be contiguous and preserve source order."));
      const record = entry?.record;
      REQUIRED_RECORD_FIELDS.forEach((field) => { if (record?.[field] === undefined || record?.[field] === null || record?.[field] === "") errors.push(diagnostics("record_metadata_missing", `records[${index}].record.${field}`, `${field} is required.`)); });
      if (record && record.archiveVersion !== archive.archiveVersion) errors.push(diagnostics("record_version_mismatch", `records[${index}].record.archiveVersion`, "Record and archive versions must match."));
      if (record?.observationTimestamp && !Number.isFinite(Date.parse(record.observationTimestamp))) errors.push(diagnostics("record_timestamp_invalid", `records[${index}].record.observationTimestamp`, "Timestamp must identify an instant."));
      if (record?.fingerprint) { try { if (recordFingerprint(record) !== record.fingerprint) errors.push(diagnostics("record_fingerprint_invalid", `records[${index}].record.fingerprint`, "Immutable record fingerprint does not match content.")); } catch (_) { errors.push(diagnostics("record_fingerprint_invalid", `records[${index}].record.fingerprint`, "Fingerprint cannot be evaluated.")); } }
    });
    const expected = archive.archiveFingerprint && digest({ archiveVersion: archive.archiveVersion, archiveId: archive.archiveId, createdAt: archive.createdAt, timezoneId: archive.timezoneId, geographyRegistryVersion: archive.geographyRegistryVersion, records: archive.records });
    if (archive.archiveFingerprint && expected !== archive.archiveFingerprint) errors.push(diagnostics("archive_fingerprint_invalid", "archiveFingerprint", "Archive identity or content has changed."));
    return result({ valid: errors.length === 0, eligible: errors.length === 0, errors, evidence: errors.length ? null : { archiveId: archive.archiveId, archiveFingerprint: archive.archiveFingerprint, recordCount: archive.records.length, ordering: "contiguous", version: archive.archiveVersion } });
  }

  function normalizeTimestamp(timestamp, timezoneId) {
    if (!TIMEZONES[timezoneId]) return result({ ok: false, code: "timezone_unsupported", timezoneId });
    const instant = Date.parse(timestamp); if (!Number.isFinite(instant)) return result({ ok: false, code: "timestamp_invalid", timezoneId });
    const canonical = TIMEZONES[timezoneId].canonical;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: canonical, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant).reduce((map, part) => (map[part.type] = part.value, map), {});
    return result({ ok: true, timezoneId, canonicalTimezone: canonical, instant: new Date(instant).toISOString(), localDate: `${parts.year}-${parts.month}-${parts.day}`, localTime: `${parts.hour}:${parts.minute}:${parts.second}`, daylightSaving: TIMEZONES[timezoneId].daylightSaving });
  }

  function replay(archive, authorization) {
    const validation = validateArchive(archive);
    if (!validation.valid) return result({ status: "rejected", delivered: [], diagnostics: validation.errors, summary: { attempted: 0, delivered: 0, duplicatesSuppressed: 0, interrupted: false } });
    if (authorization?.authorized !== true || typeof authorization.purpose !== "string" || !authorization.purpose.trim()) return result({ status: "rejected", delivered: [], diagnostics: [diagnostics("replay_unauthorized", "authorization", "Explicit replay authorization and purpose are required.")], summary: { attempted: 0, delivered: 0, duplicatesSuppressed: 0, interrupted: false } });
    const seen = new Set(), delivered = [], duplicateIds = [];
    for (const entry of archive.records) { const identity = entry.record.fingerprint; if (seen.has(identity)) duplicateIds.push(identity); else { seen.add(identity); delivered.push(entry.record); } }
    return result({ status: "complete", delivered, diagnostics: [], summary: { archiveId: archive.archiveId, attempted: archive.records.length, delivered: delivered.length, duplicatesSuppressed: duplicateIds.length, duplicateFingerprints: duplicateIds, interrupted: false, deterministicEvidence: digest(delivered) } });
  }
  function controlledBackfill(archive, authorization, deliver) {
    const replayed = replay(archive, authorization); if (replayed.status !== "complete") return replayed;
    if (typeof deliver !== "function") return result({ ...replayed, status: "rejected", delivered: [], diagnostics: [diagnostics("delivery_missing", "deliver", "An explicit learning-pipeline delivery function is required.")] });
    try { deliver(replayed.delivered); return replayed; } catch (_) { return result({ status: "interrupted", delivered: [], diagnostics: [diagnostics("replay_interrupted", "deliver", "Delivery did not complete; no checkpoint was committed.")], summary: { ...replayed.summary, delivered: 0, interrupted: true } }); }
  }

  const api = Object.freeze({ VERSION, SUPPORTED_ARCHIVE_VERSIONS, ACTIVATION, TIMEZONES, GEOGRAPHY, MIGRATIONS, createArchive, createReadOnlyAdapter, compatibility, migrationPlan, validateArchive, normalizeTimestamp, replay, controlledBackfill });
  globalScope.gridlyHistoricalArchivePersistence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
