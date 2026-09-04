(function initializeGridlySavedAddressIntegrity(global) {
  "use strict";

  const CONTRACT_NAME = "GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT";
  const REQUEST_CONTRACT_VERSION = "gridly-geocode-v1";
  const ACQUISITION_CONTRACT_NAME = "GRIDLY_SAVED_ADDRESS_ACQUISITION_CONTRACT";
  const TEXAS_BOUNDS = Object.freeze({ south: 25.7, north: 36.6, west: -106.7, east: -93.4 });
  const clean = (value) => String(value || "").trim();
  const key = (value) => clean(value).toLowerCase().replace(/\bsaint\b/g, "st").replace(/[^a-z0-9]/g, "");

  function parseAddressQualifiers(rawAddressInput = "") {
    const normalizedAddressQuery = clean(rawAddressInput).replace(/\s+/g, " ");
    const zip = normalizedAddressQuery.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "";
    const stateMatch = normalizedAddressQuery.match(/(?:,|\s)\s*(TX|Texas)\b/i);
    const parts = normalizedAddressQuery.split(",").map(clean).filter(Boolean);
    let city = "";
    if (parts.length >= 2) {
      const possibleCity = parts[parts.length - 2];
      if (!/^(TX|Texas)(?:\s+\d{5}(?:-\d{4})?)?$/i.test(possibleCity)) city = possibleCity;
      else if (parts.length >= 3) city = parts[parts.length - 3];
    }
    return Object.freeze({
      rawAddressInput: clean(rawAddressInput), normalizedAddressQuery,
      city, state: stateMatch ? "TX" : "", zip,
      sufficientlyQualified: Boolean(city || zip)
    });
  }

  const STREET_FORMS = Object.freeze([
    ["Street", "St"], ["Avenue", "Ave"], ["Road", "Rd"], ["Drive", "Dr"],
    ["Lane", "Ln"], ["Boulevard", "Blvd"], ["Highway", "Hwy"],
    ["Farm to Market", "FM"], ["County Road", "CR"],
    ["North", "N"], ["South", "S"], ["East", "E"], ["West", "W"]
  ]);

  function replaceWholeWord(value, from, to) {
    return value.replace(new RegExp(`\\b${from.replace(/ /g, "\\s+")}\\.?\\b`, "i"), to);
  }

  /** Bounded variants alter street spelling only; locality, state, and ZIP remain byte-visible. */
  function normalizedAddressAttempts(rawAddressInput = "") {
    const qualifiers = parseAddressQualifiers(rawAddressInput);
    if (!qualifiers.sufficientlyQualified) return Object.freeze([]);
    const canonical = qualifiers.normalizedAddressQuery
      .replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ")
      .replace(/\b(\d{5})-\d{4}\b/, "$1").trim();
    const attempts = [canonical];
    for (const [long, short] of STREET_FORMS) {
      const hasLong = new RegExp(`\\b${long.replace(/ /g, "\\s+")}\\.?\\b`, "i").test(canonical);
      const hasShort = new RegExp(`\\b${short}\\.?\\b`, "i").test(canonical);
      if (hasLong || hasShort) attempts.push(replaceWholeWord(canonical, hasLong ? long : short, hasLong ? short : long));
    }
    return Object.freeze([...new Set(attempts)].slice(0, 4));
  }

  function qualifiersPreserved(original, query) {
    const source = parseAddressQualifiers(original);
    const attempt = parseAddressQualifiers(query);
    return source.sufficientlyQualified && (!source.city || key(source.city) === key(attempt.city))
      && (!source.state || attempt.state === source.state) && (!source.zip || attempt.zip === source.zip);
  }

  function candidateAddress(candidate = {}) {
    const address = candidate.address || {};
    return {
      city: clean(address.city || address.community || address.village || address.town || address.hamlet),
      county: clean(address.county), state: clean(address.state || address.stateCode),
      zip: clean(address.postalCode || address.postcode).slice(0, 5),
      country: clean(address.country), road: clean(address.road), houseNumber: clean(address.houseNumber || address.house_number)
    };
  }

  function validateCandidate(qualifiers, candidate = {}) {
    const latitude = Number(candidate.latitude ?? candidate.lat);
    const longitude = Number(candidate.longitude ?? candidate.lng ?? candidate.lon);
    const evidence = candidateAddress(candidate);
    const finiteCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    const withinTexas = finiteCoordinates && latitude >= TEXAS_BOUNDS.south && latitude <= TEXAS_BOUNDS.north
      && longitude >= TEXAS_BOUNDS.west && longitude <= TEXAS_BOUNDS.east;
    const stateKey = key(evidence.state);
    const stateEvidence = !stateKey ? (withinTexas ? "coordinate_containment" : "missing")
      : (["tx", "texas"].includes(stateKey) ? "match" : "conflict");
    const localityEvidence = !qualifiers.city ? "not_supplied" : (!evidence.city ? "missing"
      : key(qualifiers.city) === key(evidence.city) ? "match" : "conflict");
    const zipEvidence = !qualifiers.zip ? "not_supplied" : (!evidence.zip ? "missing"
      : qualifiers.zip === evidence.zip ? "match" : "conflict");
    let rejectionReason = "";
    if (!qualifiers.sufficientlyQualified) rejectionReason = "locality_required";
    else if (!finiteCoordinates) rejectionReason = "coordinates_invalid";
    else if (!withinTexas || stateEvidence === "conflict") rejectionReason = "outside_supported_texas_geography";
    else if (zipEvidence === "conflict") rejectionReason = "zip_conflict";
    else if (localityEvidence === "conflict") rejectionReason = "city_conflict";
    else if (qualifiers.city && qualifiers.zip && localityEvidence === "missing" && zipEvidence === "missing") rejectionReason = "qualifier_evidence_missing";
    const matchedEvidence = [stateEvidence, localityEvidence, zipEvidence].filter((value) => value === "match" || value === "coordinate_containment").length;
    if (!rejectionReason && matchedEvidence < 1) rejectionReason = "insufficient_geographic_evidence";
    return Object.freeze({ accepted: !rejectionReason, rejectionReason, latitude, longitude,
      qualifierMatch: !rejectionReason, localityEvidence, zipEvidence, stateEvidence,
      countyEvidence: evidence.county || "not_available", withinTexas, candidateAddress: evidence });
  }

  async function resolveAddress({ address = "", search } = {}) {
    const qualifiers = parseAddressQualifiers(address);
    const base = { rawAddressInput: qualifiers.rawAddressInput, normalizedAddressQuery: qualifiers.normalizedAddressQuery,
      geocoderQuery: qualifiers.normalizedAddressQuery, candidateCount: 0, providerCandidateCount: 0,
      candidateCountAfterNormalization: 0, selectedCandidate: null, requestAttempted: false,
      httpStatus: null, requestContractVersion: REQUEST_CONTRACT_VERSION, providerResponseReceived: false,
      qualifierMatch: false, rejectionReason: "", resolutionStatus: "failed", validationStatus: "rejected" };
    if (!qualifiers.sufficientlyQualified) return { ...base, rejectionReason: "locality_required", qualifiers };
    if (typeof search !== "function") return { ...base, rejectionReason: "geocoder_unavailable", qualifiers };
    const attempts = [];
    let selected = null; let candidates = []; let evaluated = []; let response = null;
    for (const normalizedQuery of normalizedAddressAttempts(address)) {
      if (!qualifiersPreserved(address, normalizedQuery)) continue;
      response = await search({ intent: "address", query: normalizedQuery, limit: 5, requestMode: "explicit_search" });
      candidates = response?.ok && Array.isArray(response.results) ? response.results : [];
      evaluated = candidates.map((candidate) => ({ candidate, validation: validateCandidate(qualifiers, candidate) }));
      selected = evaluated.find((entry) => entry.validation.accepted) || null;
      const transport = response?.transport || {};
      attempts.push(Object.freeze({ normalizedQuery, requestAttempted: true, httpStatus: transport.httpStatus ?? null,
        providerCandidateCount: Number(transport.providerCandidateCount ?? candidates.length), acceptedCandidate: Boolean(selected),
        rejectionReason: selected ? "" : (evaluated[0]?.validation.rejectionReason || response?.status || "no_results") }));
      if (selected) break;
    }
    const transport = response?.transport || {};
    const responseEvidence = { requestAttempted: attempts.length > 0, httpStatus: transport.httpStatus ?? null,
      requestContractVersion: transport.requestContractVersion || REQUEST_CONTRACT_VERSION,
      providerResponseReceived: transport.providerResponseReceived === true,
      providerCandidateCount: Number(transport.providerCandidateCount ?? candidates.length),
      candidateCountAfterNormalization: candidates.length, attempts, qualifiersPreserved: attempts.every((x) => qualifiersPreserved(address, x.normalizedQuery)) };
    if (!selected) return { ...base, ...responseEvidence, candidateCount: candidates.length,
      rejectionReason: attempts.at(-1)?.rejectionReason || "no_results", qualifiers,
      mapFallback: { offered: true, confirmationRequired: true }, candidates: evaluated.map((entry) => entry.validation) };
    return { ...base, ...responseEvidence, candidateCount: candidates.length, selectedCandidate: selected.candidate,
      qualifierMatch: true, rejectionReason: "", resolutionStatus: "success", validationStatus: "passed",
      coordinates: { lat: selected.validation.latitude, lng: selected.validation.longitude },
      localityEvidence: selected.validation.localityEvidence, zipEvidence: selected.validation.zipEvidence,
      stateEvidence: selected.validation.stateEvidence, countyEvidence: selected.validation.countyEvidence,
      qualifiers, candidates: evaluated.map((entry) => entry.validation) };
  }

  function mapAnchorQuery(rawAddressInput = "") {
    const q = parseAddressQualifiers(rawAddressInput);
    if (!q.sufficientlyQualified) return "";
    return [q.city, q.state || "TX", q.zip].filter(Boolean).join(q.city ? ", " : " ");
  }

  function resolveGovernedAnchor({ address = "", zipRecords = [], areas = [] } = {}) {
    const qualifiers = parseAddressQualifiers(address);
    if (!qualifiers.sufficientlyQualified) return null;
    let area = null; let resolvedFrom = null;
    if (qualifiers.zip) {
      const record = zipRecords.find((entry) => clean(entry?.zip) === qualifiers.zip && clean(entry?.state).toUpperCase() === "TX"
        && ["resolved", "resolved_by_governance"].includes(entry?.resolutionStatus)
        && (!qualifiers.city || key(entry?.communityName) === key(qualifiers.city)));
      area = record && areas.find((entry) => entry?.key === record.awarenessAreaKey
        || (entry?.countyId === record.countyId && key(entry?.label) === key(record.communityName)));
      if (area) resolvedFrom = "zip";
    }
    if (!area && qualifiers.city) {
      area = areas.find((entry) => key(entry?.label) === key(qualifiers.city));
      if (area) resolvedFrom = "canonical_place";
    }
    const lat = Number(area?.lat); const lng = Number(area?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < TEXAS_BOUNDS.south || lat > TEXAS_BOUNDS.north || lng < TEXAS_BOUNDS.west || lng > TEXAS_BOUNDS.east) return null;
    return Object.freeze({ coordinates: Object.freeze({ lat, lng }), resolvedFrom,
      source: resolvedFrom === "zip" ? "governed_zip_community" : "governed_canonical_place",
      authority: clean(area.source) || "Gridly governed awareness area" });
  }

  function confirmMapSelection({ address = "", slot = "favorite", coordinates, anchor = null, confirmedAt = new Date().toISOString() } = {}) {
    const lat = Number(coordinates?.lat); const lng = Number(coordinates?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < TEXAS_BOUNDS.south || lat > TEXAS_BOUNDS.north || lng < TEXAS_BOUNDS.west || lng > TEXAS_BOUNDS.east) return null;
    return Object.freeze({ type: slot, address: clean(address), originalAddressInput: clean(address), lat, lng,
      coordinates: { lat, lng }, coordinateSource: "user_map_selection", resolutionStatus: "user_confirmed",
      validationStatus: "user_confirmed", verificationState: "user_confirmed", routeEligible: true,
      mapConfirmationAnchor: anchor, confirmedAt });
  }

  function mapFallbackAuditPass(fallback = {}) {
    return !(fallback.anchorAttempted === true && fallback.available !== true)
      && !(fallback.copyClaimsMapFallback === true && fallback.available !== true);
  }

  function isRouteEligible(place = {}) {
    const lat = Number(place.lat ?? place.coordinates?.lat); const lng = Number(place.lng ?? place.coordinates?.lng);
    const finite = Number.isFinite(lat) && Number.isFinite(lng);
    return finite && ((place.coordinateSource === "geocode" && place.resolutionStatus === "success" && place.validationStatus === "passed")
      || (place.coordinateSource === "user_map_selection" && place.resolutionStatus === "user_confirmed" && place.validationStatus === "user_confirmed" && Boolean(place.confirmedAt)));
  }

  function needsLegacyRevalidation(place = {}) {
    const latitude = Number(place.lat ?? place.coordinates?.lat);
    const longitude = Number(place.lng ?? place.coordinates?.lng);
    const verified = place.resolutionStatus === "success" && place.validationStatus === "passed";
    return place.coordinateSource === "geocode" && clean(place.address)
      && Number.isFinite(latitude) && Number.isFinite(longitude) && !verified;
  }

  async function revalidateLegacyPlace({ place, search } = {}) {
    if (!needsLegacyRevalidation(place)) return { place, attempted: false, result: "not_required" };
    const resolution = await resolveAddress({ address: place.address, search });
    if (resolution.resolutionStatus !== "success" || resolution.validationStatus !== "passed") {
      return { place: { ...place, resolutionStatus: "legacy_requires_revalidation",
        validationStatus: "legacy_requires_revalidation", routeEligible: false,
        migrationAttempted: true, migrationResult: resolution.rejectionReason || "failed" },
        attempted: true, result: resolution.rejectionReason || "failed", resolution };
    }
    return { place: { ...place, lat: resolution.coordinates.lat, lng: resolution.coordinates.lng,
      coordinates: { ...resolution.coordinates }, resolutionStatus: "success", validationStatus: "passed",
      localityEvidence: resolution.localityEvidence, zipEvidence: resolution.zipEvidence,
      stateEvidence: resolution.stateEvidence, countyEvidence: resolution.countyEvidence,
      resolvedAddress: resolution.selectedCandidate?.displayName || resolution.selectedCandidate?.formattedAddress || place.address,
      routeEligible: true, migrationAttempted: true, migrationResult: "passed" },
      attempted: true, result: "passed", resolution };
  }

  global.GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT = Object.freeze({
    name: CONTRACT_NAME, version: "LP244.6", requestContractVersion: REQUEST_CONTRACT_VERSION,
    geography: "Texas", parseAddressQualifiers, validateCandidate, resolveAddress,
    needsLegacyRevalidation, revalidateLegacyPlace
  });
  global.GRIDLY_SAVED_ADDRESS_ACQUISITION_CONTRACT = Object.freeze({
    name: ACQUISITION_CONTRACT_NAME, version: "LP244.6", geography: "Texas", maxAttempts: 4,
    normalizedAddressAttempts, qualifiersPreserved, mapAnchorQuery, resolveGovernedAnchor,
    confirmMapSelection, mapFallbackAuditPass, isRouteEligible
  });
})(typeof window !== "undefined" ? window : globalThis);
