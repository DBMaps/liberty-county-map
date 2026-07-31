function normalizedRoad(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, "cr $1")
    .replace(/\b(?:farm to market road|farm to market|farm road|fm)\s*(\d+[a-z]?)\b/g, "fm $1")
    .replace(/\b(?:state highway|sh|tx)\s*(\d+[a-z]?)\b/g, "sh $1")
    .replace(/\b(?:us highway|us)\s*(\d+[a-z]?)\b/g, "us $1");
}

export function governedRoadOnlyRequest(body) {
  if (body?.intent !== "address") return false;
  const street = String(body?.structuredAddress?.street || body?.query || "").split(",")[0].trim();
  if (/^\d{1,9}[A-Za-z]?\s+/.test(street)) return false;
  return /^(?:(?:county\s+(?:road|rd)|co\.?\s*rd|cr|fm|farm(?:-to-|\s+to\s+)market(?:\s+road)?|state\s+highway|sh|tx|us(?:\s+highway)?)\s*\d+[a-z]?)(?:\s|$)/i.test(street);
}

export function applyGovernedRoadOnlyAcceptance(body, candidates) {
  const roadOnly = governedRoadOnlyRequest(body);
  if (!roadOnly) return { results: candidates, roadOnly, residentialRejected: false, roadMismatchRejected: false };
  const requestedRoad = normalizedRoad(String(body?.structuredAddress?.street || body?.query || "").split(",")[0]);
  let residentialRejected = false;
  let roadMismatchRejected = false;
  const results = candidates.filter((candidate) => {
    const residential = Boolean(String(candidate?.address?.houseNumber || "").trim())
      || candidate?.resultType === "address" || candidate?.type === "house"
      || ["address_point", "rooftop", "parcel_centroid", "interpolated_address", "verified_address_point", "verified_entrance"].includes(candidate?.precision);
    if (residential) { residentialRejected = true; return false; }
    const returnedRoad = normalizedRoad(candidate?.address?.road || candidate?.name || "");
    if (!returnedRoad || returnedRoad !== requestedRoad) { roadMismatchRejected = true; return false; }
    return true;
  });
  return { results, roadOnly, residentialRejected, roadMismatchRejected };
}
