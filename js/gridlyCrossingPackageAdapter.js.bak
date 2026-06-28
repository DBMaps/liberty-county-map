(function () {
    "use strict";

    const ADAPTER_VERSION = "GRIDLY_CROSSING_PACKAGE_ADAPTER_V1";
    const DEFAULT_PACKAGE_SOURCE = "Crossing-Packages/liberty/liberty-crossings.geojson";

    async function fetchJson(path) {
        const response = await fetch(path, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("Fetch failed for " + path + " with status " + response.status);
        }
        return response.json();
    }

    function props(feature) {
        return feature && feature.properties && typeof feature.properties === "object"
            ? feature.properties
            : {};
    }

    function coords(feature, p) {
        const raw = feature && feature.geometry && feature.geometry.coordinates;

        if (Array.isArray(raw) && raw.length >= 2) {
            return raw;
        }

        const lon = Number(p.LONGITUD ?? p.LONGDD ?? p.longitude ?? p.lon);
        const lat = Number(p.LATITUDE ?? p.LATDD ?? p.latitude ?? p.lat);

        return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : null;
    }

    function first(p, fields) {
        for (const field of fields) {
            const value = p[field];
            if (value !== undefined && value !== null && String(value).trim() !== "") {
                return String(value).trim();
            }
        }
        return null;
    }

    function normalizeCrossing(feature, index) {
        const p = props(feature);
        const crossingNumber = first(p, ["CROSSING", "crossing", "crossing_id", "crossingId"]);
        const street = first(p, ["STREET", "HIGHWAY", "road_name", "roadName", "name"]);
        const railroad = first(p, ["RAILROAD", "OPERATINGR", "INIT", "railroad"]);
        const coordinate = coords(feature, p);

        const id = crossingNumber
            ? "FRA-" + crossingNumber
            : "FRA-LIBERTY-" + String(index + 1).padStart(3, "0");

        const name = street
            ? street + " Crossing"
            : "Rail Crossing";

        return {
            type: "Feature",
            geometry: coordinate
                ? { type: "Point", coordinates: coordinate }
                : feature.geometry || null,
            properties: Object.assign({}, p, {
                crossing_id: id,
                name,
                road_name: street || name,
                railroad: railroad || "Railroad",
                source: "FRA",
                adapterVersion: ADAPTER_VERSION,
                originalCrossingNumber: crossingNumber || null
            })
        };
    }

    async function buildAdaptedCrossingGeojson(sourcePath) {
        const packageSource = sourcePath || DEFAULT_PACKAGE_SOURCE;
        const raw = await fetchJson(packageSource);
        const features = Array.isArray(raw && raw.features) ? raw.features : [];

        const adaptedFeatures = features
            .map(normalizeCrossing)
            .filter(function (feature) {
                return feature && feature.geometry && Array.isArray(feature.geometry.coordinates);
            });

        return {
            type: "FeatureCollection",
            metadata: {
                adapterVersion: ADAPTER_VERSION,
                sourcePackage: packageSource,
                generatedAt: new Date().toISOString(),
                sourceFeatureCount: features.length,
                adaptedFeatureCount: adaptedFeatures.length
            },
            features: adaptedFeatures
        };
    }

    async function audit(sourcePath) {
        const adapted = await buildAdaptedCrossingGeojson(sourcePath);
        const features = adapted.features || [];

        const missing = {
            crossing_id: 0,
            name: 0,
            road_name: 0,
            railroad: 0,
            coordinates: 0
        };

        const samples = features.slice(0, 10).map(function (feature) {
            const p = props(feature);
            const c = feature.geometry && feature.geometry.coordinates;

            if (!p.crossing_id) missing.crossing_id++;
            if (!p.name) missing.name++;
            if (!p.road_name) missing.road_name++;
            if (!p.railroad) missing.railroad++;
            if (!Array.isArray(c)) missing.coordinates++;

            return {
                crossing_id: p.crossing_id,
                name: p.name,
                road_name: p.road_name,
                railroad: p.railroad,
                coordinates: c
            };
        });

        features.forEach(function (feature) {
            const p = props(feature);
            const c = feature.geometry && feature.geometry.coordinates;

            if (!p.crossing_id) missing.crossing_id++;
            if (!p.name) missing.name++;
            if (!p.road_name) missing.road_name++;
            if (!p.railroad) missing.railroad++;
            if (!Array.isArray(c)) missing.coordinates++;
        });

        const valid =
            adapted.metadata.sourceFeatureCount === 115 &&
            adapted.metadata.adaptedFeatureCount === 115 &&
            missing.crossing_id === 0 &&
            missing.name === 0 &&
            missing.road_name === 0 &&
            missing.railroad === 0 &&
            missing.coordinates === 0;

        return {
            auditVersion: ADAPTER_VERSION,
            generatedAt: new Date().toISOString(),
            sourcePackage: adapted.metadata.sourcePackage,
            counts: {
                sourceFeatureCount: adapted.metadata.sourceFeatureCount,
                adaptedFeatureCount: adapted.metadata.adaptedFeatureCount,
                expectedLibertyCrossings: 115
            },
            requiredRuntimeFields: {
                crossing_id: true,
                name: true,
                road_name: true,
                railroad: true,
                coordinates: true
            },
            missingRequiredFields: missing,
            samples,
            activationRecommended: valid,
            crossingSourceModified: false,
            renderingModified: false,
            alertsModified: false,
            routeWatchModified: false,
            reportingModified: false,
            supabaseModified: false,
            mobilePortraitModified: false,
            finalDetermination: valid
                ? "PASS_CROSSING_PACKAGE_ADAPTER_READY_NOT_ACTIVATED"
                : "BLOCKED_CROSSING_PACKAGE_ADAPTER_INCOMPLETE"
        };
    }

    window.gridlyCrossingPackageAdapter = {
        version: ADAPTER_VERSION,
        buildAdaptedCrossingGeojson
    };

    window.gridlyCrossingPackageAdapterAudit = audit;
})();
