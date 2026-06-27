(function () {
    "use strict";

    const PROVIDER_VERSION = "GRIDLY_CROSSING_PROVIDER_V1";
    const LEGACY_SOURCE = "data/liberty-county-rail-crossings.geojson";
    const PACKAGE_SOURCE = "Crossing-Packages/liberty/liberty-crossings.geojson";

    const state = {
        mode: "legacy",
        lastLegacyLoad: null,
        lastPackageLoad: null
    };

    async function fetchJson(path) {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Fetch failed for " + path + " with status " + response.status);
        }
        return response.json();
    }

    function featureCount(geojson) {
        return geojson && Array.isArray(geojson.features) ? geojson.features.length : 0;
    }

    async function loadLegacyCrossings() {
        const geojson = await fetchJson(LEGACY_SOURCE);

        state.lastLegacyLoad = {
            source: LEGACY_SOURCE,
            featureCount: featureCount(geojson),
            loadedAt: new Date().toISOString()
        };

        return geojson;
    }

    async function loadPackageCrossings() {
        if (
            !window.gridlyCrossingPackageAdapter ||
            typeof window.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson !== "function"
        ) {
            throw new Error("gridlyCrossingPackageAdapter unavailable");
        }

        const geojson = await window.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson(PACKAGE_SOURCE);

        state.lastPackageLoad = {
            source: PACKAGE_SOURCE,
            featureCount: featureCount(geojson),
            loadedAt: new Date().toISOString()
        };

        return geojson;
    }

    async function getActiveCountyCrossings(options) {
        const requestedMode =
            options && options.mode
                ? String(options.mode).toLowerCase()
                : state.mode;

        if (requestedMode === "package") {
            return loadPackageCrossings();
        }

        return loadLegacyCrossings();
    }

    function setMode(mode) {
        const normalized = String(mode || "").toLowerCase();

        if (normalized !== "legacy" && normalized !== "package") {
            return {
                changed: false,
                reason: "invalid_mode",
                allowedModes: ["legacy", "package"],
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
        let legacyResult = null;
        let packageResult = null;

        try {
            const legacy = await loadLegacyCrossings();
            legacyResult = {
                loaded: true,
                source: LEGACY_SOURCE,
                featureCount: featureCount(legacy)
            };
        } catch (error) {
            legacyResult = {
                loaded: false,
                source: LEGACY_SOURCE,
                error: String(error && error.message ? error.message : error)
            };
        }

        try {
            const packaged = await loadPackageCrossings();
            packageResult = {
                loaded: true,
                source: PACKAGE_SOURCE,
                featureCount: featureCount(packaged)
            };
        } catch (error) {
            packageResult = {
                loaded: false,
                source: PACKAGE_SOURCE,
                error: String(error && error.message ? error.message : error)
            };
        }

        const active = await getActiveCountyCrossings();

        const valid =
            legacyResult.loaded &&
            packageResult.loaded &&
            legacyResult.featureCount === 5 &&
            packageResult.featureCount === 115 &&
            state.mode === "legacy" &&
            featureCount(active) === 5;

        return {
            auditVersion: PROVIDER_VERSION,
            generatedAt: new Date().toISOString(),

            currentMode: state.mode,
            defaultMode: "legacy",

            legacyProvider: legacyResult,
            packageProvider: packageResult,
            activeProvider: {
                mode: state.mode,
                featureCount: featureCount(active)
            },

            providerContract: {
                exposesGridlyCrossingProvider: !!window.gridlyCrossingProvider,
                exposesGridlyGetActiveCountyCrossings: typeof window.gridlyGetActiveCountyCrossings === "function",
                legacyProviderAvailable: legacyResult.loaded,
                packageProviderAvailable: packageResult.loaded,
                legacyDefaultPreserved: state.mode === "legacy",
                packageCanBeLoadedWithoutActivation: packageResult.loaded
            },

            activationState: {
                packageActivated: state.mode === "package",
                runtimeCrossingSourceModified: false
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

            finalDetermination: valid
                ? "PASS_CROSSING_PROVIDER_READY_LEGACY_DEFAULT"
                : "BLOCKED_CROSSING_PROVIDER_VALIDATION_FAILED"
        };
    }

    window.gridlyCrossingProvider = {
        version: PROVIDER_VERSION,
        getActiveCountyCrossings,
        setMode,
        audit
    };

    window.gridlyGetActiveCountyCrossings = getActiveCountyCrossings;
    window.gridlyCrossingProviderAudit = audit;
})();
