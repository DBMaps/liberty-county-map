(function initializeGridlySavedAddressIntegrity(global) {
  "use strict";

  const CONTRACT_NAME = "GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT";
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
      geocoderQuery: qualifiers.normalizedAddressQuery, candidateCount: 0, selectedCandidate: null,
      qualifierMatch: false, rejectionReason: "", resolutionStatus: "failed", validationStatus: "rejected" };
    if (!qualifiers.sufficientlyQualified) return { ...base, rejectionReason: "locality_required", qualifiers };
    if (typeof search !== "function") return { ...base, rejectionReason: "geocoder_unavailable", qualifiers };
    const response = await search({ intent: "address", query: qualifiers.normalizedAddressQuery, limit: 5, requestMode: "saved_address_integrity" });
    const candidates = response?.ok && Array.isArray(response.results) ? response.results : [];
    const evaluated = candidates.map((candidate) => ({ candidate, validation: validateCandidate(qualifiers, candidate) }));
    const selected = evaluated.find((entry) => entry.validation.accepted);
    if (!selected) return { ...base, candidateCount: candidates.length,
      rejectionReason: evaluated[0]?.validation.rejectionReason || response?.status || "no_results", qualifiers,
      candidates: evaluated.map((entry) => entry.validation) };
    return { ...base, candidateCount: candidates.length, selectedCandidate: selected.candidate,
      qualifierMatch: true, rejectionReason: "", resolutionStatus: "success", validationStatus: "passed",
      coordinates: { lat: selected.validation.latitude, lng: selected.validation.longitude },
      localityEvidence: selected.validation.localityEvidence, zipEvidence: selected.validation.zipEvidence,
      stateEvidence: selected.validation.stateEvidence, countyEvidence: selected.validation.countyEvidence,
      qualifiers, candidates: evaluated.map((entry) => entry.validation) };
  }

  global.GRIDLY_SAVED_ADDRESS_GEOCODE_INTEGRITY_CONTRACT = Object.freeze({
    name: CONTRACT_NAME, version: "LP244.5", geography: "Texas", parseAddressQualifiers, validateCandidate, resolveAddress
  });
})(typeof window !== "undefined" ? window : globalThis);
