(function () {
    "use strict";

    const AUDIT_VERSION = "GRIDLY_RUNTIME_SOURCE_COMPARISON_AUDIT_V1";

    function normalize(value) {
        if (value === undefined || value === null) {
            return null;
        }

        return String(value)
            .replace(/\\/g, "/")
            .replace(/^\/+/, "")
            .trim();
    }

    function safeGetRuntimeSources() {
        try {
            if (typeof window.gridlyGetActiveCountyRuntimeSources === "function") {
                return window.gridlyGetActiveCountyRuntimeSources();
            }

            return null;
        } catch (error) {
            return {
                __error: String(error && error.message ? error.message : error)
            };
        }
    }

    async function runAudit(county) {

        const packageAudit =
            await window.gridlyRuntimeSourceRegistryBridgeAudit?.(county);

        const runtimeSources = safeGetRuntimeSources();

        const packageSources = packageAudit
            ? packageAudit.runtimeSources
            : null;

        const comparison = {

            boundaryMatches:
                normalize(runtimeSources && runtimeSources.boundarySource) ===
                normalize(packageSources && packageSources.boundarySource),

            roadMatches:
                normalize(runtimeSources && runtimeSources.roadSource) ===
                normalize(packageSources && packageSources.roadSource),

            crossingMatches:
                normalize(runtimeSources && runtimeSources.crossingSource) ===
                normalize(packageSources && packageSources.crossingSource),

            crossingOverridesMatches:
                normalize(runtimeSources && runtimeSources.crossingOverridesSource) ===
                normalize(packageSources && packageSources.crossingOverridesSource)

        };

        comparison.allMatched =
            comparison.boundaryMatches &&
            comparison.roadMatches &&
            comparison.crossingMatches &&
            comparison.crossingOverridesMatches;

        return {

            auditVersion: AUDIT_VERSION,

            generatedAt: new Date().toISOString(),

            requestedCounty: county || "Liberty",

            packageBridgeStatus:
                packageAudit
                    ? packageAudit.finalDetermination
                    : "UNAVAILABLE",

            packageSources,

            runtimeSources,

            comparison,

            runtimeModified: false,
            renderingModified: false,
            alertsModified: false,
            routeWatchModified: false,
            reportingModified: false,
            supabaseModified: false,
            mobileModified: false,

            finalDetermination:

                comparison.allMatched

                    ? "PASS_RUNTIME_EQUALS_PACKAGE"

                    : "OBSERVE_RUNTIME_DIFFERS_FROM_PACKAGE"

        };

    }

    window.gridlyRuntimeSourceComparisonAudit = runAudit;

})();
