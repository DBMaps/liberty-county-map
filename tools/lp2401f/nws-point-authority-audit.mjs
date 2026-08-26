import fs from "node:fs";
import vm from "node:vm";
import { areas } from "../lp240x/supported-area-identity-audit.mjs";

const appSource = fs.readFileSync("js/app.js", "utf8");
const presentations = JSON.parse(fs.readFileSync("data/generated/gridly-statewide-place-presentation-v1.json", "utf8")).places;
const countyGeometry = JSON.parse(fs.readFileSync("assets/location-resolution/gridly-authoritative-county-geometry-v1.json", "utf8")).counties;

function expression(name) {
  const declaration = appSource.indexOf(`const ${name} =`);
  const start = appSource.indexOf("=", declaration) + 1;
  let depth = 0;
  let quote = null;
  for (let index = start; index < appSource.length; index += 1) {
    const character = appSource[index];
    if (quote) {
      if (character === quote && appSource[index - 1] !== "\\") quote = null;
      continue;
    }
    if (`'\"\``.includes(character)) quote = character;
    else if ("([{ ".includes(character) && character !== " ") depth += 1;
    else if (")] }".includes(character) && character !== " ") depth -= 1;
    else if (character === ";" && depth === 0) return appSource.slice(start, index);
  }
  throw new Error(`Unable to read ${name}`);
}

const evaluate = (name) => vm.runInNewContext(expression(name));
const regionalCoordinates = new Map([
  ...evaluate("GRIDLY_LP035_HOUSTON_REGION_MODEL"),
  ...evaluate("GRIDLY_LP194_SAN_ANTONIO_REGION_MODEL")
].map((row) => [row.id, { lat: row.lat, lng: row.lng, source: row.id.startsWith("houston-") ? "LP035_REGION" : "LP194_REGION" }]));
const counties = new Map(countyGeometry.map((row) => [row.countyId, row]));

function validCoordinate(coordinate) {
  return Number.isFinite(coordinate?.lat) && Number.isFinite(coordinate?.lng)
    && coordinate.lat >= -90 && coordinate.lat <= 90
    && coordinate.lng >= -180 && coordinate.lng <= 180;
}

function coordinateFor(area) {
  if (area.placeGeoid && presentations[area.placeGeoid]) {
    const point = presentations[area.placeGeoid];
    return { lat: point.lat, lng: point.lon, source: "LP201_PLACE_PRESENTATION" };
  }
  if (Number.isFinite(area.lat) && Number.isFinite(area.lng)) return { lat: area.lat, lng: area.lng, source: "AWARENESS_DEFINITION" };
  if (regionalCoordinates.has(area.key)) return regionalCoordinates.get(area.key);
  if (area.countyWide && counties.has(area.countyId)) {
    const { bounds } = counties.get(area.countyId);
    return { lat: (bounds.south + bounds.north) / 2, lng: (bounds.west + bounds.east) / 2, source: "COUNTY_GEOMETRY_BOUNDS_CENTER" };
  }
  return null;
}

function identityClass(area) {
  if (area.fallback) return "FALLBACK";
  if (area.countyWide) return "COUNTY_WIDE";
  if (area.placeGeoid) return "CANONICAL_PLACE";
  return "GOVERNED_NON_PLACE";
}

export function classifyPointWeatherAuthority(input = {}, now = Date.now(), authorityWindowMs = 10 * 60_000) {
  const coordinateValid = validCoordinate({ lat: Number(input.lat), lng: Number(input.lng) });
  const featuresValid = Array.isArray(input.response?.features);
  const fetchedAt = Date.parse(input.alertFetchedAt || "");
  const fresh = Number.isFinite(fetchedAt) && now >= fetchedAt && now - fetchedAt <= authorityWindowMs;
  let weatherAuthorityState = "UNAVAILABLE";
  let authorityReason = "UNSUPPORTED_IDENTITY";
  if (input.supportedIdentity !== true) authorityReason = "UNSUPPORTED_IDENTITY";
  else if (!coordinateValid) authorityReason = "INVALID_GOVERNED_COORDINATE";
  else if (input.alertRequestAttempted !== true) authorityReason = "REQUEST_NOT_ATTEMPTED";
  else if (input.alertRequestSucceeded !== true) authorityReason = "REQUEST_FAILED";
  else if (!featuresValid) authorityReason = "INVALID_RESPONSE_SCHEMA";
  else if (!fresh) authorityReason = "STALE_RESPONSE";
  else if (input.response.features.length > 0) {
    weatherAuthorityState = "ACTIVE";
    authorityReason = "CURRENT_POINT_ALERTS_RETURNED";
  } else {
    weatherAuthorityState = "QUIET";
    authorityReason = "CURRENT_POINT_QUERY_RETURNED_ZERO_ALERTS";
  }
  const ids = featuresValid ? [...new Set(input.response.features.map((feature) => feature?.id || feature?.properties?.id).filter(Boolean))] : [];
  return Object.freeze({ weatherAuthorityState, authorityReason, quietProven: weatherAuthorityState === "QUIET", activeAlertCount: featuresValid ? input.response.features.length : 0, activeAlertIds: Object.freeze(ids) });
}

export function certifyCoordinates() {
  const eligible = areas.filter((area) => !area.fallback);
  const records = eligible.map((area) => ({ area, identityClass: identityClass(area), coordinate: coordinateFor(area) }));
  const available = records.filter((row) => row.coordinate);
  const valid = available.filter((row) => validCoordinate(row.coordinate));
  const coordinateGroups = Map.groupBy(valid, (row) => `${row.coordinate.lat},${row.coordinate.lng}`);
  const duplicates = [...coordinateGroups.values()].filter((rows) => rows.length > 1);
  const countClass = (name) => valid.filter((row) => row.identityClass === name).length;
  return Object.freeze({
    supportedAwarenessAreaCount: areas.length,
    homeAreaEligibleCount: eligible.length,
    governedCoordinateAvailableCount: available.length,
    governedCoordinateMissingCount: eligible.length - available.length,
    invalidCoordinateCount: available.length - valid.length,
    duplicateCoordinateValueCount: duplicates.length,
    duplicateCoordinateRecordCount: duplicates.reduce((sum, rows) => sum + rows.length, 0),
    canonicalPlaceCoordinateCount: countClass("CANONICAL_PLACE"),
    governedNonPlaceCoordinateCount: countClass("GOVERNED_NON_PLACE"),
    countyWideCoordinateCount: countClass("COUNTY_WIDE"),
    fallbackCoordinateCount: areas.filter((area) => area.fallback && validCoordinate(coordinateFor(area))).length,
    allEligiblePointQueryCompatible: valid.length === eligible.length,
    records
  });
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const certification = certifyCoordinates();
  console.log(JSON.stringify(Object.fromEntries(Object.entries(certification).filter(([key]) => key !== "records")), null, 2));
}
