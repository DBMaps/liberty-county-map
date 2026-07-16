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

(function loadGridlyPublishedAwarenessRuntime() {
    "use strict";

    if (typeof window.cleanDisplayValue !== "function") {
        window.cleanDisplayValue = function cleanDisplayValue(value) {
            return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
        };
    }

    if (typeof window.esc !== "function") {
        window.esc = function esc(value) {
            return String(value == null ? "" : value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        };
    }

    function loadAlertsConsumer() {
        if (document.querySelector('script[data-gridly-alerts-published-awareness="true"]')) return;
        const alertsScript = document.createElement("script");
        alertsScript.src = "js/gridlyAlertsPublishedAwareness.js?v=4";
        alertsScript.async = false;
        alertsScript.dataset.gridlyAlertsPublishedAwareness = "true";
        document.head.appendChild(alertsScript);
    }

    async function publishDriveTexasAwareness() {
        try {
            if (typeof window.gridlyDriveTexasConnector?.fetchNow === "function") {
                await window.gridlyDriveTexasConnector.fetchNow();
            }

            if (typeof window.refreshGridlyCommunityPulseSharedModel === "function") {
                await window.refreshGridlyCommunityPulseSharedModel({
                    reason: "startup-drivetexas-authoritative-publication",
                    topAwarenessMicrolineReadOnly: true
                });
            }

            if (typeof window.refreshPortraitV2LocalizedIntelligence === "function") {
                window.refreshPortraitV2LocalizedIntelligence();
            }
        } catch (error) {
            console.warn("Gridly DriveTexas startup publication deferred", error);
        }
    }

    function afterPublisherLoaded() {
        publishDriveTexasAwareness();
        loadAlertsConsumer();
    }

    if (window.gridlyAwarenessOfficialRoadwayPublisherRepairAudit?.().installed === true) {
        afterPublisherLoaded();
        return;
    }

    const existingPublisherScript = document.querySelector(
        'script[data-gridly-awareness-official-roadway-publisher="true"]'
    );

    if (existingPublisherScript) {
        existingPublisherScript.addEventListener("load", afterPublisherLoaded, { once: true });
        return;
    }

    const publisherScript = document.createElement("script");
    publisherScript.src = "js/gridlyAwarenessOfficialRoadwayPublisherRepair.js?v=6";
    publisherScript.async = false;
    publisherScript.dataset.gridlyAwarenessOfficialRoadwayPublisher = "true";
    publisherScript.onload = afterPublisherLoaded;
    publisherScript.onerror = loadAlertsConsumer;
    document.head.appendChild(publisherScript);
})();