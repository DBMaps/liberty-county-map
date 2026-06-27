(function () {
  "use strict";

  const REGISTRY_URL = "assets/package-registry/runtime-package-registry.json";

  let registryCache = null;

  async function loadRuntimePackageRegistry() {
    if (registryCache) {
      return registryCache;
    }

    const response = await fetch(REGISTRY_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Unable to load runtime package registry.");
    }

    registryCache = await response.json();
    return registryCache;
  }

  async function getPackagesForCounty(county) {
    const registry = await loadRuntimePackageRegistry();
    const wanted = String(county || "").trim().toLowerCase();

    return (registry.packages || []).filter(function (pkg) {
      return String(pkg.county || "").trim().toLowerCase() === wanted;
    });
  }

  async function getPackageForCounty(county, packageType) {
    const packages = await getPackagesForCounty(county);
    const wantedType = String(packageType || "").trim().toLowerCase();

    return packages.find(function (pkg) {
      return String(pkg.packageType || "").trim().toLowerCase() === wantedType;
    }) || null;
  }

  window.gridlyPackageDiscovery = {
    loadRuntimePackageRegistry,
    getPackagesForCounty,
    getPackageForCounty
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
      tylerPackages: await getPackagesForCounty("Tyler")
    };
  };
})();
