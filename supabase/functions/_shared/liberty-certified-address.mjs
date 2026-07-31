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
const safeOperationalUrl = (value) => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch { return "invalid_url"; }
};
export async function lookupLibertyCertifiedAddress(body, options = {}) {
  const started = performance.now();
  const completedStages = ["browser_request_received"];
  const diagnostic = (extra = {}) => ({
    completedStages: [...completedStages],
    lastCompletedStage: completedStages.at(-1) || null,
    failureStage: null,
    certifiedProviderExecuted: false,
    certificateValidated: false,
    packageOpened: false,
    exactLookupExecuted: false,
    certificateUrl: null,
    certificateHttpStatus: null,
    certificateFetchCompleted: false,
    certificateFetchReason: "not_requested",
    ...extra
  });
  const requested = libertyRequest(body);
  if (!requested) return { attempted: false, outcome: "ineligible", results: [], packageAccessed: false,
    runtimeDiagnostic: diagnostic(), totalMs: performance.now() - started };
  completedStages.push("eligible_for_certified_provider");
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  if (!baseUrl) return { attempted: true, outcome: "package_unavailable", results: [], packageAccessed: false,
    runtimeDiagnostic: diagnostic({ failureStage: "artifact_base_url_selected", certifiedProviderExecuted: true }), totalMs: performance.now() - started };
  completedStages.push("artifact_base_url_selected");
  const fetcher = options.fetch || fetch;
  const certificateUrl = `${baseUrl}/data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json`;
  const safeCertificateUrl = safeOperationalUrl(certificateUrl);
  const lookupStarted = performance.now();
  let packageAccessed = false;
  let failureStage = "runtime_certificate_requested";
  let certificateHttpStatus = null;
  let certificateFetchCompleted = false;
  let certificateFetchReason = "not_requested";
  try {
    completedStages.push("runtime_certificate_requested");
    const certificateTimeoutMs = Number(options.certificateTimeoutMs) > 0 ? Number(options.certificateTimeoutMs) : 10000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), certificateTimeoutMs);
    let certificateResponse;
    try {
      certificateResponse = await fetcher(certificateUrl, { signal: controller.signal });
      certificateFetchCompleted = true;
      certificateHttpStatus = Number.isInteger(certificateResponse?.status) ? certificateResponse.status : null;
    } catch (error) {
      certificateFetchReason = error?.name === "AbortError" ? "timeout" : "network_failure";
      throw error;
    } finally { clearTimeout(timer); }
    if (!certificateResponse.ok) { certificateFetchReason = "http_error"; throw new Error("certificate_unreadable"); }
    completedStages.push("runtime_certificate_retrieved");
    failureStage = "certificate_validated";
    let certificate;
    try { certificate = await certificateResponse.json(); }
    catch (error) { certificateFetchReason = "invalid_certificate"; throw error; }
    if (certificate.countyId !== IDENTITY.countyId || certificate.fips !== IDENTITY.fips || certificate.artifact !== IDENTITY.artifact
      || certificate.sizeBytes !== IDENTITY.sizeBytes || certificate.sha256 !== IDENTITY.sha256
      || certificate.acceptance?.houseNumber !== "exact" || certificate.acceptance?.road !== "canonical_exact"
      || certificate.acceptance?.interpolation !== false || certificate.acceptance?.nearbyHouseSubstitution !== false) {
      certificateFetchReason = "invalid_certificate"; throw new Error("certificate_mismatch");
    }
    certificateFetchReason = "successful_retrieval";
    completedStages.push("certificate_validated");
    failureStage = "liberty_package_requested";
    completedStages.push("liberty_package_requested");
    const packageResponse = await fetcher(`${baseUrl}/data/generated/lp104/txgio-addresses/${IDENTITY.artifact}`);
    packageAccessed = true;
    if (!packageResponse.ok) throw new Error("package_unreadable");
    completedStages.push("liberty_package_retrieved");
    failureStage = "gzip_stream_opened";
    const compressed = await packageResponse.arrayBuffer();
    if (compressed.byteLength !== IDENTITY.sizeBytes || hex(await crypto.subtle.digest("SHA-256", compressed)) !== IDENTITY.sha256) throw new Error("package_mismatch");
    const reader = new Response(compressed).body.pipeThrough(new DecompressionStream("gzip")).getReader();
    completedStages.push("gzip_stream_opened");
    failureStage = "exact_lookup_executed";
    const decoder = new TextDecoder(); let pending = ""; const matches = [];
    const inspect = (line) => {
      if (!line.trim()) return;
      const row = JSON.parse(line);
      if (String(row.f).padStart(5, "0") === IDENTITY.fips && clean(row.h) === requested.houseNumber && canonicalLibertyRoad(row.r) === requested.road
        && (!requested.city || clean(row.p) === requested.city) && (!requested.zip || String(row.z) === requested.zip)) matches.push(row);
    };
    while (true) { const { done, value } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop() || ""; lines.forEach(inspect); }
    pending += decoder.decode(); if (pending.trim()) inspect(pending);
    completedStages.push("exact_lookup_executed");
    const results = matches.map((row) => ({ providerResultId: `txgio:${row.i}`, name: row.a, displayName: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), formattedAddress: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), latitude: Number(row.y), longitude: Number(row.x), category: "place", type: "house", resultType: "address", precision: "address_point", confidenceBasis: "certified_txgio_address_point", sourceClassification: "government_address_point", routePreviewEligible: true, address: { houseNumber: row.h, road: row.r, community: "", city: row.p, mailingCity: row.p, county: row.c, state: "TX", postalCode: row.z, country: "United States" }, providerIdentity: { sourceId: row.i, provider: "txgio_certified_package" } }));
    completedStages.push(results.length ? "exact_match_found" : "truthful_miss");
    return { attempted: true, outcome: results.length ? "exact_match" : "truthful_no_result", results, packageAccessed: true,
      runtimeDiagnostic: diagnostic({ certifiedProviderExecuted: true, certificateValidated: true, packageOpened: true, exactLookupExecuted: true,
        certificateUrl: safeCertificateUrl, certificateHttpStatus, certificateFetchCompleted, certificateFetchReason }),
      lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  } catch (error) {
    return { attempted: true, outcome: "package_unavailable", results: [], packageAccessed, rejectionReason: String(error?.message || error),
      runtimeDiagnostic: diagnostic({ failureStage, certifiedProviderExecuted: true,
        certificateValidated: completedStages.includes("certificate_validated"), packageOpened: completedStages.includes("gzip_stream_opened"),
        exactLookupExecuted: completedStages.includes("exact_lookup_executed"), certificateUrl: safeCertificateUrl,
        certificateHttpStatus, certificateFetchCompleted, certificateFetchReason }),
      lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  }
}
