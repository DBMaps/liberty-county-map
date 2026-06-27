(function () {
  "use strict";

  const REGISTRY_URL = "assets/package-registry/runtime-package-registry.json";
  let registryCache = null;

  async function loadRuntimePackageRegistry() {
    if (registryCache) return registryCache;

    const response = await fetch(REGISTRY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to load runtime package registry.");

    registryCache = await response.json();
    return registryCache;
  }

  async function getPackagesForCounty(county) {
    const registry = await loadRuntimePackageRegistry();
    const wanted = String(county || "").trim().toLowerCase();

    return (registry.packages || []).filter((pkg) =>
      String(pkg.county || "").trim().toLowerCase() === wanted
    );
  }

  async function getPackageForCounty(county, packageType) {
    const packages = await getPackagesForCounty(county);
    const wantedType = String(packageType || "").trim().toLowerCase();

    return packages.find((pkg) =>
      String(pkg.packageType || "").trim().toLowerCase() === wantedType
    ) || null;
  }

  async function resolvePackageManifest(packageRecord) {
    if (!packageRecord || !packageRecord.manifest) {
      throw new Error("Package record missing manifest path.");
    }

    const response = await fetch(packageRecord.manifest, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Unable to fetch package manifest: " + packageRecord.manifest);
    }

    return await response.json();
  }

  async function auditPackageManifestResolution(county) {
    const packages = await getPackagesForCounty(county);
    const results = [];

    for (const packageRecord of packages) {
      try {
        const manifest = await resolvePackageManifest(packageRecord);

        results.push({
          packageType: packageRecord.packageType,
          county: packageRecord.county,
          path: packageRecord.manifest,
          resolved: true,
          packageTypeMatch: manifest.packageType === packageRecord.packageType,
          countyMatch: manifest.county === packageRecord.county
        });
      } catch (error) {
        results.push({
          packageType: packageRecord.packageType,
          county: packageRecord.county,
          path: packageRecord.manifest,
          resolved: false,
          error: error.message
        });
      }
    }

    return {
      county,
      packageCount: packages.length,
      resolvedCount: results.filter((item) => item.resolved).length,
      failedCount: results.filter((item) => !item.resolved).length,
      allResolved: results.every((item) => item.resolved),
      allMatched: results.every((item) => item.packageTypeMatch && item.countyMatch),
      results
    };
  }

  window.gridlyPackageDiscovery = {
    loadRuntimePackageRegistry,
    getPackagesForCounty,
    getPackageForCounty,
    resolvePackageManifest,
    auditPackageManifestResolution
  };

  window.gridlyPackageDiscoveryAudit = async function () {
    const registry = await loadRuntimePackageRegistry();

    return {
      available: true,
      registryType: registry.registryType,
      totalPackageTypes: registry.totalPackageTypes,
      totalPackages: registry.totalPackages,
      packageTypes: registry.packageTypes,
      libertyPackages: await getPackagesForCounty("Liberty"),
      harrisPackages: await getPackagesForCounty("Harris"),
      tylerPackages: await getPackagesForCounty("Tyler"),
      libertyManifestResolution: await auditPackageManifestResolution("Liberty"),
      harrisManifestResolution: await auditPackageManifestResolution("Harris"),
      tylerManifestResolution: await auditPackageManifestResolution("Tyler")
    };
  };
})();
