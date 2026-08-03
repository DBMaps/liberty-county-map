import { downloadCountyArtifact, readBoundedArtifact } from "./county-artifact-storage.mjs";
import { IncrementalSha256 } from "./incremental-sha256.mjs";
import { CERTIFIED_COUNTIES } from "./certified-address-identities.mjs";

const IDENTITY = CERTIFIED_COUNTIES.find((county) => county.fips === "48291");
const byFips = new Map(CERTIFIED_COUNTIES.map((county) => [county.fips, county]));
const byCountyId = new Map(CERTIFIED_COUNTIES.map((county) => [county.countyId, county]));
const bySlug = new Map(CERTIFIED_COUNTIES.map((county) => [county.slug.replaceAll("-", " "), county]));

const clean = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
export function canonicalLibertyRoad(value) { return clean(value).replace(/\b(?:county road|county rd|co rd|cr)\s*(\d+[a-z]?)\b/g, "cr $1"); }
export function libertyRequest(body) {
  if (body?.intent !== "address") return null;
  const query = String(body.query || ""); const street = String(body.structuredAddress?.street || query.split(",")[0] || "").trim();
  const match = street.match(/^\s*(\d{1,9}[a-z]?)\s+(.+)$/i); if (!match) return null;
  const countyEvidence = clean(body.structuredAddress?.county || "").replace(/ county$/, "");
  const fips = String(body.context?.countyFips || ""); const countyId = String(body.context?.countyId || "").toLowerCase();
  const city = clean(body.structuredAddress?.city || query.split(",")[1] || "");
  const zip = String(body.structuredAddress?.postalCode || query.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] || "");
  const evidence = [fips && byFips.get(fips), countyId && byCountyId.get(countyId), countyEvidence && bySlug.get(countyEvidence)].filter(Boolean);
  if (!evidence.length && city === "dayton" && zip === "77535") evidence.push(IDENTITY);
  if (!evidence.length || new Set(evidence.map((x) => x.fips)).size !== 1) return null;
  const identity = evidence[0];
  if ((fips && fips !== identity.fips) || (countyId && countyId !== identity.countyId) || (countyEvidence && countyEvidence !== identity.slug.replaceAll("-", " "))) return null;
  if (city === "dayton" && zip === "77535" && identity !== IDENTITY) return null;
  if (identity === IDENTITY && ((city && city !== "dayton") || (zip && zip !== "77535"))) return null;
  return { identity, houseNumber: match[1].toLowerCase(), road: canonicalLibertyRoad(match[2]), city, zip };
}

export async function lookupLibertyCertifiedAddress(body, options = {}) {
  const started = performance.now(); const completedStages = ["browser_request_received"];
  const bucket = String(options.bucket || "certified-addresses");
  const requested = libertyRequest(body);
  let storageStatusCategory = "not_requested"; let packageAccessed = false;
  const artifact = { artifactAccessMode: "not_requested", streamingDownloadUsed: false, compressedBytesRead: 0,
    expectedCompressedBytes: requested?.identity?.sizeBytes || null, compressedByteSizeValidated: false,
    incrementalHashUsed: false, calculatedSha256: null, sha256Validated: false, decompressionStarted: false,
    decompressionCompleted: false, recordsScanned: 0, exactMatchEncountered: false,
    exactMatchPromotedAfterIntegrityValidation: false, maximumBufferedChunkBytes: 0,
    packageDownloadElapsedMilliseconds: 0, packageHashElapsedMilliseconds: 0,
    decompressionAndScanElapsedMilliseconds: 0, totalArtifactElapsedMilliseconds: 0,
    errorName: null, errorMessage: null };
  const diagnostic = (extra = {}) => ({ completedStages: [...completedStages], lastCompletedStage: completedStages.at(-1) || null,
    failureStage: null, certifiedProviderExecuted: false, certificateValidated: false, packageOpened: false,
    exactLookupExecuted: false, storageBucket: bucket, selectedCountySlug: requested?.identity?.slug || null, selectedFips: requested?.identity?.fips || null, certificateObjectPath: requested?.identity?.certificateObjectPath || null,
    packageObjectPath: requested?.identity?.packageObjectPath || null, storageStatusCategory, certificateFetchCompleted: false,
    certificateFetchReason: "not_requested", ...artifact, ...extra });
  if (!requested) return { attempted: false, outcome: "ineligible", results: [], packageAccessed: false, runtimeDiagnostic: diagnostic(), totalMs: performance.now() - started };
  const identity = requested.identity;
  completedStages.push("eligible_for_certified_provider", "storage_bucket_selected");
  let failureStage = "runtime_certificate_requested"; let certificateFetchCompleted = false; let certificateFetchReason = "not_requested";
  const lookupStarted = performance.now();
  try {
    completedStages.push("runtime_certificate_requested");
    const access = { supabaseUrl: options.supabaseUrl, serviceRoleKey: options.serviceRoleKey, fetchImpl: options.fetchImpl };
    const certificateDownload = await downloadCountyArtifact(options.storage, { bucket, objectPath: identity.certificateObjectPath }, { timeoutMs: options.certificateTimeoutMs, ...access });
    storageStatusCategory = certificateDownload.statusCategory;
    if (!certificateDownload.ok) { certificateFetchReason = certificateDownload.reason; throw new Error("certificate_unavailable"); }
    certificateFetchCompleted = true; certificateFetchReason = "successful_retrieval"; completedStages.push("runtime_certificate_retrieved");
    failureStage = "certificate_validated";
    let certificate; try { certificate = JSON.parse(new TextDecoder().decode(await readBoundedArtifact(certificateDownload.stream))); }
    catch (_error) { certificateFetchReason = "invalid_certificate"; throw new Error("invalid_certificate"); }
    if (certificate.countyId !== identity.countyId || certificate.fips !== identity.fips || certificate.artifact !== identity.artifact
      || certificate.sizeBytes !== identity.sizeBytes || certificate.sha256 !== identity.sha256
      || certificate.acceptance?.houseNumber !== "exact" || certificate.acceptance?.road !== "canonical_exact"
      || certificate.acceptance?.interpolation !== false || certificate.acceptance?.nearbyHouseSubstitution !== false) {
      certificateFetchReason = "invalid_certificate"; throw new Error("certificate_mismatch");
    }
    completedStages.push("certificate_validated"); failureStage = "liberty_package_requested"; completedStages.push("liberty_package_requested");
    packageAccessed = true;
    const artifactStarted = performance.now(); const downloadStarted = performance.now();
    const packageDownload = await downloadCountyArtifact(options.storage, { bucket, objectPath: identity.packageObjectPath }, { timeoutMs: options.packageTimeoutMs, ...access });
    storageStatusCategory = packageDownload.statusCategory;
    if (!packageDownload.ok) throw new Error(packageDownload.reason);
    artifact.artifactAccessMode = packageDownload.accessMode; artifact.streamingDownloadUsed = true;
    artifact.incrementalHashUsed = true; completedStages.push("liberty_package_retrieved"); failureStage = "gzip_stream_opened";
    const hash = new IncrementalSha256(); let hashMs = 0;
    const verifiedCompressedStream = packageDownload.stream.pipeThrough(new TransformStream({ transform(chunk, controller) {
      artifact.maximumBufferedChunkBytes = Math.max(artifact.maximumBufferedChunkBytes, chunk.byteLength);
      artifact.compressedBytesRead += chunk.byteLength; const hashStarted = performance.now(); hash.update(chunk);
      hashMs += performance.now() - hashStarted; controller.enqueue(chunk);
    } }));
    artifact.decompressionStarted = true; const scanStarted = performance.now();
    const reader = verifiedCompressedStream.pipeThrough(new DecompressionStream("gzip")).getReader(); completedStages.push("gzip_stream_opened");
    failureStage = "exact_lookup_executed"; const decoder = new TextDecoder(); let pending = ""; const matches = [];
    const inspect = (line) => { if (!line.trim()) return; const row = JSON.parse(line);
      artifact.recordsScanned += 1;
      if (String(row.f).padStart(5, "0") === identity.fips && clean(row.h) === requested.houseNumber && canonicalLibertyRoad(row.r) === requested.road
        && (!requested.city || clean(row.p) === requested.city) && (!requested.zip || String(row.z) === requested.zip)) { matches.push(row); artifact.exactMatchEncountered = true; } };
    while (true) { const { done, value } = await reader.read(); if (done) break; pending += decoder.decode(value, { stream: true }); const lines = pending.split("\n"); pending = lines.pop() || ""; lines.forEach(inspect); }
    pending += decoder.decode(); if (pending.trim()) inspect(pending);
    artifact.decompressionCompleted = true; artifact.decompressionAndScanElapsedMilliseconds = performance.now() - scanStarted;
    artifact.packageDownloadElapsedMilliseconds = performance.now() - downloadStarted;
    artifact.packageHashElapsedMilliseconds = hashMs; artifact.calculatedSha256 = hash.digestHex();
    artifact.compressedByteSizeValidated = artifact.compressedBytesRead === identity.sizeBytes;
    artifact.sha256Validated = artifact.calculatedSha256 === identity.sha256;
    artifact.totalArtifactElapsedMilliseconds = performance.now() - artifactStarted;
    failureStage = "package_integrity_validated";
    if (!artifact.compressedByteSizeValidated || !artifact.sha256Validated) throw new Error("package_integrity_mismatch");
    completedStages.push("package_integrity_validated", "exact_lookup_executed"); artifact.exactMatchPromotedAfterIntegrityValidation = matches.length > 0;
    const results = matches.map((row) => ({ providerResultId: `txgio:${row.i}`, name: row.a, displayName: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), formattedAddress: [row.a, row.p, "TX", row.z].filter(Boolean).join(", "), latitude: Number(row.y), longitude: Number(row.x), category: "place", type: "house", resultType: "address", precision: "address_point", confidenceBasis: "certified_txgio_address_point", sourceClassification: "government_address_point", routePreviewEligible: true, address: { houseNumber: row.h, road: row.r, community: "", city: row.p, mailingCity: row.p, county: row.c, state: "TX", postalCode: row.z, country: "United States" }, providerIdentity: { sourceId: row.i, provider: "txgio_certified_package" } }));
    completedStages.push(results.length ? "exact_match_found" : "truthful_miss");
    return { attempted: true, outcome: results.length ? "exact_match" : "truthful_no_result", results, packageAccessed: true,
      runtimeDiagnostic: diagnostic({ certifiedProviderExecuted: true, certificateValidated: true, packageOpened: true, exactLookupExecuted: true, certificateFetchCompleted, certificateFetchReason }), lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  } catch (error) {
    artifact.errorName = String(error?.name || "Error").slice(0, 64);
    artifact.errorMessage = String(error?.message || "artifact_unavailable").slice(0, 128);
    return { attempted: true, outcome: "package_unavailable", results: [], packageAccessed, rejectionReason: String(error?.message || "artifact_unavailable").slice(0, 64),
      runtimeDiagnostic: diagnostic({ failureStage, certifiedProviderExecuted: true, certificateValidated: completedStages.includes("certificate_validated"), packageOpened: completedStages.includes("gzip_stream_opened"), exactLookupExecuted: completedStages.includes("exact_lookup_executed"), certificateFetchCompleted, certificateFetchReason }), lookupMs: performance.now() - lookupStarted, totalMs: performance.now() - started };
  }
}
