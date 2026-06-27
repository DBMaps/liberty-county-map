(function () {
    "use strict";

    const AUDIT_VERSION = "GRIDLY_CROSSING_PACKAGE_VALIDATION_AUDIT_V1";

    const FILES = {
        runtime: "data/liberty-county-rail-crossings.geojson",
        package: "Crossing-Packages/liberty/liberty-crossings.geojson"
    };

    async function fetchJson(path) {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Fetch failed for " + path + " with status " + response.status);
        }
        return response.json();
    }

    function getFeatures(geojson) {
        return geojson && Array.isArray(geojson.features) ? geojson.features : [];
    }

    function getProps(feature) {
        return feature && feature.properties && typeof feature.properties === "object"
            ? feature.properties
            : {};
    }

    function getCoords(feature) {
        const coords = feature && feature.geometry && feature.geometry.coordinates;
        return Array.isArray(coords) ? coords : null;
    }

    function keysFrom(features) {
        const set = new Set();
        features.slice(0, 25).forEach(function (feature) {
            Object.keys(getProps(feature)).forEach(function (key) {
                set.add(key);
            });
        });
        return Array.from(set).sort();
    }

    function firstValue(props, fields) {
        for (const field of fields) {
            if (props[field] !== undefined && props[field] !== null && String(props[field]).trim() !== "") {
                return String(props[field]).trim();
            }
        }
        return null;
    }

    function crossingIdentity(feature) {
        const props = getProps(feature);

        return {
            id: firstValue(props, [
                "id",
                "crossingId",
                "crossing_id",
                "crossingNumber",
                "crossing_number",
                "crossing",
                "crossingInventoryNumber",
                "crossingInventoryId",
                "FRAID",
                "FRA_ID",
                "franumber",
                "franumberstring",
                "crossingNumberString"
            ]),
            name: firstValue(props, [
                "name",
                "crossingName",
                "crossing_name",
                "road",
                "roadName",
                "road_name",
                "street",
                "streetName",
                "highway",
                "displayName",
                "label"
            ]),
            railroad: firstValue(props, [
                "railroad",
                "railroadName",
                "railroad_name",
                "railroadCompany",
                "railroad_company",
                "rr",
                "RR"
            ]),
            coords: getCoords(feature)
        };
    }

    function summarize(features) {
        return features.map(crossingIdentity);
    }

    function roundedCoordKey(identity) {
        if (!identity || !Array.isArray(identity.coords) || identity.coords.length < 2) {
            return null;
        }

        const lon = Number(identity.coords[0]);
        const lat = Number(identity.coords[1]);

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            return null;
        }

        return lat.toFixed(5) + "," + lon.toFixed(5);
    }

    function idSet(summary) {
        return new Set(summary.map(function (item) { return item.id; }).filter(Boolean));
    }

    function coordSet(summary) {
        return new Set(summary.map(roundedCoordKey).filter(Boolean));
    }

    function setDiff(a, b) {
        return Array.from(a).filter(function (value) {
            return !b.has(value);
        }).slice(0, 25);
    }

    function sample(summary) {
        return summary.slice(0, 10).map(function (item) {
            return {
                id: item.id,
                name: item.name,
                railroad: item.railroad,
                coordKey: roundedCoordKey(item)
            };
        });
    }

    async function audit() {
        const runtimeGeojson = await fetchJson(FILES.runtime);
        const packageGeojson = await fetchJson(FILES.package);

        const runtimeFeatures = getFeatures(runtimeGeojson);
        const packageFeatures = getFeatures(packageGeojson);

        const runtimeSummary = summarize(runtimeFeatures);
        const packageSummary = summarize(packageFeatures);

        const runtimeIds = idSet(runtimeSummary);
        const packageIds = idSet(packageSummary);

        const runtimeCoords = coordSet(runtimeSummary);
        const packageCoords = coordSet(packageSummary);

        const result = {
            auditVersion: AUDIT_VERSION,
            generatedAt: new Date().toISOString(),

            files: FILES,

            counts: {
                runtimeCrossings: runtimeFeatures.length,
                packageCrossings: packageFeatures.length,
                countMatches: runtimeFeatures.length === packageFeatures.length
            },

            schema: {
                runtimePropertyKeys: keysFrom(runtimeFeatures),
                packagePropertyKeys: keysFrom(packageFeatures)
            },

            ids: {
                runtimeIdsDetected: runtimeIds.size,
                packageIdsDetected: packageIds.size,
                runtimeIdsMissingFromPackageSample: setDiff(runtimeIds, packageIds),
                packageIdsMissingFromRuntimeSample: setDiff(packageIds, runtimeIds)
            },

            coordinates: {
                runtimeCoordinateCount: runtimeCoords.size,
                packageCoordinateCount: packageCoords.size,
                runtimeCoordsMissingFromPackageSample: setDiff(runtimeCoords, packageCoords),
                packageCoordsMissingFromRuntimeSample: setDiff(packageCoords, runtimeCoords)
            },

            samples: {
                runtime: sample(runtimeSummary),
                package: sample(packageSummary)
            },

            activationRecommended: false,
            crossingSourceModified: false,
            renderingModified: false,
            alertsModified: false,
            routeWatchModified: false,
            reportingModified: false,
            supabaseModified: false,
            mobilePortraitModified: false
        };

        result.validation = {
            bothLoaded: runtimeFeatures.length > 0 && packageFeatures.length > 0,
            packageHasExpectedLibertyCount: packageFeatures.length === 115,
            runtimeCountMatchesPackage: result.counts.countMatches,
            hasComparableIds: runtimeIds.size > 0 && packageIds.size > 0,
            hasComparableCoordinates: runtimeCoords.size > 0 && packageCoords.size > 0
        };

        result.finalDetermination =
            result.validation.bothLoaded &&
            result.validation.packageHasExpectedLibertyCount
                ? "OBSERVE_CROSSING_PACKAGE_VALID_FOR_REVIEW_NOT_ACTIVATED"
                : "BLOCKED_CROSSING_PACKAGE_VALIDATION_FAILED";

        return result;
    }

    window.gridlyCrossingPackageValidationAudit = audit;
})();
