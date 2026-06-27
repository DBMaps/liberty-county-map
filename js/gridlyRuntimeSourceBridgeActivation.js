(function () {
    "use strict";

    const ACTIVATION_VERSION = "GRIDLY_RUNTIME_SOURCE_BRIDGE_ACTIVATION_V1";

    const state = {
        installed: false,
        warmed: false,
        activeCounty: "Liberty",
        packageSourcesByCountyKey: {},
        originalGetter: null,
        lastWarmup: null
    };

    function normalizeCountyName(county) {
        return String(county || "Liberty").trim() || "Liberty";
    }

    function normalizeCountyKey(county) {
        return normalizeCountyName(county).toLowerCase().replace(/\s+/g, "-");
    }

    function clone(value) {
        if (!value || typeof value !== "object") {
            return value;
        }

        try {
            return JSON.parse(JSON.stringify(value));
        } catch (error) {
            return Object.assign({}, value);
        }
    }

    function getRuntimeCountyName(runtimeSources) {
        return (
            runtimeSources &&
            (
                runtimeSources.county ||
                runtimeSources.countyName ||
                runtimeSources.activeCounty ||
                runtimeSources.name
            )
        ) || state.activeCounty || "Liberty";
    }

    async function warmPackageSources(county) {
        const requestedCounty = normalizeCountyName(county || state.activeCounty || "Liberty");
        const countyKey = normalizeCountyKey(requestedCounty);

        if (typeof window.gridlyRuntimeSourceRegistryBridgeAudit !== "function") {
            state.lastWarmup = {
                warmed: false,
                reason: "bridge_audit_unavailable",
                requestedCounty,
                generatedAt: new Date().toISOString()
            };
            return state.lastWarmup;
        }

        const bridgeAudit = await window.gridlyRuntimeSourceRegistryBridgeAudit(requestedCounty);

        if (
            !bridgeAudit ||
            bridgeAudit.finalDetermination !== "PASS_RUNTIME_PACKAGE_SOURCE_BRIDGE_READY" ||
            !bridgeAudit.runtimeSources ||
            !bridgeAudit.runtimeSources.boundarySource ||
            !bridgeAudit.runtimeSources.roadSource
        ) {
            state.lastWarmup = {
                warmed: false,
                reason: "bridge_not_ready_for_boundary_road_activation",
                requestedCounty,
                bridgeFinalDetermination: bridgeAudit && bridgeAudit.finalDetermination,
                generatedAt: new Date().toISOString()
            };
            return state.lastWarmup;
        }

        state.packageSourcesByCountyKey[countyKey] = {
            county: requestedCounty,
            countyKey,
            boundarySource: bridgeAudit.runtimeSources.boundarySource,
            roadSource: bridgeAudit.runtimeSources.roadSource,
            crossingSource: bridgeAudit.runtimeSources.crossingSource || null,
            warmedAt: new Date().toISOString()
        };

        state.warmed = true;
        state.lastWarmup = {
            warmed: true,
            reason: "boundary_and_road_package_sources_ready",
            requestedCounty,
            countyKey,
            boundarySource: bridgeAudit.runtimeSources.boundarySource,
            roadSource: bridgeAudit.runtimeSources.roadSource,
            crossingSourceObservedButNotActivated: bridgeAudit.runtimeSources.crossingSource || null,
            generatedAt: new Date().toISOString()
        };

        return state.lastWarmup;
    }

    function applyBoundaryRoadOverrides(runtimeSources) {
        const output = clone(runtimeSources || {});

        const runtimeCounty = getRuntimeCountyName(output);
        const countyKey = normalizeCountyKey(runtimeCounty);
        const packageSources = state.packageSourcesByCountyKey[countyKey];

        if (!packageSources) {
            return output;
        }

        output.boundarySource = packageSources.boundarySource;
        output.roadSource = packageSources.roadSource;

        output.packageBridgeApplied = true;
        output.packageBridgeActivationVersion = ACTIVATION_VERSION;
        output.packageBridgeScope = "boundary_and_roads_only";
        output.crossingSourcePreserved = true;

        return output;
    }

    function installWrapper() {
        if (state.installed) {
            return {
                installed: true,
                reason: "already_installed"
            };
        }

        if (typeof window.gridlyGetActiveCountyRuntimeSources !== "function") {
            return {
                installed: false,
                reason: "gridlyGetActiveCountyRuntimeSources_unavailable"
            };
        }

        state.originalGetter = window.gridlyGetActiveCountyRuntimeSources;

        window.gridlyGetActiveCountyRuntimeSourcesOriginal = state.originalGetter;

        window.gridlyGetActiveCountyRuntimeSources = function () {
            const runtimeSources = state.originalGetter.apply(this, arguments);
            return applyBoundaryRoadOverrides(runtimeSources);
        };

        state.installed = true;

        return {
            installed: true,
            reason: "boundary_and_road_source_wrapper_installed"
        };
    }

    async function activate(county) {
        const installResult = installWrapper();
        const warmupResult = await warmPackageSources(county || "Liberty");

        return {
            activationVersion: ACTIVATION_VERSION,
            generatedAt: new Date().toISOString(),
            installResult,
            warmupResult,
            activationScope: {
                boundarySource: true,
                roadSource: true,
                crossingSource: false,
                crossingOverridesSource: false
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
                installResult.installed && warmupResult.warmed
                    ? "PASS_BOUNDARY_ROAD_PACKAGE_BRIDGE_ACTIVE"
                    : "BLOCKED_BOUNDARY_ROAD_PACKAGE_BRIDGE_NOT_ACTIVE"
        };
    }

    async function audit(county) {
        const requestedCounty = normalizeCountyName(county || "Liberty");

        if (!state.installed) {
            await activate(requestedCounty);
        } else if (!state.packageSourcesByCountyKey[normalizeCountyKey(requestedCounty)]) {
            await warmPackageSources(requestedCounty);
        }

        const runtimeSources =
            typeof window.gridlyGetActiveCountyRuntimeSources === "function"
                ? window.gridlyGetActiveCountyRuntimeSources()
                : null;

        const originalRuntimeSources =
            typeof window.gridlyGetActiveCountyRuntimeSourcesOriginal === "function"
                ? window.gridlyGetActiveCountyRuntimeSourcesOriginal()
                : null;

        const countyKey = normalizeCountyKey(requestedCounty);
        const packageSources = state.packageSourcesByCountyKey[countyKey] || null;

        const boundaryRoadActive =
            !!runtimeSources &&
            !!packageSources &&
            runtimeSources.boundarySource === packageSources.boundarySource &&
            runtimeSources.roadSource === packageSources.roadSource;

        const crossingPreserved =
            !!runtimeSources &&
            !!originalRuntimeSources &&
            runtimeSources.crossingSource === originalRuntimeSources.crossingSource;

        return {
            auditVersion: ACTIVATION_VERSION,
            generatedAt: new Date().toISOString(),
            requestedCounty,
            installed: state.installed,
            warmed: state.warmed,
            lastWarmup: state.lastWarmup,

            activationScope: {
                boundarySource: true,
                roadSource: true,
                crossingSource: false,
                crossingOverridesSource: false
            },

            packageSources,
            runtimeSources,
            originalRuntimeSources,

            validation: {
                boundarySourceFromPackage: boundaryRoadActive && runtimeSources.boundarySource === packageSources.boundarySource,
                roadSourceFromPackage: boundaryRoadActive && runtimeSources.roadSource === packageSources.roadSource,
                crossingSourcePreserved: crossingPreserved,
                boundaryRoadActive,
                crossingPreserved
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
                boundaryRoadActive && crossingPreserved
                    ? "PASS_BOUNDARY_ROAD_PACKAGE_BRIDGE_ACTIVE_CROSSINGS_PRESERVED"
                    : "BLOCKED_BOUNDARY_ROAD_PACKAGE_BRIDGE_VALIDATION_FAILED"
        };
    }

    window.gridlyRuntimeSourceBridgeActivation = {
        version: ACTIVATION_VERSION,
        activate,
        audit,
        warmPackageSources
    };

    window.gridlyRuntimeSourceBridgeActivationAudit = audit;

    setTimeout(function () {
        activate("Liberty").catch(function (error) {
            state.lastWarmup = {
                warmed: false,
                reason: "activation_error",
                error: String(error && error.message ? error.message : error),
                generatedAt: new Date().toISOString()
            };
        });
    }, 0);
})();
