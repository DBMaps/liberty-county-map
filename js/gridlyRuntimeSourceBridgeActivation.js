(function () {
    "use strict";

    const ACTIVATION_VERSION = "GRIDLY_RUNTIME_SOURCE_BRIDGE_ACTIVATION_V1";

    const state = {
        installed: false,
        warmed: false,
        activated: false,
        activeCounty: "Liberty",
        activationCounty: null,
        activationRevision: 0,
        automaticWarmupEnabled: false,
        automaticWarmupScheduled: false,
        automaticWarmupExecuted: false,
        automaticWarmupCount: 0,
        explicitWarmupCount: 0,
        warmupState: "not_requested",
        warmupStarted: false,
        warmupCompleted: false,
        warmupSucceeded: false,
        packageSourcesByCountyKey: {},
        originalGetter: null,
        lastWarmup: null,
        preWarmAuthority: null,
        postWarmAuthority: null,
        changedFields: [],
        lastEffectiveGetterAuthority: null,
        candidateReadCounts: {
            registryReadCount: 0,
            manifestReadCount: 0,
            noStoreFetchCount: 0,
            candidateBuildCount: 0
        },
        operationCounts: {
            installWrapper: 0,
            warmPackageSources: 0,
            applyBoundaryRoadOverrides: 0,
            effectiveGetterRead: 0,
            bridgeRead: 0
        }
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
                runtimeSources.countyId ||
                runtimeSources.county ||
                runtimeSources.countyName ||
                runtimeSources.activeCounty ||
                runtimeSources.name
            )
        ) || state.activeCounty || "Liberty";
    }

    function sourceAuthority(runtimeSources) {
        if (!runtimeSources || typeof runtimeSources !== "object") return null;
        return Object.freeze({
            countyId: runtimeSources.countyId || runtimeSources.county || null,
            boundaryPath: runtimeSources.boundarySource || null,
            roadsPath: runtimeSources.roadSource || null,
            crossingsPath: runtimeSources.crossingSource || null,
            remoteCrossingsPath: runtimeSources.remoteCrossingSource || null,
            crossingOverridesPath: runtimeSources.crossingOverridesSource || null
        });
    }

    function changedAuthorityFields(before, after) {
        if (!before || !after) return [];
        return ["boundaryPath", "roadsPath", "crossingsPath", "remoteCrossingsPath", "crossingOverridesPath"]
            .filter(function (field) { return before[field] !== after[field]; });
    }

    function isPackageAuthorityApplied(registryAuthority, packageAuthority, effectiveAuthority) {
        return Boolean(
            registryAuthority &&
            packageAuthority &&
            effectiveAuthority &&
            (
                (packageAuthority.boundaryPath !== registryAuthority.boundaryPath && effectiveAuthority.boundaryPath === packageAuthority.boundaryPath) ||
                (packageAuthority.roadsPath !== registryAuthority.roadsPath && effectiveAuthority.roadsPath === packageAuthority.roadsPath)
            )
        );
    }

    function bridgeTelemetrySnapshot() {
        return typeof window.gridlyRuntimeSourceRegistryBridge?.telemetrySnapshot === "function"
            ? window.gridlyRuntimeSourceRegistryBridge.telemetrySnapshot()
            : {};
    }

    function recordCandidateReadDelta(before = {}) {
        const after = bridgeTelemetrySnapshot();
        state.candidateReadCounts.registryReadCount += Math.max(0, Number(after.runtimeRegistryFetchCount || 0) - Number(before.runtimeRegistryFetchCount || 0));
        state.candidateReadCounts.manifestReadCount += Math.max(0, Number(after.packageManifestReadCount || 0) - Number(before.packageManifestReadCount || 0));
        state.candidateReadCounts.noStoreFetchCount += Math.max(0, Number(after.noStoreFetchCount || 0) - Number(before.noStoreFetchCount || 0));
        state.candidateReadCounts.candidateBuildCount += Math.max(0, Number(after.buildRuntimeSourcesFromPackagesCount || 0) - Number(before.buildRuntimeSourcesFromPackagesCount || 0));
    }

    function finishWarmup(result, succeeded, telemetryBefore = {}) {
        recordCandidateReadDelta(telemetryBefore);
        state.lastWarmup = result;
        state.warmupCompleted = true;
        state.warmupSucceeded = succeeded === true;
        state.warmupState = succeeded === true ? "succeeded" : "failed";
        return result;
    }

    async function warmPackageSources(county) {
        const requestedCounty = normalizeCountyName(county || state.activeCounty || "Liberty");
        const countyKey = normalizeCountyKey(requestedCounty);
        const telemetryBefore = bridgeTelemetrySnapshot();
        state.operationCounts.warmPackageSources += 1;
        state.explicitWarmupCount += 1;
        state.warmupStarted = true;
        state.warmupCompleted = false;
        state.warmupSucceeded = false;
        state.warmupState = "in_progress";

        if (typeof window.gridlyRuntimeSourceRegistryBridgeAudit !== "function") {
            return finishWarmup({
                warmed: false,
                reason: "bridge_audit_unavailable",
                requestedCounty,
                generatedAt: new Date().toISOString()
            }, false, telemetryBefore);
        }

        let bridgeAudit;
        try {
            bridgeAudit = await window.gridlyRuntimeSourceRegistryBridgeAudit(requestedCounty);
        } catch (error) {
            finishWarmup({
                warmed: false,
                reason: "activation_error",
                requestedCounty,
                error: String(error && error.message ? error.message : error),
                generatedAt: new Date().toISOString()
            }, false, telemetryBefore);
            throw error;
        }

        if (
            !bridgeAudit ||
            bridgeAudit.finalDetermination !== "PASS_RUNTIME_PACKAGE_SOURCE_BRIDGE_READY" ||
            !bridgeAudit.runtimeSources ||
            !bridgeAudit.runtimeSources.boundarySource ||
            !bridgeAudit.runtimeSources.roadSource
        ) {
            return finishWarmup({
                warmed: false,
                reason: "bridge_not_ready_for_boundary_road_activation",
                requestedCounty,
                bridgeFinalDetermination: bridgeAudit && bridgeAudit.finalDetermination,
                generatedAt: new Date().toISOString()
            }, false, telemetryBefore);
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
        return finishWarmup({
            warmed: true,
            reason: "boundary_and_road_package_sources_ready",
            requestedCounty,
            countyKey,
            boundarySource: bridgeAudit.runtimeSources.boundarySource,
            roadSource: bridgeAudit.runtimeSources.roadSource,
            crossingSourceObservedButNotActivated: bridgeAudit.runtimeSources.crossingSource || null,
            generatedAt: new Date().toISOString()
        }, true, telemetryBefore);
    }

    // The legacy function name is retained for instrumentation compatibility.
    // LP244.11 limits it to candidate observation and forbids source replacement.
    function applyBoundaryRoadOverrides(runtimeSources, options) {
        const recordRead = !options || options.recordRead !== false;
        if (recordRead) state.operationCounts.applyBoundaryRoadOverrides += 1;
        const output = clone(runtimeSources || {});

        const runtimeCounty = getRuntimeCountyName(output);
        const countyKey = normalizeCountyKey(runtimeCounty);
        const countyAliasKey = countyKey.replace(/-tx$/, "");
        const packageSources = state.packageSourcesByCountyKey[countyKey] || state.packageSourcesByCountyKey[countyAliasKey];

        if (!packageSources) {
            if (recordRead) state.lastEffectiveGetterAuthority = sourceAuthority(output);
            return output;
        }

        if (recordRead) state.operationCounts.bridgeRead += 1;

        if (recordRead) state.lastEffectiveGetterAuthority = sourceAuthority(output);

        return output;
    }

    function installWrapper() {
        state.operationCounts.installWrapper += 1;
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
            state.operationCounts.effectiveGetterRead += 1;
            const runtimeSources = state.originalGetter.apply(this, arguments);
            return applyBoundaryRoadOverrides(runtimeSources);
        };

        state.installed = true;

        return {
            installed: true,
            reason: "package_candidate_observation_wrapper_installed"
        };
    }

    async function activate(county) {
        const requestedCounty = normalizeCountyName(county || "Liberty");
        const installResult = installWrapper();
        state.activationCounty = requestedCounty;
        if (typeof state.originalGetter === "function") state.preWarmAuthority = sourceAuthority(state.originalGetter());
        const warmupResult = await warmPackageSources(requestedCounty);
        const originalRuntimeSources = typeof state.originalGetter === "function" ? state.originalGetter() : null;
        state.postWarmAuthority = sourceAuthority(applyBoundaryRoadOverrides(originalRuntimeSources, { recordRead: false }));
        state.changedFields = changedAuthorityFields(state.preWarmAuthority, state.postWarmAuthority);
        state.activationRevision += 1;
        state.activated = Boolean(installResult.installed && warmupResult.warmed);

        return {
            activationVersion: ACTIVATION_VERSION,
            generatedAt: new Date().toISOString(),
            installResult,
            warmupResult,
            activationScope: {
                boundarySource: false,
                roadSource: false,
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
                    ? "PASS_PACKAGE_CANDIDATES_WARMED_STABLE_AUTHORITY"
                    : "BLOCKED_PACKAGE_CANDIDATE_WARMUP_NOT_READY_STABLE_AUTHORITY_PRESERVED"
        };
    }

    function stateSnapshot() {
        return Object.freeze({
            installed: state.installed,
            activated: state.activated,
            activationCounty: state.activationCounty,
            warmupStarted: state.warmupStarted,
            warmupCompleted: state.warmupCompleted,
            warmupSucceeded: state.warmupSucceeded,
            automaticWarmupEnabled: state.automaticWarmupEnabled,
            automaticWarmupScheduled: state.automaticWarmupScheduled,
            automaticWarmupExecuted: state.automaticWarmupExecuted,
            automaticWarmupCount: state.automaticWarmupCount,
            explicitWarmupCount: state.explicitWarmupCount,
            warmupState: state.warmupState,
            activationRevision: state.activationRevision,
            preWarmAuthority: clone(state.preWarmAuthority),
            postWarmAuthority: clone(state.postWarmAuthority),
            changedFields: Object.freeze(state.changedFields.slice()),
            packageSourcesByCountyKey: clone(state.packageSourcesByCountyKey),
            lastEffectiveGetterAuthority: clone(state.lastEffectiveGetterAuthority),
            candidateReadCounts: Object.freeze({ ...state.candidateReadCounts }),
            operationCounts: Object.freeze({ ...state.operationCounts })
        });
    }

    function runtimeSourceAuthorityAudit() {
        const activeCountyId = typeof window.gridlyGetActiveCountyId === "function" ? window.gridlyGetActiveCountyId() : null;
        const registry = window.GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY || {};
        const registrySources = registry[activeCountyId] || null;
        const registryAuthority = sourceAuthority(registrySources);
        const countyKey = normalizeCountyKey(activeCountyId || "");
        const countyAliasKey = countyKey.replace(/-tx$/, "");
        const packageSources = state.packageSourcesByCountyKey[countyKey] || state.packageSourcesByCountyKey[countyAliasKey] || null;
        const bridgeAuthority = sourceAuthority(packageSources);
        const effectiveGetterAuthority = sourceAuthority(applyBoundaryRoadOverrides(registrySources, { recordRead: false }));
        const stableAuthorityPass = Boolean(
            registryAuthority &&
            effectiveGetterAuthority &&
            changedAuthorityFields(registryAuthority, effectiveGetterAuthority).length === 0
        );
        const packageAuthorityApplied = isPackageAuthorityApplied(registryAuthority, bridgeAuthority, effectiveGetterAuthority);
        const pathComparison = Object.freeze({
            boundarySamePath: Boolean(registryAuthority && bridgeAuthority && registryAuthority.boundaryPath === bridgeAuthority.boundaryPath),
            roadsSamePath: Boolean(registryAuthority && bridgeAuthority && registryAuthority.roadsPath === bridgeAuthority.roadsPath),
            crossingsSamePath: Boolean(registryAuthority && bridgeAuthority && registryAuthority.crossingsPath === bridgeAuthority.crossingsPath)
        });
        const transition = Object.freeze({
            preWarmAuthority: clone(state.preWarmAuthority),
            postWarmAuthority: clone(state.postWarmAuthority),
            authorityChangedDuringStartup: state.changedFields.length > 0,
            changedFields: Object.freeze(state.changedFields.slice())
        });
        const bridgeTelemetry = typeof window.gridlyRuntimeSourceRegistryBridge?.telemetrySnapshot === "function"
            ? window.gridlyRuntimeSourceRegistryBridge.telemetrySnapshot() : {};
        const runtimeReads = Object.freeze({
            registryReadCount: Number(bridgeTelemetry.registryReadCount || 0),
            bridgeReadCount: state.operationCounts.bridgeRead,
            effectiveGetterReadCount: state.operationCounts.effectiveGetterRead,
            packageManifestReadCount: Number(bridgeTelemetry.packageManifestReadCount || 0),
            runtimeRegistryFetchCount: Number(bridgeTelemetry.runtimeRegistryFetchCount || 0),
            noStoreFetchCount: Number(bridgeTelemetry.noStoreFetchCount || 0)
        });
        const currentPaths = effectiveGetterAuthority || registryAuthority;
        const consumerObservations = Object.freeze([
            Object.freeze({ consumer: "app startup source constants", apiUsed: "effective_getter_pre_bridge", authorityPathUsed: clone(state.preWarmAuthority), authoritySource: "registry", authorityChangedAcrossWarmup: transition.authorityChangedDuringStartup }),
            Object.freeze({ consumer: "loadGridlyActiveCountyBoundaryIdentity", apiUsed: "gridlyGetActiveCountyRuntimeSources", authorityPathUsed: clone(currentPaths), authoritySource: "canonical_source_family", authorityChangedAcrossWarmup: transition.authorityChangedDuringStartup }),
            Object.freeze({ consumer: "gridlyCrossingProvider.resolveRuntimeCrossingSource", apiUsed: "window.gridlyGetActiveCountyRuntimeSources", authorityPathUsed: clone(currentPaths), authoritySource: "canonical_source_family", authorityChangedAcrossWarmup: transition.authorityChangedDuringStartup }),
            Object.freeze({ consumer: "gridlyBuildRegionalRuntimeAssetOwnershipAudit", apiUsed: "GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY", authorityPathUsed: clone(registryAuthority), authoritySource: "registry", authorityChangedAcrossWarmup: false })
        ]);
        const overallAuthorityConsistent = stableAuthorityPass;
        const canonicalBoundaryMetadataSourceSelected = Boolean(
            activeCountyId === "liberty-tx" &&
            effectiveGetterAuthority?.boundaryPath === "assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson"
        );
        return Object.freeze({
            available: Boolean(registryAuthority),
            activeCountyId,
            automaticWarmupEnabled: state.automaticWarmupEnabled,
            automaticWarmupScheduled: state.automaticWarmupScheduled,
            automaticWarmupExecuted: state.automaticWarmupExecuted,
            automaticWarmupCount: state.automaticWarmupCount,
            explicitWarmupCount: state.explicitWarmupCount,
            warmupState: state.warmupState,
            registryReadCount: state.candidateReadCounts.registryReadCount,
            manifestReadCount: state.candidateReadCounts.manifestReadCount,
            noStoreFetchCount: state.candidateReadCounts.noStoreFetchCount,
            bridge: Object.freeze({ installed: state.installed, activated: state.activated, activationCounty: state.activationCounty, warmupStarted: state.warmupStarted, warmupCompleted: state.warmupCompleted, warmupSucceeded: state.warmupSucceeded, warmupState: state.warmupState, activationRevision: state.activationRevision }),
            registryAuthority,
            bridgeAuthority,
            effectiveGetterAuthority,
            packageCandidateAvailable: Boolean(packageSources),
            packageAuthorityApplied,
            stableAuthorityPass,
            canonicalBoundaryMetadataSourceSelected,
            canonicalBoundaryMetadataContract: Object.freeze({ countyId: "liberty-tx", requiredProperties: Object.freeze(["GEOID", "NAMELSAD", "boundaryCredibilityMode", "sourceLibraryPath"]), payloadInspectionPerformed: false }),
            pathComparison,
            consumerObservations,
            startupTransition: transition,
            runtimeReads,
            duplicateRuntimeWork: Object.freeze([
                Object.freeze({ operation: "buildRuntimeSourcesFromPackages", count: Number(bridgeTelemetry.buildRuntimeSourcesFromPackagesCount || 0), reason: "package candidate discovery", duplicationAppearsNecessary: "UNKNOWN_PENDING_FOLLOW_UP", confidence: "HIGH" }),
                Object.freeze({ operation: "runtime registry no-store fetch", count: runtimeReads.runtimeRegistryFetchCount, reason: "Community and Crossing manifest lookup each reload the registry", duplicationAppearsNecessary: false, confidence: "HIGH" }),
                Object.freeze({ operation: "package manifest no-store fetch", count: runtimeReads.packageManifestReadCount, reason: "Community and Crossing authority require separate manifests", duplicationAppearsNecessary: true, confidence: "HIGH" }),
                Object.freeze({ operation: "applyBoundaryRoadOverrides", count: state.operationCounts.applyBoundaryRoadOverrides, reason: "compatibility wrapper observes candidates without changing source authority", duplicationAppearsNecessary: true, confidence: "HIGH" })
            ]),
            assetEquivalence: Object.freeze({ runtimeCheckPerformed: false, reason: "heavy local asset comparison is build-time test authority" }),
            overallAuthorityConsistent,
            overallPass: Boolean(registryAuthority && stableAuthorityPass && !packageAuthorityApplied)
        });
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
        const originalAuthority = sourceAuthority(originalRuntimeSources);
        const runtimeAuthority = sourceAuthority(runtimeSources);
        const packageAuthority = sourceAuthority(packageSources);

        const stableAuthority = Boolean(
            originalAuthority &&
            runtimeAuthority &&
            changedAuthorityFields(originalAuthority, runtimeAuthority).length === 0
        );
        const packageAuthorityApplied = isPackageAuthorityApplied(originalAuthority, packageAuthority, runtimeAuthority);
        const boundarySourceFromPackage = Boolean(
            originalAuthority &&
            packageAuthority &&
            runtimeAuthority &&
            packageAuthority.boundaryPath !== originalAuthority.boundaryPath &&
            runtimeAuthority.boundaryPath === packageAuthority.boundaryPath
        );
        const roadSourceFromPackage = Boolean(
            originalAuthority &&
            packageAuthority &&
            runtimeAuthority &&
            packageAuthority.roadsPath !== originalAuthority.roadsPath &&
            runtimeAuthority.roadsPath === packageAuthority.roadsPath
        );

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
                boundarySource: false,
                roadSource: false,
                crossingSource: false,
                crossingOverridesSource: false
            },

            packageSources,
            runtimeSources,
            originalRuntimeSources,

            validation: {
                packageCandidateAvailable: Boolean(packageSources),
                packageAuthorityApplied,
                boundarySourceFromPackage,
                roadSourceFromPackage,
                boundarySourceCanonical: Boolean(originalAuthority && runtimeAuthority && originalAuthority.boundaryPath === runtimeAuthority.boundaryPath),
                roadSourceCanonical: Boolean(originalAuthority && runtimeAuthority && originalAuthority.roadsPath === runtimeAuthority.roadsPath),
                crossingSourcePreserved: crossingPreserved,
                boundaryRoadActive: false,
                stableAuthority,
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
                stableAuthority && !packageAuthorityApplied && crossingPreserved
                    ? "PASS_PACKAGE_CANDIDATES_AVAILABLE_STABLE_AUTHORITY_CROSSINGS_PRESERVED"
                    : "BLOCKED_STABLE_RUNTIME_SOURCE_AUTHORITY_VALIDATION_FAILED"
        };
    }

    window.gridlyRuntimeSourceBridgeActivation = {
        version: ACTIVATION_VERSION,
        activate,
        audit,
        warmPackageSources,
        stateSnapshot
    };

    window.gridlyRuntimeSourceBridgeActivationAudit = audit;
    window.gridlyRuntimeSourceAuthorityAudit = runtimeSourceAuthorityAudit;

    if (typeof window.gridlyGetActiveCountyRuntimeSources === "function") {
        state.preWarmAuthority = sourceAuthority(window.gridlyGetActiveCountyRuntimeSources());
    }

})();
