# LP041 — DriveTexas Live Provider Evidence Capture

## 1. Executive conclusion

LP041 adds bounded, memory-only diagnostic instrumentation to the existing sanctioned DriveTexas connector fetch path. It captures request, payload, raw feature, normalization, connector filter, count reconciliation, and diagnostic roadway-candidate evidence from the normal production request. Actual live US 90 findings remain pending owner browser validation.

## 2. Problem statement

Gridly needs to determine whether an official DriveTexas roadway event is absent from the provider response, dropped during parsing/extraction/normalization, or removed before authority selection. LP041 improves observability only; it does not force US 90, Dayton, Liberty County, or any route into production behavior.

## 3. Existing provider pipeline

The observed repository pipeline remains:

provider response → JSON parse → GeoJSON validation → raw feature extraction → normalization → complete normalized cache → connector awareness filtering → LP039 authority adaptation/eligibility → consumer projection.

## 4. Instrumentation architecture

Instrumentation is attached to the normal DriveTexas connector request path. The passive helper `window.gridlyLp041DriveTexasLiveProviderEvidenceAudit?.()` returns the latest compact snapshot. The optional trace helper `window.gridlyLp041DriveTexasProviderRecordTrace?.("US 90")` searches bounded in-memory evidence and currently retained normalized records only.

## 5. Request evidence captured

The connector records request start/completion time, duration, HTTP status, success, response content type, content length, ETag, Last-Modified, cache headers, pagination-related headers, total-count-related headers, attempt number, JSON parse success/failure, and timeout/abort status. The endpoint is redacted so the API key is never returned.

## 6. Raw payload evidence captured

The snapshot includes payload top-level type, bounded top-level keys, GeoJSON type, feature-array presence, raw feature count, provider-reported count fields where present, pagination/truncation fields where present, and `exceededTransferLimit` if supplied.

## 7. Raw feature inventory

Before normalization, LP041 summarizes total features, valid object features, null and malformed features, property presence, raw geometry type counts, bounded provider field names and field frequencies, important field availability, and raw category/type value counts.

## 8. Normalization trace

LP041 reports raw input count, extracted raw-record count, normalization attempts, success and failure counts, null normalized result count, thrown-error count, failure reason counts, output count, reconciliation, ID/timestamp/route/coordinate coverage, normalized category counts, and geometry transformation inventory.

## 9. Connector filter trace

`filterAwarenessRecords()` now records diagnostic source scoping counts: complete normalized input count, selected county/community, anchor, radius, point-radius matches, text-fallback matches, included-by-point/text/both counts, output count, invalid-coordinate count, excluded count, and fallback method names. This is explicitly labeled diagnostic source scoping and `certifiedAuthorityOwner: false`.

## 10. Pipeline count reconciliation

The audit reports provider-reported count, downloaded raw feature count, parsed feature count, extracted raw record count, normalized count, complete cache count, connector filter input/output count, and the first count divergence stage when observable. Authority adapter, authority eligibility, and consumer visible counts are left null unless observable without new behavior.

## 11. US 90 candidate findings

Repository instrumentation supports diagnostic US 90 variants (`US 90`, `US90`, `US090`, `US0090`, `US 090`, `US Highway 90`, and `United States Highway 90`) and returns up to 50 compact candidates. Test fixtures prove raw and normalized US 90 candidates can be traced across raw response, normalization, complete cache, and connector awareness filtering. Actual live US 90 conclusions are pending browser evidence.

## 12. Pagination and truncation findings

LP041 captures headers and payload fields that may indicate pagination or truncation. Absence of such evidence is reported truthfully and does not certify completeness.

## 13. Geometry and metadata findings

Raw geometry inventory is retained as compact counts. Normalized geometry remains unchanged: the existing provider still outputs point latitude/longitude and does not retain full raw payloads. Provider metadata is summarized by field inventory and availability counts only.

## 14. Root-cause decision framework

The audit is designed to support these live-evidence conclusions: raw absence, extraction loss, normalization loss, connector filter removal, authority eligibility failure, consumer presentation loss, multiple candidate paths, or sufficient pipeline evidence for a next sanctioned comparison milestone. LP041 must not select a conclusion without reviewed live evidence.

## 15. Safety and privacy protections

LP041 performs no additional fetches from helpers, starts no polling, writes no localStorage/Supabase data, stores no full raw provider payload, exposes no API key, keeps memory history bounded to three compact snapshots, and does not alter endpoint, query parameters, retry behavior, timeouts, normalization output, filtering output, authority output, or consumer output.

## 16. Non-recommendations

LP041 does not recommend widening awareness radii, removing connector filtering, promoting route-name text fallback into authority, hardcoding roads or communities, changing markers, changing copy, changing freshness/identity/deduplication, or changing LP039 authority selection.

## 17. Merge implications

Repository and fixture evidence show observability was added without intentional consumer behavior change. Do not merge until live browser evidence from the normal sanctioned DriveTexas request has been reviewed.

## 18. Suggested next milestone

After live evidence is reviewed, define the next milestone narrowly: repair only the proven loss stage, or conduct a sanctioned provider/public-map comparison if the exact public-map record cannot be identified from LP041 evidence alone.
