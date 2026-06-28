(function () {
  "use strict";

  if (!window.gridlyPackageDiscovery) {
    throw new Error("gridlyPackageDiscovery.js must load before gridlyPackageLoader.js");
  }

  async function loadCommunityPackage(county) {
    const pkg = await window.gridlyPackageDiscovery.getPackageForCounty(county, "Community");

    if (!pkg) {
      throw new Error("Community package not found: " + county);
    }

    return await window.gridlyPackageDiscovery.resolvePackageManifest(pkg);
  }

  async function loadCrossingPackage(county) {
    const pkg = await window.gridlyPackageDiscovery.getPackageForCounty(county, "Crossing");

    if (!pkg) {
      throw new Error("Crossing package not found: " + county);
    }

    return await window.gridlyPackageDiscovery.resolvePackageManifest(pkg);
  }

  window.gridlyPackageLoader = {
    loadCommunityPackage,
    loadCrossingPackage
  };

  window.gridlyPackageLoaderAudit = async function (county = "Liberty") {

    const community = await loadCommunityPackage(county);
    const crossing = await loadCrossingPackage(county);

    return {
      county,

      communityLoaded: true,
      communityPackageType: community.packageType,
      communityStatus: community.status,

      crossingLoaded: true,
      crossingPackageType: crossing.packageType,
      crossingStatus: crossing.status,

      packageContractValid:
        community.packageType === "Community" &&
        crossing.packageType === "Crossing"
    };
  };

})();
