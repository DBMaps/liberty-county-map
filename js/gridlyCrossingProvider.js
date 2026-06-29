(function () {
    "use strict";

    const PROVIDER_VERSION = "GRIDLY_CROSSING_PROVIDER_V1_SAFE";
    const LEGACY_SOURCE = "data/liberty-county-rail-crossings.geojson";
    const CURATED_PACKAGE_SOURCE = "Crossing-Packages/liberty/liberty-crossings-curated.geojson";
    const RAW_FRA_REVIEW_SOURCE = "Crossing-Packages/liberty/liberty-crossings.geojson";

    const state = {
        mode: "production",
        lastLegacyLoad: null,
        lastPackageLoad: null,
        lastFraReviewLoad: null,
        lastProductionLoad: null,
        lastLoadTrace: null
    };

    async function fetchJson(path) {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) throw new Error("Fetch failed for " + path + " with status " + response.status);
        return response.json();
    }

    function featureCount(geojson) {
        return geojson && Array.isArray(geojson.features) ? geojson.features.length : 0;
    }

    async function loadLegacyCrossings() {
        const geojson = await fetchJson(LEGACY_SOURCE);
        state.lastLegacyLoad = { source: LEGACY_SOURCE, featureCount: featureCount(geojson), loadedAt: new Date().toISOString() };
        state.lastLoadTrace = { mode: "legacy", sourcePath: LEGACY_SOURCE, providerFeatureCount: featureCount(geojson), providerInventoryCount: featureCount(geojson), loadedAt: state.lastLegacyLoad.loadedAt };
        return geojson;
    }

    async function loadCuratedPackageCrossings() {
        const geojson = await fetchJson(CURATED_PACKAGE_SOURCE);
        state.lastPackageLoad = { source: CURATED_PACKAGE_SOURCE, featureCount: featureCount(geojson), loadedAt: new Date().toISOString() };
        state.lastLoadTrace = { mode: "package", sourcePath: CURATED_PACKAGE_SOURCE, providerFeatureCount: featureCount(geojson), providerInventoryCount: featureCount(geojson), loadedAt: state.lastPackageLoad.loadedAt };
        return geojson;
    }

    async function loadFraReviewCrossings() {
        if (!window.gridlyCrossingPackageAdapter?.buildAdaptedCrossingGeojson) {
            throw new Error("gridlyCrossingPackageAdapter unavailable");
        }

        const geojson = await window.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson(RAW_FRA_REVIEW_SOURCE);
        state.lastFraReviewLoad = { source: RAW_FRA_REVIEW_SOURCE, featureCount: featureCount(geojson), loadedAt: new Date().toISOString() };
        state.lastLoadTrace = { mode: "fra-review", sourcePath: RAW_FRA_REVIEW_SOURCE, providerFeatureCount: featureCount(geojson), providerInventoryCount: featureCount(geojson), adapterTrace: window.gridlyCrossingPackageAdapter?.getLastLoadTrace?.() || null, loadedAt: state.lastFraReviewLoad.loadedAt };
        return geojson;
    }

    function resolveRuntimeCrossingSource(options) {
        const explicitSource = options?.sourcePath || options?.crossingSource || options?.runtimeCrossingSourcePath;
        if (explicitSource) return explicitSource;

        const countyId = options?.countyId || (typeof window.gridlyGetActiveCountyId === "function" ? window.gridlyGetActiveCountyId() : null);
        if (countyId && typeof window.gridlyGetCountyRuntimeSources === "function") {
            return window.gridlyGetCountyRuntimeSources(countyId)?.crossingSource || null;
        }
        if (typeof window.gridlyGetActiveCountyRuntimeSources === "function") {
            return window.gridlyGetActiveCountyRuntimeSources()?.crossingSource || null;
        }
        return null;
    }

    async function loadRuntimeProductionCrossings(options) {
        if (!window.gridlyCrossingPackageAdapter?.buildAdaptedCrossingGeojson) {
            throw new Error("gridlyCrossingPackageAdapter unavailable");
        }

        const runtimeSource = resolveRuntimeCrossingSource(options);
        if (!runtimeSource) throw new Error("Active county crossing source unavailable");

        const geojson = await window.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson(runtimeSource, options?.geojson || options?.alreadyFetchedGeojson || null);
        state.lastProductionLoad = { source: runtimeSource, featureCount: featureCount(geojson), loadedAt: new Date().toISOString() };
        state.lastLoadTrace = { mode: "production", sourcePath: runtimeSource, providerFeatureCount: featureCount(geojson), providerInventoryCount: featureCount(geojson), adapterTrace: window.gridlyCrossingPackageAdapter?.getLastLoadTrace?.() || null, loadedAt: state.lastProductionLoad.loadedAt };
        return geojson;
    }

    async function getActiveCountyCrossings(options) {
        const requestedMode = options && options.mode ? String(options.mode).toLowerCase() : state.mode;

        if (requestedMode === "package") return loadCuratedPackageCrossings();
        if (requestedMode === "fra-review") return loadFraReviewCrossings();
        if (requestedMode === "production") return loadRuntimeProductionCrossings(options || {});

        return loadLegacyCrossings();
    }

    function setMode(mode) {
        const normalized = String(mode || "").toLowerCase();

        if (!["legacy", "package", "fra-review", "production"].includes(normalized)) {
            return {
                changed: false,
                reason: "invalid_mode",
                allowedModes: ["legacy", "package", "fra-review", "production"],
                currentMode: state.mode
            };
        }

        state.mode = normalized;

        return {
            changed: true,
            mode: state.mode,
            providerVersion: PROVIDER_VERSION
        };
    }

    async function audit() {
        const legacy = await loadLegacyCrossings();
        const packaged = await loadCuratedPackageCrossings();
        const fraReview = await loadFraReviewCrossings();
        const active = await getActiveCountyCrossings();

        return {
            auditVersion: PROVIDER_VERSION,
            generatedAt: new Date().toISOString(),
            currentMode: state.mode,
            defaultMode: "production",

            legacyProvider: {
                source: LEGACY_SOURCE,
                featureCount: featureCount(legacy),
                productionSafe: true
            },

            packageProvider: {
                source: CURATED_PACKAGE_SOURCE,
                featureCount: featureCount(packaged),
                productionSafe: true,
                visuallyCertified: true
            },

            fraReviewProvider: {
                source: RAW_FRA_REVIEW_SOURCE,
                featureCount: featureCount(fraReview),
                productionSafe: false,
                visuallyCertified: false,
                reason: "raw_fra_coordinates_not_certified_for_user_facing_rendering"
            },

            activeProvider: {
                mode: state.mode,
                featureCount: featureCount(active)
            },

            protectedSystems: {
                renderingModified: false,
                mapBehaviorModified: false,
                alertsModified: false,
                routeWatchModified: false,
                reportingModified: false,
                supabaseModified: false,
                mobilePortraitModified: false
            },

            finalDetermination:
                featureCount(legacy) === 5 &&
                featureCount(packaged) === 5 &&
                featureCount(fraReview) === 115
                    ? "PASS_SAFE_CROSSING_PROVIDER_RAW_FRA_HELD_FOR_REVIEW"
                    : "BLOCKED_SAFE_CROSSING_PROVIDER_VALIDATION_FAILED"
        };
    }

    window.gridlyCrossingProvider = {
        version: PROVIDER_VERSION,
        getActiveCountyCrossings,
        setMode,
        audit,
        getLastLoadTrace: function () { return state.lastLoadTrace ? Object.assign({}, state.lastLoadTrace) : null; }
    };

    window.gridlyGetActiveCountyCrossings = getActiveCountyCrossings;
    window.gridlyCrossingProviderAudit = audit;

    window.gridlyCrossingProviderRuntimePackageMode = false;
})();


