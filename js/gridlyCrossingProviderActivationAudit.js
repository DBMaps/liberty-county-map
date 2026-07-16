(function () {
    "use strict";

    const AUDIT_VERSION = "GRIDLY_CROSSING_PROVIDER_PACKAGE_MODE_ACTIVATION_AUDIT_V1";

    function countFeatures(geojson) {
        return geojson && Array.isArray(geojson.features) ? geojson.features.length : 0;
    }

    async function audit() {
        const provider = window.gridlyCrossingProvider;

        if (!provider || typeof provider.setMode !== "function") {
            return {
                auditVersion: AUDIT_VERSION,
                available: false,
                finalDetermination: "BLOCKED_CROSSING_PROVIDER_UNAVAILABLE"
            };
        }

        const originalMode = "legacy";
        const packageSet = provider.setMode("package");
        const packageGeojson = await window.gridlyGetActiveCountyCrossings?.();
        const packageCount = countFeatures(packageGeojson);
        const rollbackSet = provider.setMode(originalMode);
        const rollbackGeojson = await window.gridlyGetActiveCountyCrossings?.();
        const rollbackCount = countFeatures(rollbackGeojson);

        const passed =
            packageSet.changed === true &&
            packageSet.mode === "package" &&
            packageCount === 115 &&
            rollbackSet.changed === true &&
            rollbackSet.mode === "legacy" &&
            rollbackCount === 5;

        return {
            auditVersion: AUDIT_VERSION,
            generatedAt: new Date().toISOString(),
            packageActivation: {
                setResult: packageSet,
                featureCount: packageCount,
                expectedFeatureCount: 115,
                passed: packageCount === 115
            },
            rollbackValidation: {
                setResult: rollbackSet,
                featureCount: rollbackCount,
                expectedFeatureCount: 5,
                passed: rollbackCount === 5
            },
            activationScope: {
                providerModeOnly: true,
                runtimeCrossingSourceModified: false,
                permanentActivation: false
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
            finalMode: "legacy",
            finalDetermination: passed
                ? "PASS_PACKAGE_MODE_ACTIVATION_AND_ROLLBACK"
                : "BLOCKED_PACKAGE_MODE_ACTIVATION_OR_ROLLBACK_FAILED"
        };
    }

    window.gridlyCrossingProviderActivationAudit = audit;
})();

(function loadGridlyPublishedAwarenessAlertsConsumer() {
    "use strict";

    const script = document.createElement("script");
    script.src = "js/gridlyAlertsPublishedAwareness.js?v=1";
    script.async = false;
    script.dataset.gridlyAlertsPublishedAwareness = "true";
    document.head.appendChild(script);
})();
