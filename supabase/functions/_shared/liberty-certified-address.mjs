const IDENTITY = Object.freeze({
  countyId: "liberty-tx", fips: "48291", artifact: "liberty-48291.addresses.jsonl.gz",
  sizeBytes: 2555016, sha256: "792f4f3f76524ef6652fbabf7c1c17d76eb1dfd9d83a71c460c1e038c2841b93"
});

const clean = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
export function canonicalLibertyRoad(value) {
  return clean(value).replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, "cr $1");
}
export function libertyRequest(body) {
  if (body?.intent !== "address") return null;
  const query = String(body.query || "");
  const street = String(body.structuredAddress?.street || query.split(",")[0] || "").trim();
  const match = street.match(/^\s*(\d{1,9}[a-z]?)\s+(.+)$/i);
  if (!match) return null;
  const county = clean(body.structuredAddress?.county || "").replace(/ county$/, "");
  const city = clean(body.structuredAddress?.city || query.split(",")[1] || "");
  const zip = String(body.structuredAddress?.postalCode || query.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "");
  const fips = String(body.context?.countyFips || "");
  const countyId = String(body.context?.countyId || "").toLowerCase();
  const explicitLiberty = fips === IDENTITY.fips || countyId === IDENTITY.countyId || county === "liberty";
  const localityLiberty = city === "dayton" && zip === "77535";
  if (!explicitLiberty && !localityLiberty) return null;
  if ((fips && fips !== IDENTITY.fips) || (countyId && countyId !== IDENTITY.countyId)
    || (county && county !== "liberty") || (zip && zip !== "77535") || (city && city !== "dayton")) return null;
  return { houseNumber: match[1].toLowerCase(), road: canonicalLibertyRoad(match[2]), city, zip };
}

const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
export async function lookupLibertyCertifiedAddress(body, options = {}) {
  const started = performance.now();
  const requested = libertyRequest(body);
  if (!requested) return { attempted: false, outcome: "ineligible", results: [], packageAccessed: false, totalMs: performance.now() - started };
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return { attempted: true, outcome: "package_unavailable", results: [], packageAccessed: false, totalMs: performance.now() - started };
  const fetcher = options.fetch || fetch;
  const lookupStarted = performance.now();
  try {
    const certificateResponse = await fetcher(`${baseUrl}/data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json`);
    if (!certificateResponse.ok) throw new Error("certificate_unreadable");
    const certificate = await certificateResponse.json();
    if (certificate.countyId !== IDENTITY.countyId || certificate.fips !== IDENTITY.fips || certificate.artifact !== IDENTITY.artifact
      || certificate.sizeBytes !== IDENTITY.sizeBytes || certificate.sha256 !== IDENTITY.sha256
      || certificate.acceptance?.houseNumber !== "exact" || certificate.acceptance?.road !== "canonical_exact"
      || certificate.acceptance?.interpolation !== false || certificate.acceptance?.nearbyHouseSubstitution !== false) throw new Error("certificate_mismatch");
    const packageResponse = await fetcher(`${baseUrl}/data/generated/lp104/txgio-addresses/${IDENTITY.artifact}`);
    if (!packageResponse.ok) throw new Error("package_unreadable");
    const compressed = await packageResponse.arrayBuffer();
    if (compressed.byteLength !== IDENTITY.sizeBytes || hex(await crypto.subtle.digest("SHA-256", compressed)) !== IDENTITY.sha256) throw new Error("package_mismatch");
    const reader = new Response(compressed).body.pipeThrough(new DecompressionStream("gzip")).getReader();
    const decoder = new TextDecoder(); let pending = ""; const matches = [];
    const inspect = (line) => {
      if (!line.trim()) return;
      const row = JSON.parse(line);
      if (String(row.f).padStart(5, "0") === IDENTITY.fips && clean(row.h) === requested.houseNumber && canonicalLibertyRoad(row.r) === requested.road
        && (!requested.city || clean(row.p) === requested.city) && (!requested.zip || String(row.z) === requested.zip)) matches.push(row);
    };
    while (true) { const { done, value } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop() || ""; lines.forEach(inspect); }
    pending += decoder.decode(); if (pending.trim()) inspect(pending);
    const results = matches.map((row) => ({ providerResultId: `txgio:${row.i}`, name: row.a, displayName: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), formattedAddress: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), latitude: Number(row.y), longitude: Number(row.x), category: "place", type: "house", resultType: "address", precision: "address_point", confidenceBasis: "certified_txgio_address_point", sourceClassification: "government_address_point", routePreviewEligible: true, address: { houseNumber: row.h, road: row.r, community: "", city: row.p, mailingCity: row.p, county: row.c, state: "TX", postalCode: row.z, country: "United States" }, providerIdentity: { sourceId: row.i, provider: "txgio_certified_package" } }));
    return { attempted: true, outcome: results.length ? "exact_match" : "truthful_no_result", results, packageAccessed: true, lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  } catch (error) {
    return { attempted: true, outcome: "package_unavailable", results: [], packageAccessed: true, rejectionReason: String(error?.message || error), lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  }
}
