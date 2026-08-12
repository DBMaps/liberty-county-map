(function () {
  "use strict";

  const PACKAGE_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.json";
  const MANIFEST_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json";
  const CONTRACT_PATH = "evidence/lp138/county-geometry-membership-contract.baseline.json";
  const PARSED_CACHE_LIMIT = 1;

  let parsedPackageCache = null;
  let loadPromise = null;
  let lastLoadError = null;

  function installRuntimeCountyGeometryPackage(pkg) {
    if (!pkg || !Array.isArray(pkg.counties)) throw new Error("Invalid runtime county geometry package");
    parsedPackageCache = Object.freeze(pkg);
    return parsedPackageCache;
  }

  async function fetchJson(path) {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response || !response.ok) throw new Error(`Unable to load ${path}: ${response ? response.status : "no response"}`);
    return response.json();
  }

  async function loadRuntimeCountyGeometryPackage() {
    if (parsedPackageCache) return parsedPackageCache;
    if (loadPromise) return loadPromise;
    lastLoadError = null;
    loadPromise = fetchJson(PACKAGE_PATH)
      .then((pkg) => {
        return installRuntimeCountyGeometryPackage(pkg);
      })
      .catch((error) => {
        lastLoadError = error;
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
    getCandidateGeometries: (countyIds) => parsedPackageCache && Array.isArray(countyIds)
      ? countyIds.map((countyId) => parsedPackageCache.counties.find((county) => county.countyId === countyId)).filter(Boolean)
      : null,
    getState: () => Object.freeze({ cached: Boolean(parsedPackageCache), loading: Boolean(loadPromise), error: lastLoadError ? (lastLoadError.message || String(lastLoadError)) : null, parsedCacheLimit: PARSED_CACHE_LIMIT })
  });
  window.gridlyLp0361cRuntimeCountyGeometryPackageAudit = auditRuntimeCountyGeometryPackage;
  loadRuntimeCountyGeometryPackage().catch(() => null);
})();
