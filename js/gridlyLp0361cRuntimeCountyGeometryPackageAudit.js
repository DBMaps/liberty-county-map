(function () {
  "use strict";

  const PACKAGE_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.json";
  const MANIFEST_PATH = "assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json";
  const EXPECTED_OPERATIONAL_COUNTY_COUNT = 28;
  const PARSED_CACHE_LIMIT = 1;

  let parsedPackageCache = null;
  let loadPromise = null;
  let lastLoadError = null;

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
        parsedPackageCache = Object.freeze(pkg);
        return parsedPackageCache;
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

  async function auditRuntimeCountyGeometryPackage() {
    const manifest = await optionalJson(MANIFEST_PATH);
    const pkg = await optionalJson(PACKAGE_PATH);
    const manifestValue = manifest.value || {};
    const pkgValue = pkg.value || {};
    const packagedCountyCount = Number(manifestValue.packagedCountyCount ?? (Array.isArray(pkgValue.counties) ? pkgValue.counties.length : 0));
    const blockedCountyCount = Number(manifestValue.blockedCountyCount ?? 0);
    const missingSourceCount = Number(manifestValue.missingSourceCount ?? 0);
    const invalidGeometryCount = Number(manifestValue.invalidGeometryCount ?? 0);
    const deterministicBuildPassed = Boolean(manifestValue.deterministicBuildSupported && manifestValue.packageSha256 && manifestValue.packageByteLength && pkg.available);
    const certificationPassed = Boolean(pkg.available && manifest.available && packagedCountyCount === EXPECTED_OPERATIONAL_COUNTY_COUNT && blockedCountyCount === 0 && missingSourceCount === 0 && invalidGeometryCount === 0 && manifestValue.certification && manifestValue.certification.passed === true);
    const blockers = [];
    if (!pkg.available) blockers.push("Generated runtime county geometry package is not present; run the LP036.1C builder locally.");
    if (!manifest.available) blockers.push("Generated runtime county geometry manifest is not present; run the LP036.1C builder locally.");
    if (pkg.available && packagedCountyCount !== EXPECTED_OPERATIONAL_COUNTY_COUNT) blockers.push(`Packaged county count is ${packagedCountyCount}, expected ${EXPECTED_OPERATIONAL_COUNTY_COUNT}.`);
    if (blockedCountyCount) blockers.push(`${blockedCountyCount} packaged counties are blocked.`);
    if (missingSourceCount) blockers.push(`${missingSourceCount} registered boundary sources were missing at build time.`);
    if (invalidGeometryCount) blockers.push(`${invalidGeometryCount} registered geometries failed validation at build time.`);

    return Object.freeze({
      available: Boolean(pkg.available && manifest.available),
      packagePath: PACKAGE_PATH,
      manifestPath: MANIFEST_PATH,
      expectedOperationalCountyCount: EXPECTED_OPERATIONAL_COUNTY_COUNT,
      packagedCountyCount,
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
      dormantLoaderAvailable: true,
      parsedCacheLimit: PARSED_CACHE_LIMIT,
      productionResolverIntegrated: false,
      productionContainmentChanged: false,
      implementationReadyForLp0361d: certificationPassed,
      implementationReadyForLp0362: false,
      stateWritesAttempted: false,
      storageWritesAttempted: false,
      runtimeActivationAttempted: false,
      mapMovementAttempted: false,
      networkRefreshAttempted: false,
      notes: Object.freeze([
        "LP036.1C provides tooling, packaging configuration, a dormant one-package loader, and audit reporting only.",
        "Certification cannot pass until the owner generates the package and manifest locally.",
        lastLoadError ? `Dormant loader last error: ${lastLoadError.message || String(lastLoadError)}` : "Dormant loader has not changed production county resolution."
      ]),
      blockers: Object.freeze(blockers)
    });
  }

  window.gridlyLp0361cRuntimeCountyGeometryPackageLoader = Object.freeze({
    load: loadRuntimeCountyGeometryPackage,
    getState: () => Object.freeze({ cached: Boolean(parsedPackageCache), loading: Boolean(loadPromise), error: lastLoadError ? (lastLoadError.message || String(lastLoadError)) : null, parsedCacheLimit: PARSED_CACHE_LIMIT })
  });
  window.gridlyLp0361cRuntimeCountyGeometryPackageAudit = auditRuntimeCountyGeometryPackage;
})();
