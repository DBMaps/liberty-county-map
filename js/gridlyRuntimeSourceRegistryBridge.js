(function () {
    "use strict";

    const BRIDGE_VERSION = "GRIDLY_RUNTIME_SOURCE_REGISTRY_BRIDGE_V1_2";
    const RUNTIME_REGISTRY_PATH = "assets/package-registry/runtime-package-registry.json";

    function normalizeCountyName(county) {
        return String(county || "").trim();
    }

    function normalizeCountyKey(county) {
        return normalizeCountyName(county).toLowerCase().replace(/\s+/g, "-");
    }

    function normalizePackageType(type) {
        return String(type || "").trim().toLowerCase();
    }

    function cleanPath(value) {
        if (!value) return null;
        const cleaned = String(value).trim().replace(/\\/g, "/").replace(/^\/+/, "");
        return cleaned || null;
    }

    function firstManifestPath(manifest, fieldNames) {
        if (!manifest) return null;

        for (const fieldName of fieldNames) {
            if (manifest[fieldName]) {
                return cleanPath(manifest[fieldName]);
            }
        }

        if (manifest.files && typeof manifest.files === "object") {
            for (const fieldName of fieldNames) {
                if (manifest.files[fieldName]) {
                    return cleanPath(manifest.files[fieldName]);
                }
            }
        }

        if (manifest.sources && typeof manifest.sources === "object") {
            for (const fieldName of fieldNames) {
                if (manifest.sources[fieldName]) {
                    return cleanPath(manifest.sources[fieldName]);
                }
            }
        }

        return null;
    }

    async function fetchJson(path) {
        const response = await fetch(path, { cache: "no-store" });

        if (!response.ok) {
            throw new Error("Fetch failed for " + path + " with status " + response.status);
        }

        return response.json();
    }

    async function loadRuntimeRegistry() {
        return fetchJson(RUNTIME_REGISTRY_PATH);
    }

    function findPackageEntry(registry, county, packageType) {
        const countyKey = normalizeCountyKey(county);
        const typeKey = normalizePackageType(packageType);

        const packages = Array.isArray(registry && registry.packages)
            ? registry.packages
            : [];

        return packages.find(function (entry) {
            return normalizeCountyKey(entry.county) === countyKey &&
                normalizePackageType(entry.packageType) === typeKey;
        }) || null;
    }

    function getManifestPathFromEntry(entry) {
        return cleanPath(
            entry &&
            (
                entry.manifest ||
                entry.manifestPath ||
                entry.packageManifest ||
                entry.packageManifestPath
            )
        );
    }

    async function loadManifestFromRuntimeRegistry(county, packageType) {
        try {
            const registry = await loadRuntimeRegistry();
            const entry = findPackageEntry(registry, county, packageType);

            if (!entry) {
                return {
                    loaded: false,
                    reason: "runtime_registry_entry_not_found",
                    entry: null,
                    manifest: null
                };
            }

            const manifestPath = getManifestPathFromEntry(entry);

            if (!manifestPath) {
                return {
                    loaded: false,
                    reason: "runtime_registry_entry_missing_manifest_path",
                    entry,
                    manifest: null
                };
            }

            const manifest = await fetchJson(manifestPath);

            return {
                loaded: !!manifest,
                reason: manifest ? "loaded_from_runtime_registry" : "manifest_not_found",
                entry,
                manifest: manifest || null,
                manifestPath
            };
        } catch (error) {
            return {
                loaded: false,
                reason: "runtime_registry_manifest_load_error",
                error: String(error && error.message ? error.message : error),
                entry: null,
                manifest: null,
                manifestPath: null
            };
        }
    }

    function manifestKeys(manifest) {
        return manifest && typeof manifest === "object" ? Object.keys(manifest).sort() : [];
    }

    async function buildRuntimeSourcesFromPackages(county) {
        const requestedCounty = normalizeCountyName(county || "Liberty");
        const countyKey = normalizeCountyKey(requestedCounty);

        const communityResult = await loadManifestFromRuntimeRegistry(requestedCounty, "Community");
        const crossingResult = await loadManifestFromRuntimeRegistry(requestedCounty, "Crossing");

        const communityManifest = communityResult.manifest;
        const crossingManifest = crossingResult.manifest;

        const runtimeSources = {
            county: requestedCounty,
            countyKey,
            bridgeVersion: BRIDGE_VERSION,

            boundarySource: firstManifestPath(communityManifest, [
                "boundaryFile",
                "boundarySource",
                "boundaryPackageFile",
                "boundary",
                "countyBoundary",
                "boundaryGeojson",
                "boundaryGeoJson"
            ]),

            roadSource: firstManifestPath(communityManifest, [
                "packageFile",
                "communityPackageFile",
                "roadPackageFile",
                "roadsPackageFile",
                "roadSource",
                "roadsSource",
                "roadsFile",
                "roadFile",
                "communityFile",
                "sourceFile",
                "geojson",
                "geoJson"
            ]),

            crossingSource: firstManifestPath(crossingManifest, [
                "packageFile",
                "crossingPackageFile",
                "crossingsPackageFile",
                "crossingSource",
                "crossingsSource",
                "crossingsFile",
                "crossingFile",
                "sourceFile",
                "geojson",
                "geoJson"
            ]),

            crossingOverridesSource: firstManifestPath(crossingManifest, [
                "overridesFile",
                "crossingOverridesSource",
                "overridesSource",
                "crossingOverridesFile"
            ])
        };

        const packageStatus = {
            communityLoaded: communityResult.loaded,
            crossingLoaded: crossingResult.loaded,
            communityReason: communityResult.reason,
            crossingReason: crossingResult.reason,
            communityPackageType: communityManifest && communityManifest.packageType || null,
            crossingPackageType: crossingManifest && crossingManifest.packageType || null,
            communityManifestPath: communityResult.manifestPath || getManifestPathFromEntry(communityResult.entry),
            crossingManifestPath: crossingResult.manifestPath || getManifestPathFromEntry(crossingResult.entry),
            communityManifestKeys: manifestKeys(communityManifest),
            crossingManifestKeys: manifestKeys(crossingManifest)
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
            runtimeRegistryPath: RUNTIME_REGISTRY_PATH,
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
        const result = await buildRuntimeSourcesFromPackages(county || "Liberty");

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
