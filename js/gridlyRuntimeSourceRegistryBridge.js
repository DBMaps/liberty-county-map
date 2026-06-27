(function () {
    "use strict";

    const BRIDGE_VERSION = "GRIDLY_RUNTIME_SOURCE_REGISTRY_BRIDGE_V1";

    function normalizeCountyName(county) {
        return String(county || "").trim();
    }

    function normalizeCountyKey(county) {
        return normalizeCountyName(county).toLowerCase().replace(/\s+/g, "-");
    }

    function resolvePackagePath(manifest, fieldName) {
        if (!manifest || !manifest[fieldName]) {
            return null;
        }

        const value = String(manifest[fieldName] || "").trim();

        if (!value) {
            return null;
        }

        if (/^[a-z]+:\/\//i.test(value)) {
            return value;
        }

        return value.replace(/\\/g, "/").replace(/^\/+/, "");
    }

    async function loadManifestFromDiscovery(county, packageType) {
        const discovery = window.gridlyPackageDiscovery;

        if (!discovery || typeof discovery.getPackageManifest !== "function") {
            return {
                loaded: false,
                reason: "gridlyPackageDiscovery.getPackageManifest_unavailable",
                manifest: null
            };
        }

        try {
            const manifest = await discovery.getPackageManifest(county, packageType);

            return {
                loaded: !!manifest,
                reason: manifest ? "loaded" : "manifest_not_found",
                manifest: manifest || null
            };
        } catch (error) {
            return {
                loaded: false,
                reason: "manifest_load_error",
                error: String(error && error.message ? error.message : error),
                manifest: null
            };
        }
    }

    async function buildRuntimeSourcesFromPackages(county) {
        const requestedCounty = normalizeCountyName(county || "Liberty");
        const countyKey = normalizeCountyKey(requestedCounty);

        const communityResult = await loadManifestFromDiscovery(requestedCounty, "Community");
        const crossingResult = await loadManifestFromDiscovery(requestedCounty, "Crossing");

        const communityManifest = communityResult.manifest;
        const crossingManifest = crossingResult.manifest;

        const runtimeSources = {
            county: requestedCounty,
            countyKey,
            bridgeVersion: BRIDGE_VERSION,

            boundarySource: resolvePackagePath(communityManifest, "boundaryFile") ||
                resolvePackagePath(communityManifest, "boundarySource") ||
                resolvePackagePath(communityManifest, "boundaryPackageFile") ||
                null,

            roadSource: resolvePackagePath(communityManifest, "packageFile") ||
                resolvePackagePath(communityManifest, "roadSource") ||
                resolvePackagePath(communityManifest, "roadsFile") ||
                null,

            crossingSource: resolvePackagePath(crossingManifest, "packageFile") ||
                resolvePackagePath(crossingManifest, "crossingSource") ||
                resolvePackagePath(crossingManifest, "crossingsFile") ||
                null,

            crossingOverridesSource: resolvePackagePath(crossingManifest, "overridesFile") ||
                resolvePackagePath(crossingManifest, "crossingOverridesSource") ||
                resolvePackagePath(crossingManifest, "overridesSource") ||
                null
        };

        const packageStatus = {
            communityLoaded: communityResult.loaded,
            crossingLoaded: crossingResult.loaded,
            communityReason: communityResult.reason,
            crossingReason: crossingResult.reason,
            communityPackageType: communityManifest && communityManifest.packageType || null,
            crossingPackageType: crossingManifest && crossingManifest.packageType || null
        };

        const contract = {
            hasCounty: !!requestedCounty,
            communityPackageValid: packageStatus.communityPackageType === "Community",
            crossingPackageValid: packageStatus.crossingPackageType === "Crossing",
            hasRoadSource: !!runtimeSources.roadSource,
            hasCrossingSource: !!runtimeSources.crossingSource
        };

        contract.packageContractValid =
            contract.hasCounty &&
            contract.communityPackageValid &&
            contract.crossingPackageValid &&
            contract.hasRoadSource &&
            contract.hasCrossingSource;

        return {
            available: true,
            bridgeVersion: BRIDGE_VERSION,
            generatedAt: new Date().toISOString(),
            requestedCounty,
            countyKey,
            runtimeSources,
            packageStatus,
            contract,
            productionRuntimeModified: false,
            existingRuntimeRegistryModified: false,
            renderingModified: false,
            mapBehaviorModified: false,
            alertsModified: false,
            routeWatchModified: false,
            reportingModified: false,
            supabaseModified: false,
            mobilePortraitModified: false
        };
    }

    async function auditRuntimeSourceRegistryBridge(county) {
        const requestedCounty = normalizeCountyName(county || "Liberty");

        const result = await buildRuntimeSourcesFromPackages(requestedCounty);

        result.finalDetermination = result.contract.packageContractValid
            ? "PASS_RUNTIME_PACKAGE_SOURCE_BRIDGE_READY"
            : "BLOCKED_RUNTIME_PACKAGE_SOURCE_BRIDGE_INCOMPLETE";

        return result;
    }

    window.gridlyRuntimeSourceRegistryBridge = {
        version: BRIDGE_VERSION,
        buildRuntimeSourcesFromPackages
    };

    window.gridlyRuntimeSourceRegistryBridgeAudit = auditRuntimeSourceRegistryBridge;
})();
