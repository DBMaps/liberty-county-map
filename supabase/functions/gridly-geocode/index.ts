import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIG = Object.freeze({
  provider: Deno.env.get("GRIDLY_GEOCODE_PROVIDER") || "nominatim",
  baseUrl: Deno.env.get("GRIDLY_GEOCODE_PROVIDER_URL") || "https://nominatim.openstreetmap.org/search",
  namespace: Deno.env.get("GRIDLY_GEOCODE_CACHE_NAMESPACE") || "nominatim-public-v1",
  timeoutMs: 8000, intervalMs: 1000, maxAttempts: 3, maxBodyBytes: 8192,
  attribution: "© OpenStreetMap contributors",
  authoritativeRuralProvider: Deno.env.get("GRIDLY_AUTHORITATIVE_RURAL_PROVIDER") || "disabled",
  authoritativeRuralUrl: Deno.env.get("GRIDLY_AUTHORITATIVE_RURAL_URL") || "https://maps.googleapis.com/maps/api/geocode/json",
  authoritativeRuralKey: Deno.env.get("GRIDLY_AUTHORITATIVE_RURAL_API_KEY") || "",
  authoritativeRuralTimeoutMs: Math.min(10000, Math.max(1000, Number(Deno.env.get("GRIDLY_AUTHORITATIVE_RURAL_TIMEOUT_MS")) || 6500)),
  ruralFallbackEnabled: Deno.env.get("GRIDLY_RURAL_FALLBACK_ENABLED") === "true",
  ruralFallbackUrl: Deno.env.get("GRIDLY_RURAL_FALLBACK_URL") || "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress",
  ruralFallbackBenchmark: Deno.env.get("GRIDLY_RURAL_FALLBACK_BENCHMARK") || "Public_AR_Current",
  ruralFallbackVintage: Deno.env.get("GRIDLY_RURAL_FALLBACK_VINTAGE") || "Current_Current",
  ruralFallbackTimeoutMs: Math.min(10000, Math.max(1000, Number(Deno.env.get("GRIDLY_RURAL_FALLBACK_TIMEOUT_MS")) || 6000))
});
const origins = new Set((Deno.env.get("GRIDLY_GEOCODE_ALLOWED_ORIGINS") || "https://gridly.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500,http://127.0.0.1:5500").split(",").map((x) => x.trim()));
const inflight = new Map<string, Promise<Response>>();
const allowedTop = new Set(["intent", "query", "structuredAddress", "context", "limit", "requestId", "requestMode"]);
const allowedAddress = new Set(["street", "city", "county", "state", "postalCode", "country"]);
const allowedContext = new Set(["communityId", "countyId", "countyFips", "postalCode", "viewbox"]);
const control = /[\u0000-\u001f\u007f]/;
const supportedTexasCounties = new Set(["liberty", "montgomery", "san jacinto", "chambers", "jefferson", "hardin", "polk", "walker", "orange", "jasper", "newton", "tyler", "galveston", "brazoria", "fort bend", "waller", "austin", "washington", "brazos", "grimes", "wharton", "colorado", "fayette", "lavaca", "jackson", "matagorda", "calhoun", "harris"]);
// LP102's original eligibility subset remains included in the expanded regional modes.
const lp102ModeCompatible = (body: any) => ["explicit_search", "lp102_certification"].includes(body.requestMode);
const lp103ApprovedPrecision = ["interpolated_address", "verified_address_point", "verified_entrance"];
const approvedRuralPrecision = new Set([...lp103ApprovedPrecision, "address_point", "rooftop", "parcel_centroid"]);

function cors(origin: string) { return { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" }; }
function failure(status: string, requestId = "", retryAfterSeconds: number | null = null, http = 400, origin = "") {
  return new Response(JSON.stringify({ ok: false, status, providerBoundary: "gridly", retryAfterSeconds, requestId, results: [] }), { status: http, headers: cors(origin) });
}
function fieldsAllowed(value: unknown, allowed: Set<string>) { return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).every((key) => allowed.has(key)); }
function textValid(value: unknown, max = 200) { return typeof value === "string" && value.length <= max && !control.test(value); }
function validate(body: any): string | null {
  if (!fieldsAllowed(body, allowedTop)) return "unknown_field";
  if (!["address", "business_place"].includes(body.intent)) return "intent";
  if (body.requestMode !== undefined && !["explicit_search", "lp102_certification", "lp103_certification", "lp104_certification"].includes(body.requestMode)) return "request_mode";
  if (!textValid(body.query) || body.query.trim().length < 3) return "query";
  if (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 15) return "limit";
  if (body.requestId !== undefined && (!textValid(body.requestId, 80) || !/^[A-Za-z0-9._:-]+$/.test(body.requestId))) return "request_id";
  if (body.structuredAddress !== undefined && (!fieldsAllowed(body.structuredAddress, allowedAddress) || Object.values(body.structuredAddress).some((v) => !textValid(v, 200)))) return "structured_address";
  if (body.context !== undefined && !fieldsAllowed(body.context, allowedContext)) return "context";
  const box = body.context?.viewbox;
  if (box !== undefined && (!Array.isArray(box) || box.length !== 4 || box.some((n: unknown, i: number) => !Number.isFinite(n) || Math.abs(n as number) > (i % 2 ? 90 : 180)))) return "viewbox";
  return null;
}
async function hash(value: unknown) { const bytes = new TextEncoder().encode(JSON.stringify(value)); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function normalize(body: any) {
  const clean = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  return { namespace: CONFIG.namespace, ruralFallbackEnabled: CONFIG.ruralFallbackEnabled,
    diagnosticContractVersion: body.requestMode === "lp102_certification" ? "lp102-rejection-v2" : "consumer",
    requestMode: body.requestMode || "", intent: body.intent, query: clean(body.query), structuredAddress: Object.fromEntries(Object.entries(body.structuredAddress || {}).map(([k, v]) => [k, clean(v)])), context: body.context || {}, limit: body.limit };
}
function canonicalize(row: any) { const a = row.address || {}; return { providerResultId: String(row.place_id || ""), name: row.name || String(row.display_name || "").split(",")[0], displayName: row.display_name || "", formattedAddress: row.display_name || "", latitude: Number(row.lat), longitude: Number(row.lon), category: row.category || "", type: a.house_number ? "house" : (row.type || ""), resultType: a.house_number ? "address" : "road", precision: a.house_number ? "address_point" : "road", confidenceBasis: a.house_number ? "provider_address_point" : "provider_road_geometry", sourceClassification: "primary_geocoder", routePreviewEligible: Boolean(a.house_number), address: { houseNumber: a.house_number || "", road: a.road || "", community: a.village || a.hamlet || "", city: a.city || a.town || "", mailingCity: "", county: a.county || "", state: a.state || "", postalCode: a.postcode || "", country: a.country || "" }, providerIdentity: { osmType: row.osm_type || "", osmId: String(row.osm_id || "") } }; }

function ruralFallbackEligible(body: any) {
  if (!CONFIG.ruralFallbackEnabled) return false;
  return ruralAddressEligible(body);
}
function ruralAddressEligible(body: any) {
  if (body.intent !== "address"
    || !(lp102ModeCompatible(body) || ["lp103_certification", "lp104_certification"].includes(body.requestMode))) return false;
  const street = String(body.structuredAddress?.street || body.query || "").trim();
  const hasHouse = /^\s*\d{1,6}[A-Za-z]?\b/.test(street);
  const hasRoad = /\b(?:county\s+(?:road|rd)|co\.?\s*rd|cr\s*\d|fm\s*\d|farm(?:-to-|\s+to\s+)market|state\s+highway|sh\s*\d|tx\s*[- ]?\d|us\s+(?:highway\s+)?\d|road|rd\.?|highway|hwy\.?)\b/i.test(street);
  const geography = body.structuredAddress || {};
  const hasGeography = Boolean(geography.city || geography.county || geography.state || geography.postalCode || /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/i.test(body.query));
  return hasHouse && hasRoad && hasGeography;
}

function censusRoad(a: any) {
  return [a.preQualifier, a.preDirection, a.preType, a.streetName, a.suffixType, a.suffixDirection, a.suffixQualifier].filter(Boolean).join(" ");
}
function normalizeHouseNumber(value: unknown) {
  const match = String(value || "").trim().match(/^(\d{1,9})([A-Za-z]?)$/);
  if (!match) return "";
  return `${String(Number(match[1]))}${match[2].toLowerCase()}`;
}
function normalizeRoadIdentity(value: unknown) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, "cr $1")
    .replace(/\b(?:farm to market road|farm to market|farm road|fm)\s*(\d+[a-z]?)\b/g, "fm $1")
    .replace(/\b(?:state highway|sh|tx)\s*(\d+[a-z]?)\b/g, "sh $1")
    .replace(/\b(?:us highway|us)\s*(\d+[a-z]?)\b/g, "us $1");
  return normalized.replace(/^\d{1,9}[a-z]?\s+/, "").trim();
}
function normalizedRegistryLookup(body: any) {
  const requested = requestedAddressEvidence(body);
  return [normalizeHouseNumber(requested.houseNumber), normalizeRoadIdentity(requested.road),
    normalizeGeography(requested.state), String(requested.postalCode || "").slice(0, 5)].join("|");
}
function requestedAddressEvidence(body: any) {
  const street = String(body.structuredAddress?.street || body.query || "").trim();
  const query = String(body.query || "");
  const queryLocality = String(query.split(",")[1] || "").trim();
  return {
    houseNumber: street.match(/^\s*(\d{1,9}[A-Za-z]?)\b/)?.[1] || "",
    road: street.replace(/^\s*\d{1,9}[A-Za-z]?\s+/, "").split(",")[0].trim(),
    city: String(body.structuredAddress?.city || (/\bcounty\b/i.test(queryLocality) ? "" : queryLocality)).trim(),
    state: String(body.structuredAddress?.state || query.match(/,\s*(Texas|TX)\s+\d{5}(?:-\d{4})?\s*$/i)?.[1] || "").trim(),
    postalCode: String(body.structuredAddress?.postalCode || query.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] || "").trim(),
    county: String(body.structuredAddress?.county || (/\bcounty\b/i.test(queryLocality) ? queryLocality : "")).trim()
  };
}
function normalizeGeography(value: unknown) {
  const normalized = String(value || "").toLowerCase().replace(/\bcounty\b/g, "").replace(/[^a-z0-9]/g, "");
  return ({ texas: "tx", tx: "tx" } as Record<string, string>)[normalized] || normalized;
}
function coordinateInSupportedTexasRegion(latitude: unknown, longitude: unknown) {
  const lat = Number(latitude); const lon = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= 25.7 && lat <= 33.1 && lon >= -106.7 && lon <= -93.4;
}
function evaluateRuralCandidate(body: any, candidate: any) {
  const requested = requestedAddressEvidence(body); const returned = candidate.address || {};
  const normalizedRequestedHouseNumber = normalizeHouseNumber(requested.houseNumber);
  const normalizedReturnedHouseNumber = normalizeHouseNumber(returned.houseNumber);
  const requestedRoadIdentity = normalizeRoadIdentity(requested.road);
  const returnedRoadIdentity = normalizeRoadIdentity(returned.road);
  const houseNumberAgreement = Boolean(normalizedRequestedHouseNumber && normalizedReturnedHouseNumber === normalizedRequestedHouseNumber);
  const roadIdentityAgreement = Boolean(requestedRoadIdentity && returnedRoadIdentity === requestedRoadIdentity);
  const conflicts: string[] = [];
  if (normalizedRequestedHouseNumber && !normalizedReturnedHouseNumber) conflicts.push("missing_house_number_for_numbered_address");
  else if (normalizedRequestedHouseNumber && !houseNumberAgreement) conflicts.push("house_number_mismatch");
  if (!roadIdentityAgreement) conflicts.push("roadway_identity_conflict");
  if (requested.city && returned.city && normalizeGeography(requested.city) !== normalizeGeography(returned.city)) conflicts.push("locality_conflict");
  if (requested.postalCode && returned.postalCode && requested.postalCode.slice(0, 5) !== String(returned.postalCode).slice(0, 5)) conflicts.push("zip_conflict");
  if (requested.county && returned.county && normalizeGeography(requested.county) !== normalizeGeography(returned.county)) conflicts.push("county_conflict");
  if (requested.state && returned.state && normalizeGeography(requested.state) !== normalizeGeography(returned.state)) conflicts.push("state_conflict");
  if (!Number.isFinite(candidate.latitude) || !Number.isFinite(candidate.longitude) || Math.abs(candidate.latitude) > 90 || Math.abs(candidate.longitude) > 180) conflicts.push("malformed_or_missing_coordinates");
  else if (!coordinateInSupportedTexasRegion(candidate.latitude, candidate.longitude)) conflicts.push("outside_supported_region");
  const returnedCounty = normalizeGeography(returned.county);
  if (!returnedCounty || !supportedTexasCounties.has(returnedCounty)) conflicts.push("unsupported_or_missing_county");
  if (normalizedRequestedHouseNumber && (candidate.resultType !== "address" || candidate.type !== "house")) conflicts.push("road_only_result_promoted_as_house");
  if (!approvedRuralPrecision.has(candidate.precision)) conflicts.push("unsupported_precision_claim");
  const rejectionRule = conflicts[0] || "none"; const accepted = conflicts.length === 0;
  return { requestedHouseNumber: requested.houseNumber, returnedHouseNumber: returned.houseNumber || "", normalizedRequestedHouseNumber,
    normalizedReturnedHouseNumber, houseNumberAgreement, requestedRoadIdentity, returnedRoadIdentity, roadIdentityAgreement,
    hardBlockingConflicts: conflicts, accepted, rejectionRule, rejectionStage: accepted ? "none" : "fallback_acceptance_gate",
    rejectionPhase: accepted ? "none" : "pre_relevance", comparedValues: { requested, returned: { houseNumber: returned.houseNumber || "", road: returned.road || "", state: returned.state || "", postalCode: returned.postalCode || "", county: returned.county || "" } },
    exactnessReasons: conflicts, fallbackCandidateDisposition: accepted ? "accepted_interpolated_address" : `rejected_${rejectionRule}`,
    finalRenderInput: accepted, finalVisibleOutcome: accepted ? "eligible_for_relevance_gate" : "confirmed_no_result" };
}

function googleAddressComponent(row: any, type: string, short = false) {
  const component = (Array.isArray(row?.address_components) ? row.address_components : []).find((entry: any) => Array.isArray(entry.types) && entry.types.includes(type));
  return String(component?.[short ? "short_name" : "long_name"] || "");
}
function canonicalizeGoogleRural(row: any) {
  const locationType = String(row?.geometry?.location_type || "").toUpperCase();
  const houseNumber = googleAddressComponent(row, "street_number"); const road = googleAddressComponent(row, "route");
  const precision = locationType === "ROOFTOP" ? "rooftop" : "unsupported";
  return { providerResultId: String(row.place_id || ""), name: [houseNumber, road].filter(Boolean).join(" "),
    displayName: String(row.formatted_address || ""), formattedAddress: String(row.formatted_address || ""),
    latitude: Number(row?.geometry?.location?.lat), longitude: Number(row?.geometry?.location?.lng), category: "", type: "house", resultType: "address",
    precision, confidenceBasis: `commercial_${locationType.toLowerCase() || "unknown"}`, sourceClassification: "authoritative_rural_geocoder",
    routePreviewEligible: false, address: { houseNumber, road, community: googleAddressComponent(row, "sublocality"),
      city: googleAddressComponent(row, "locality") || googleAddressComponent(row, "postal_town"), mailingCity: "",
      county: googleAddressComponent(row, "administrative_area_level_2"), state: googleAddressComponent(row, "administrative_area_level_1", true),
      postalCode: googleAddressComponent(row, "postal_code"), country: googleAddressComponent(row, "country") },
    providerIdentity: { provider: "google", placeId: String(row.place_id || ""), locationType } };
}
async function sha256Text(value: string) { const bytes = new TextEncoder().encode(value); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function resolveTexasAddressIndex(body: any, db: any) {
  if (!ruralAddressEligible(body)) return { outcome: "ineligible", results: [] };
  const requested = requestedAddressEvidence(body); const countyFips = String(body.context?.countyFips || "");
  if (!/^48\d{3}$/.test(countyFips)) return { outcome: "county_required", results: [] };
  const key = [normalizeHouseNumber(requested.houseNumber), normalizeRoadIdentity(requested.road), String(requested.postalCode || "").slice(0, 5), countyFips, "tx"].join("|");
  const { data, error } = await db.rpc("gridly_lookup_texas_address", { p_lookup_hash: await sha256Text(key), p_county_fips: countyFips });
  if (error) return { outcome: "temporary_failure", results: [] };
  const candidates = (data || []).map((row: any) => ({ providerResultId: row.id, name: `${row.house_number} ${row.canonical_road_identity}`, displayName: "", formattedAddress: "", latitude: Number(row.latitude), longitude: Number(row.longitude), category: "", type: "house", resultType: "address", precision: row.precision, confidenceBasis: "gridly_owned_address_point", sourceClassification: "gridly_texas_address_foundation", routePreviewEligible: true, address: { houseNumber: row.house_number, road: row.canonical_road_identity, community: "", city: row.locality, mailingCity: row.locality, county: row.county_id, state: "TX", postalCode: row.postal_code, country: "United States" }, providerIdentity: { sourceId: row.source_id, buildVersion: row.build_version } }));
  const accepted = candidates.filter((candidate: any) => evaluateRuralCandidate(body, candidate).accepted);
  return { outcome: accepted.length ? "relevant_result" : "confirmed_no_result", results: accepted };
}

async function resolveAuthoritativeRuralProvider(body: any) {
  if (!ruralAddressEligible(body)) return { outcome: "ineligible", results: [], candidateDiagnostics: [] };
  if (CONFIG.authoritativeRuralProvider !== "google" || !CONFIG.authoritativeRuralKey) return { outcome: "not_configured", results: [], candidateDiagnostics: [] };
  const params = new URLSearchParams({ address: String(body.query), key: CONFIG.authoritativeRuralKey, region: "us", components: "administrative_area:TX|country:US" });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.authoritativeRuralTimeoutMs);
  try {
    const response = await fetch(`${CONFIG.authoritativeRuralUrl}?${params}`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (response.status === 429) return { outcome: "rate_limited", results: [], candidateDiagnostics: [] };
    if (!response.ok) return { outcome: "temporary_failure", results: [], candidateDiagnostics: [] };
    const json = await response.json();
    if (!["OK", "ZERO_RESULTS"].includes(String(json?.status || ""))) return { outcome: "temporary_failure", results: [], candidateDiagnostics: [] };
    const evaluated = (Array.isArray(json?.results) ? json.results : []).map(canonicalizeGoogleRural)
      .map((candidate: any) => ({ candidate, diagnostic: evaluateRuralCandidate(body, candidate) }));
    const accepted = evaluated.filter((entry: any) => entry.diagnostic.accepted)
      .map((entry: any) => ({ ...entry.candidate, routePreviewEligible: true }));
    return { outcome: accepted.length ? "relevant_result" : "confirmed_no_result", results: accepted,
      candidateDiagnostics: evaluated.filter((entry: any) => !entry.diagnostic.accepted).map((entry: any) => privacySafeRejectionDiagnostic(body, entry.candidate, entry.diagnostic)) };
  } catch (error) { return { outcome: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "temporary_failure", results: [], candidateDiagnostics: [] }; }
  finally { clearTimeout(timer); }
}

async function resolveGovernedRuralRegistry(body: any, db: any) {
  if (body.intent !== "address" || !["explicit_search", "lp102_certification", "lp103_certification", "lp104_certification"].includes(body.requestMode)) {
    return { outcome: "ineligible", results: [] };
  }
  const lookupHash = await hash(normalizedRegistryLookup(body));
  const { data, error } = await db.from("gridly_verified_rural_addresses")
    .select("id,house_number,canonical_road_identity,locality,county_id,state,postal_code,latitude,longitude,coordinate_source,verification_method,verification_status,source_authority,aliases,precision")
    .eq("lookup_hash", lookupHash).eq("consumer_eligible", true).eq("verification_status", "verified").maybeSingle();
  if (error) return { outcome: "temporary_failure", results: [] };
  if (!data) return { outcome: "confirmed_no_result", results: [] };
  const candidate = { providerResultId: String(data.id), name: `${data.house_number} ${data.canonical_road_identity}`,
    displayName: `${data.house_number} ${data.canonical_road_identity}, ${data.locality}, ${data.state} ${data.postal_code}`,
    formattedAddress: `${data.house_number} ${data.canonical_road_identity}, ${data.locality}, ${data.state} ${data.postal_code}`,
    latitude: Number(data.latitude), longitude: Number(data.longitude), category: "", type: "house", resultType: "address",
    precision: data.precision, confidenceBasis: data.verification_method, sourceClassification: "governed_rural_registry",
    routePreviewEligible: false, address: { houseNumber: data.house_number, road: data.canonical_road_identity,
      community: "", city: data.locality, mailingCity: data.locality, county: data.county_id, state: data.state,
      postalCode: data.postal_code, country: "United States" },
    providerIdentity: { registryRecordId: String(data.id), sourceAuthority: data.source_authority,
      coordinateSource: data.coordinate_source, verificationStatus: data.verification_status } };
  const diagnostic = evaluateRuralCandidate(body, candidate);
  return diagnostic.accepted
    ? { outcome: "relevant_result", results: [{ ...candidate, routePreviewEligible: true }] }
    : { outcome: "rejected", results: [] };
}
function privacySafeRejectionDiagnostic(body: any, candidate: any, diagnostic: any) {
  const requested = requestedAddressEvidence(body); const returned = candidate.address || {};
  const agreement = (requestedValue: unknown, returnedValue: unknown) => !requestedValue || !returnedValue
    ? null : normalizeGeography(requestedValue) === normalizeGeography(returnedValue);
  return {
    candidateDisposition: diagnostic.fallbackCandidateDisposition, rejectionRule: diagnostic.rejectionRule,
    rejectionStage: diagnostic.rejectionStage, rejectionPhase: diagnostic.rejectionPhase,
    hardBlockingConflicts: [...diagnostic.hardBlockingConflicts], requestedHouseNumber: diagnostic.requestedHouseNumber,
    returnedHouseNumber: diagnostic.returnedHouseNumber, normalizedRequestedHouseNumber: diagnostic.normalizedRequestedHouseNumber,
    normalizedReturnedHouseNumber: diagnostic.normalizedReturnedHouseNumber, houseNumberAgreement: diagnostic.houseNumberAgreement,
    requestedRoadIdentity: diagnostic.requestedRoadIdentity, returnedRoadIdentity: diagnostic.returnedRoadIdentity,
    roadIdentityAgreement: diagnostic.roadIdentityAgreement, requestedState: requested.state, returnedState: returned.state || "",
    stateAgreement: agreement(requested.state, returned.state), requestedPostalCode: requested.postalCode,
    returnedPostalCode: returned.postalCode || "", postalCodeAgreement: !requested.postalCode || !returned.postalCode
      ? null : requested.postalCode.slice(0, 5) === String(returned.postalCode).slice(0, 5),
    requestedCounty: requested.county, returnedCounty: returned.county || "", countyAgreement: agreement(requested.county, returned.county),
    resultType: candidate.resultType, precision: candidate.precision, routePreviewEligible: false
  };
}
function canonicalizeRuralMatch(match: any) {
  const a = match.addressComponents || {}; const coordinates = match.coordinates || {};
  const houseNumber = String(a.fromAddress || ""); const road = censusRoad(a);
  return { providerResultId: String(match.tigerLine?.tigerLineId || ""), name: [houseNumber, road].filter(Boolean).join(" "), displayName: match.matchedAddress || "", formattedAddress: match.matchedAddress || "", latitude: Number(coordinates.y), longitude: Number(coordinates.x), category: "", type: "house", resultType: "address", precision: "interpolated_address", confidenceBasis: "authoritative_address_range_match", sourceClassification: "government_address_range", routePreviewEligible: false, address: { houseNumber, road, community: "", city: a.city || "", mailingCity: a.city || "", county: a.county || "", state: a.state || "", postalCode: a.zip || "", country: "United States" }, providerIdentity: { matchedAddress: match.matchedAddress || "", tigerLineId: String(match.tigerLine?.tigerLineId || ""), tigerLineSide: match.tigerLine?.side || "", addressRange: { fromAddress: String(a.fromAddress || ""), toAddress: String(a.toAddress || "") } } };
}
async function resolveRuralFallback(body: any) {
  const params = new URLSearchParams({ address: body.query, benchmark: CONFIG.ruralFallbackBenchmark, vintage: CONFIG.ruralFallbackVintage, format: "json" });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.ruralFallbackTimeoutMs);
  try {
    const response = await fetch(`${CONFIG.ruralFallbackUrl}?${params}`, { headers: { Accept: "application/json" }, signal: controller.signal });
    if (response.status === 429) return { outcome: "rate_limited", results: [] };
    if (!response.ok) return { outcome: "temporary_failure", results: [] };
    const json = await response.json();
    const matches = json?.result?.addressMatches;
    const candidates = (Array.isArray(matches) ? matches : []).map(canonicalizeRuralMatch);
    const evaluated = candidates.map((candidate: any) => ({ candidate, diagnostic: evaluateRuralCandidate(body, candidate) }));
    const accepted = evaluated.filter((entry: any) => entry.diagnostic.accepted).map((entry: any) => ({ ...entry.candidate, routePreviewEligible: true }));
    const candidateDiagnostics = evaluated.filter((entry: any) => !entry.diagnostic.accepted)
      .map((entry: any) => privacySafeRejectionDiagnostic(body, entry.candidate, entry.diagnostic));
    return { outcome: accepted.length ? "relevant_result" : "confirmed_no_result", results: accepted, candidateDiagnostics };
  } catch (error) { return { outcome: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "temporary_failure", results: [] }; }
  finally { clearTimeout(timer); }
}

async function execute(body: any, key: string, requestId: string, origin: string, db: any): Promise<Response> {
  const { data: cached } = await db.from("gridly_geocode_cache").select("response,status,expires_at").eq("cache_key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (cached) return new Response(JSON.stringify({ ...cached.response, cached: true, requestId }), { headers: cors(origin) });
  const { data: slot, error: leaseError } = await db.rpc("gridly_reserve_geocode_provider_slot", { p_namespace: CONFIG.namespace, p_interval_ms: CONFIG.intervalMs });
  if (leaseError) return failure("configuration_error", requestId, null, 503, origin);
  const wait = Math.max(0, new Date(slot).getTime() - Date.now()); if (wait) await new Promise((r) => setTimeout(r, wait));
  const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", countrycodes: "us", limit: String(body.limit) });
  if (body.intent === "address" && body.structuredAddress && Object.values(body.structuredAddress).some(Boolean)) {
    const map: Record<string, string> = { street: "street", city: "city", county: "county", state: "state", postalCode: "postalcode", country: "country" };
    for (const [field, upstream] of Object.entries(map)) if (body.structuredAddress[field]) params.set(upstream, body.structuredAddress[field]);
  } else params.set("q", body.query);
  if (body.context?.viewbox) params.set("viewbox", body.context.viewbox.join(","));
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
  let upstream: Response;
  try { upstream = await fetch(`${CONFIG.baseUrl}?${params}`, { headers: { "User-Agent": Deno.env.get("GRIDLY_GEOCODE_USER_AGENT") || "Gridly/LP100 (contact required)", Accept: "application/json" }, signal: controller.signal }); }
  catch (error) { clearTimeout(timer); return failure(error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_unavailable", requestId, null, 503, origin); }
  clearTimeout(timer);
  if (upstream.status === 429) { const retry = Math.min(3600, Math.max(1, Number(upstream.headers.get("Retry-After")) || 60)); await db.rpc("gridly_cooldown_geocode_provider", { p_namespace: CONFIG.namespace, p_seconds: retry }); return failure("rate_limited", requestId, retry, 429, origin); }
  if (!upstream.ok) return failure("provider_unavailable", requestId, null, 503, origin);
  const rows = await upstream.json(); let results = (Array.isArray(rows) ? rows : []).slice(0, body.limit).map(canonicalize).filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
  if (ruralAddressEligible(body)) results = results.filter((candidate: any) => evaluateRuralCandidate(body, candidate).accepted);
  const primaryOutcome = results.length ? "relevant_result" : "confirmed_no_result";
  let texasAddressFoundationOutcome = results.length ? "not_invoked" : "ineligible";
  if (!results.length && body.intent === "address") { const foundation = await resolveTexasAddressIndex(body, db); texasAddressFoundationOutcome = foundation.outcome; results = foundation.results.slice(0, body.limit); }
  let authoritativeRuralOutcome = results.length ? "not_invoked" : "ineligible";
  let authoritativeCandidateDiagnostics: any[] = [];
  // Legacy commercial adapter is disabled by default and is not part of LP104.1 completion.
  if (!results.length && body.intent === "address") {
    const authoritative = await resolveAuthoritativeRuralProvider(body);
    authoritativeRuralOutcome = authoritative.outcome;
    authoritativeCandidateDiagnostics = authoritative.candidateDiagnostics;
    results = authoritative.results.slice(0, body.limit);
  }
  let registryOutcome = results.length ? "not_invoked" : "confirmed_no_result";
  if (!results.length && body.intent === "address") {
    const registry = await resolveGovernedRuralRegistry(body, db);
    registryOutcome = registry.outcome;
    results = registry.results.slice(0, body.limit);
  }
  const fallbackEligible = !results.length && ruralFallbackEligible(body);
  let fallbackOutcome = fallbackEligible ? "not_invoked" : "ineligible";
  let fallbackCandidateDiagnostics: any[] = [];
  if (fallbackEligible) { const fallback = await resolveRuralFallback(body); fallbackOutcome = fallback.outcome; results = fallback.results.slice(0, body.limit); fallbackCandidateDiagnostics = "candidateDiagnostics" in fallback ? fallback.candidateDiagnostics : []; }
  const diagnosticRequest = ["lp102_certification", "lp103_certification", "lp104_certification"].includes(body.requestMode);
  const legacyFallbackDiagnostics = diagnosticRequest ? { fallbackCandidateDiagnostics } : {};
  const diagnostics = { primaryProviderOutcome: primaryOutcome, fallbackEligible, fallbackInvoked: fallbackEligible, fallbackOutcome,
    texasAddressFoundationOutcome, authoritativeRuralOutcome, registryOutcome, ...legacyFallbackDiagnostics, ...(diagnosticRequest ? {
      authoritativeCandidateDiagnostics: authoritativeCandidateDiagnostics.map((entry: any) => ({ candidateDisposition: entry.candidateDisposition,
        houseNumberAgreement: entry.houseNumberAgreement, roadIdentityAgreement: entry.roadIdentityAgreement,
        countyAgreement: entry.countyAgreement, stateAgreement: entry.stateAgreement, postalCodeAgreement: entry.postalCodeAgreement,
        precision: entry.precision, routePreviewEligible: false })) } : {}),
    sourceClassification: results.length ? results[0].sourceClassification : "none" };
  const payload = results.length ? { ok: true, status: "success", providerBoundary: "gridly", cached: false, requestId, diagnostics, results } : { ok: false, status: "no_results", providerBoundary: "gridly", retryAfterSeconds: null, requestId, diagnostics, results: [] };
  await db.from("gridly_geocode_cache").upsert({ cache_key: key, provider_namespace: CONFIG.namespace, response: payload, status: payload.status, expires_at: new Date(Date.now() + (results.length ? (body.intent === "business_place" ? 86400000 : 21600000) : 60000)).toISOString() });
  // A valid canonical no-result is an application outcome, not a missing HTTP resource.
  return new Response(JSON.stringify(payload), { status: 200, headers: cors(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") || "";
  if (!origins.has(origin)) return failure("invalid_request", "", null, 403, "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return failure("invalid_request", "", null, 405, origin);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return failure("invalid_request", "", null, 415, origin);
  const declared = Number(request.headers.get("Content-Length") || 0); if (declared > CONFIG.maxBodyBytes) return failure("invalid_request", "", null, 413, origin);
  const raw = await request.text(); if (new TextEncoder().encode(raw).length > CONFIG.maxBodyBytes) return failure("invalid_request", "", null, 413, origin);
  let body; try { body = JSON.parse(raw); } catch { return failure("invalid_request", "", null, 400, origin); }
  const requestId = typeof body?.requestId === "string" ? body.requestId : crypto.randomUUID();
  if (validate(body)) return failure("invalid_request", requestId, null, 400, origin);
  const key = await hash(normalize(body));
  if (inflight.has(key)) return (await inflight.get(key)!).clone();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const task = execute(body, key, requestId, origin, db); inflight.set(key, task);
  try { return (await task).clone(); } finally { inflight.delete(key); }
});
