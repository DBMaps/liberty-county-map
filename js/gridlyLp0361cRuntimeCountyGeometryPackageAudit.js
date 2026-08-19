(function () {
  "use strict";

  const PACKAGE_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.json";
  const GOVERNED_BYTES = 47911048;
  const GOVERNED_SHA256 = "891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316";
  const GOVERNED_COUNTY_COUNT = 254;
  const MANIFEST_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json";
  const CONTRACT_PATH = "evidence/lp138/county-geometry-membership-contract.baseline.json";
  const PARSED_CACHE_LIMIT = 1;
  const RECOVERY_IDENTITY_PARAMETER = "gridlyGeometryIdentity";

  let parsedPackageCache = null;
  let countyRecordById = null;
  let countyBoundsById = null;
  let loadPromise = null;
  let lastLoadError = null;
  let loadDiagnostics = null;

  function selectedGeometryTransport() {
    const configured = window.GRIDLY_RUNTIME_CONFIG && window.GRIDLY_RUNTIME_CONFIG.authoritativeCountyGeometry;
    const transport = configured || { mode: "LOCAL_CANONICAL", url: PACKAGE_PATH, expectedBytes: GOVERNED_BYTES, expectedSha256: GOVERNED_SHA256, expectedCountyCount: GOVERNED_COUNTY_COUNT };
    if (!transport || !["LOCAL_CANONICAL", "REMOTE_PUBLIC_IMMUTABLE_OBJECT"].includes(transport.mode)) throw new Error("GEOMETRY_TRANSPORT_MODE_INVALID");
    if (transport.expectedBytes !== GOVERNED_BYTES || String(transport.expectedSha256).toLowerCase() !== GOVERNED_SHA256 || transport.expectedCountyCount !== GOVERNED_COUNTY_COUNT) throw new Error("GEOMETRY_TRANSPORT_IDENTITY_INVALID");
    if (transport.mode === "LOCAL_CANONICAL" && transport.url !== PACKAGE_PATH) throw new Error("GEOMETRY_LOCAL_PATH_INVALID");
    if (transport.mode === "REMOTE_PUBLIC_IMMUTABLE_OBJECT" && (!/^https:\/\//.test(transport.url) || !transport.url.endsWith(`/${GOVERNED_SHA256}.json`))) throw new Error("GEOMETRY_REMOTE_URL_INVALID");
    return Object.freeze({ ...transport, expectedSha256: GOVERNED_SHA256, sourceClassification: transport.mode === "LOCAL_CANONICAL" ? "SAME_ORIGIN_CANONICAL" : "CROSS_ORIGIN_PUBLIC_IMMUTABLE" });
  }

  function installRuntimeCountyGeometryPackage(pkg) {
    if (!pkg || !Array.isArray(pkg.counties)) throw new Error("Invalid runtime county geometry package");
    if (pkg.counties.length !== GOVERNED_COUNTY_COUNT) throw new Error("GEOMETRY_COUNTY_COUNT_MISMATCH");
    const records = Object.create(null);
    const bounds = Object.create(null);
    for (const county of pkg.counties) {
      const countyId = String(county && county.countyId || "");
      const value = county && county.bounds;
      if (!countyId || records[countyId] || !/^48\d{3}$/.test(String(county.countyFips || ""))) throw new Error("GEOMETRY_COUNTY_IDENTITY_INVALID");
      if (!value || ![value.south, value.west, value.north, value.east].every(Number.isFinite)
        || value.south >= value.north || value.west >= value.east) throw new Error(`GEOMETRY_BOUNDS_INVALID:${countyId}`);
      records[countyId] = county;
      bounds[countyId] = Object.freeze({ ...value, countyId, countyFips: county.countyFips, source: "governed-authoritative-county-geometry-v1" });
    }
    countyRecordById = Object.freeze(records);
    countyBoundsById = Object.freeze(bounds);
    parsedPackageCache = Object.freeze(pkg);
    return parsedPackageCache;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response || !response.ok) throw new Error(`Unable to load ${path}: ${response ? response.status : "no response"}`);
    return response.json();
  }

  function hex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function recoveryUrl(transport) {
    const separator = transport.url.includes("?") ? "&" : "?";
    return `${transport.url}${separator}${RECOVERY_IDENTITY_PARAMETER}=${encodeURIComponent(transport.expectedSha256)}`;
  }

  async function fetchGovernedGeometry(transport, { url = transport.url, cache = "force-cache", attempt = "initial" } = {}) {
    if (!loadDiagnostics) loadDiagnostics = { selectedTransportMode: transport.mode, selectedUrl: transport.url, expectedBytes: transport.expectedBytes, actualBytes: null, expectedSha256: transport.expectedSha256, actualSha256: null, expectedCountyCount: transport.expectedCountyCount, actualCountyCount: null, integrityPassed: false, sourceClassification: transport.sourceClassification, loadError: null, status: "loading", finalUnavailable: false, recoveryAttempted: false, attempts: [] };
    const attemptDiagnostic = { attempt, url, cache, actualBytes: null, actualSha256: null, error: null };
    loadDiagnostics.attempts.push(attemptDiagnostic);
    const options = { cache };
    if (transport.mode === "REMOTE_PUBLIC_IMMUTABLE_OBJECT") options.mode = "cors";
    try {
      const response = await fetch(url, options);
      if (!response || !response.ok) throw new Error(`Unable to load ${url}: ${response ? response.status : "no response"}`);
      const buffer = await response.arrayBuffer();
      loadDiagnostics.actualBytes = attemptDiagnostic.actualBytes = buffer.byteLength;
      if (buffer.byteLength !== transport.expectedBytes) throw new Error(`GEOMETRY_BYTE_LENGTH_MISMATCH:${buffer.byteLength}`);
      const digest = hex(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)));
      loadDiagnostics.actualSha256 = attemptDiagnostic.actualSha256 = digest;
      if (digest !== transport.expectedSha256) throw new Error(`GEOMETRY_SHA256_MISMATCH:${digest}`);
      let text;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(buffer); }
      catch (error) { throw new Error(`GEOMETRY_UTF8_INVALID:${error && error.message ? error.message : String(error)}`); }
      let pkg;
      try { pkg = JSON.parse(text); }
      catch (error) { throw new Error(`GEOMETRY_JSON_INVALID:${error && error.message ? error.message : String(error)}`); }
      if (!pkg || typeof pkg !== "object" || Array.isArray(pkg) || !Array.isArray(pkg.counties)) throw new Error("GEOMETRY_SCHEMA_INVALID");
      loadDiagnostics.actualCountyCount = pkg.counties.length;
      if (pkg.counties.length !== transport.expectedCountyCount) throw new Error(`GEOMETRY_COUNTY_COUNT_MISMATCH:${pkg.counties.length}`);
      return pkg;
    } catch (error) {
      attemptDiagnostic.error = error && error.message ? error.message : String(error);
      throw error;
    }
  }

  async function loadRuntimeCountyGeometryPackage() {
    if (parsedPackageCache) return parsedPackageCache;
    if (loadPromise) return loadPromise;
    lastLoadError = null;
    let transport;
    try { transport = selectedGeometryTransport(); }
    catch (error) { lastLoadError = error; return Promise.reject(error); }
    loadDiagnostics = null;
    // A previously deployed package can survive in the browser HTTP cache after
    // the governed package identity changes.  That leaves canonical PLACE
    // containment unavailable and, in turn, prevents the active county from
    // advancing. Retry an identity mismatch once against the network; all
    // integrity checks still have to pass before the package is installed.
    loadPromise = fetchGovernedGeometry(transport)
      .catch((error) => {
        if (!/^GEOMETRY_(?:BYTE_LENGTH|SHA256)_MISMATCH:/.test(String(error?.message || error))) throw error;
        loadDiagnostics.recoveryAttempted = true;
        return fetchGovernedGeometry(transport, { url: recoveryUrl(transport), cache: "no-store", attempt: "certified-identity-recovery" });
      })
      .then((pkg) => {
        const installed = installRuntimeCountyGeometryPackage(pkg);
        loadDiagnostics.integrityPassed = true;
        loadDiagnostics.status = "installed";
        return installed;
      })
      .catch((error) => {
        lastLoadError = error;
        if (loadDiagnostics) {
          loadDiagnostics.loadError = error && error.message ? error.message : String(error);
          loadDiagnostics.status = "geometry-unavailable";
          loadDiagnostics.finalUnavailable = true;
        }
        throw error;
      })
      .finally(() => {
        loadPromise = null;
      });
    return loadPromise;
  }

  async function optionalJson(path) {
    try {
      return { available: true, value: await fetchJson(path), error: null };
    } catch (error) {
      return { available: false, value: null, error: error && error.message ? error.message : String(error) };
    }
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function validateContract(contract) {
    if (!contract || contract.schemaVersion !== "1.0.0" || contract.contractVersion !== "1.0.0" || contract.contractKind !== "CURRENT_OPERATIONAL_BASELINE") return false;
    const members = contract.approvedCounties;
    if (!Array.isArray(members) || contract.approvedCountyCount !== members.length || contract.existingBaselineCountyCount + contract.newlyApprovedCountyCount !== members.length || contract.newlyApprovedCountyCount !== 0) return false;
    const permissionNames = ["prepareGeometry", "generateRuntimePackage", "storageUpload", "deploy", "activateRuntime"];
    if (permissionNames.some((name) => typeof contract.permissions?.[name]?.authorized !== "boolean" || !contract.permissions[name].authorityRef)) return false;
    let priorFips = "";
    const ids = new Set();
    const fips = new Set();
    for (const member of members) {
      if (!member.countyId || !/^48\d{3}$/.test(member.fips) || ids.has(member.countyId) || fips.has(member.fips) || member.fips <= priorFips || !Array.isArray(member.gates) || member.gates.length !== 7) return false;
      ids.add(member.countyId); fips.add(member.fips); priorFips = member.fips;
    }
    return contract.provenance && contract.provenance.membershipSha256 === await sha256(canonicalJson(members));
  }

  async function auditRuntimeCountyGeometryPackage() {
    const manifest = await optionalJson(MANIFEST_PATH);
    const pkg = await optionalJson(PACKAGE_PATH);
    const contractResult = await optionalJson(CONTRACT_PATH);
    const contract = contractResult.value || {};
    const contractValid = contractResult.available && await validateContract(contract);
    const expectedCountyCount = contractValid ? contract.approvedCounties.length : null;
    const manifestValue = manifest.value || {};
    const pkgValue = pkg.value || {};
    const packagedCountyCount = Number(manifestValue.packagedCountyCount ?? (Array.isArray(pkgValue.counties) ? pkgValue.counties.length : 0));
    const blockedCountyCount = Number(manifestValue.blockedCountyCount ?? 0);
    const missingSourceCount = Number(manifestValue.missingSourceCount ?? 0);
    const invalidGeometryCount = Number(manifestValue.invalidGeometryCount ?? 0);
    const deterministicBuildPassed = Boolean(manifestValue.deterministicBuildSupported && manifestValue.packageSha256 && manifestValue.packageByteLength && pkg.available);
    const packageIds = Array.isArray(pkgValue.counties) ? pkgValue.counties.map((county) => county.countyId) : [];
    const contractIds = contractValid ? contract.approvedCounties.map((county) => county.countyId) : [];
    const contractPackageExactEquality = Boolean(contractValid && pkg.available && canonicalJson(packageIds) === canonicalJson(contractIds));
    const manifestMembershipMetadataStatus = manifest.available && manifestValue.expectedOperationalCountyCount === expectedCountyCount && manifestValue.packagedCountyCount === expectedCountyCount ? "COUNT_METADATA_ALIGNED_EXACT_MEMBERSHIP_VERIFIED_FROM_PACKAGE" : "MISSING_OR_MISMATCHED";
    const certificationPassed = Boolean(pkg.available && manifest.available && contractPackageExactEquality && packagedCountyCount === expectedCountyCount && blockedCountyCount === 0 && missingSourceCount === 0 && invalidGeometryCount === 0 && manifestValue.certification && manifestValue.certification.passed === true);
    const blockers = [];
    if (!pkg.available) blockers.push("Generated runtime county geometry package is not present; run the LP036.1C builder locally.");
    if (!manifest.available) blockers.push("Generated runtime county geometry manifest is not present; run the LP036.1C builder locally.");
    if (!contractResult.available) blockers.push("LP138 current operational baseline contract is not available to the dormant audit path.");
    if (contractResult.available && !contractValid) blockers.push("LP138 current operational baseline contract is invalid.");
    if (pkg.available && contractValid && packagedCountyCount !== expectedCountyCount) blockers.push(`Packaged county count is ${packagedCountyCount}, expected ${expectedCountyCount} from contract.`);
    if (pkg.available && contractValid && !contractPackageExactEquality) blockers.push("Runtime package membership does not exactly equal contract membership.");
    if (blockedCountyCount) blockers.push(`${blockedCountyCount} packaged counties are blocked.`);
    if (missingSourceCount) blockers.push(`${missingSourceCount} registered boundary sources were missing at build time.`);
    if (invalidGeometryCount) blockers.push(`${invalidGeometryCount} registered geometries failed validation at build time.`);

    return Object.freeze({
      available: Boolean(pkg.available && manifest.available),
      packagePath: PACKAGE_PATH,
      manifestPath: MANIFEST_PATH,
      contractPath: CONTRACT_PATH,
      contractAvailable: contractResult.available,
      contractValid,
      contractRole: contract.contractKind || null,
      contractVersion: contract.contractVersion || null,
      expectedOperationalCountyCount: expectedCountyCount,
      contractMembershipSha256: contract.provenance && contract.provenance.membershipSha256 || null,
      packagedCountyCount,
      contractPackageExactEquality,
      manifestMembershipMetadataStatus,
      preparationAuthorized: contract.permissions?.prepareGeometry?.authorized === true,
      packageGenerationAuthorized: contract.permissions?.generateRuntimePackage?.authorized === true,
      storageUploadAuthorized: contract.permissions?.storageUpload?.authorized === true,
      deploymentAuthorized: contract.permissions?.deploy?.authorized === true,
      runtimeActivationAuthorized: contract.permissions?.activateRuntime?.authorized === true,
      fixedCountGovernanceActive: false,
      blockedCountyCount,
      missingSourceCount,
      invalidGeometryCount,
      deterministicBuildSupported: true,
      deterministicBuildPassed,
      packageSha256: manifestValue.packageSha256 || null,
      packageByteLength: manifestValue.packageByteLength || null,
      sourceTotalByteLength: manifestValue.sourceTotalByteLength || null,
      packagedGeometryByteLength: manifestValue.packagedGeometryByteLength || null,
      browserDeploymentConfigured: true,
      pwaOfflineConfigured: true,
      capacitorWwwConfigured: true,
      androidPublicConfigured: true,
      dormantLoaderAvailable: false,
      parsedCacheLimit: PARSED_CACHE_LIMIT,
      productionResolverIntegrated: true,
      productionContainmentChanged: true,
      implementationReadyForLp0361d: certificationPassed,
      implementationReadyForLp0362: false,
      stateWritesAttempted: false,
      storageWritesAttempted: false,
      runtimeActivationAttempted: false,
      mapMovementAttempted: false,
      networkRefreshAttempted: true,
      notes: Object.freeze([
        "LP188.12 activates the governed one-package loader for authoritative coordinate-to-county containment.",
        "LP139 fetches the LP138 contract only when this read-only audit is explicitly invoked; startup, caching, and production resolution are unchanged.",
        "The unchanged manifest has count/hash metadata; exact membership is verified from the package and contract, so manifest membership fields are deferred to a future authorized milestone.",
        lastLoadError ? `Runtime geometry loader last error: ${lastLoadError.message || String(lastLoadError)}` : "Runtime geometry loader is available to production county resolution."
      ]),
      blockers: Object.freeze(blockers)
    });
  }

  window.gridlyLp0361cRuntimeCountyGeometryPackageLoader = Object.freeze({
    load: loadRuntimeCountyGeometryPackage,
    install: installRuntimeCountyGeometryPackage,
    getCandidateGeometries: (countyIds) => countyRecordById && Array.isArray(countyIds)
      ? countyIds.map((countyId) => countyRecordById[countyId]).filter(Boolean)
      : null,
    getCountyBounds: (countyId) => countyBoundsById && countyBoundsById[countyId] || null,
    getCountyBoundsById: () => countyBoundsById,
    getState: () => Object.freeze({ cached: Boolean(parsedPackageCache), loading: Boolean(loadPromise), error: lastLoadError ? (lastLoadError.message || String(lastLoadError)) : null, parsedCacheLimit: PARSED_CACHE_LIMIT, ...(loadDiagnostics || {}) })
  });
  window.gridlyLp0361cRuntimeCountyGeometryPackageAudit = auditRuntimeCountyGeometryPackage;
  loadRuntimeCountyGeometryPackage().catch(() => null);
})();
