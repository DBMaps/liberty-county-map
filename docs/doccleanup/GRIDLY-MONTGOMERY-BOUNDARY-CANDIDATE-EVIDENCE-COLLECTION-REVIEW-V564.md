# GRIDLY Montgomery Boundary Candidate Evidence Collection Review V564

## 1. Executive Summary

V564 is a documentation-only evidence-collection review for actual candidate Montgomery County, Texas boundary datasets. It applies the evidence requirements established in V555, V562, and V563 to named candidate sources that appear to be publicly identifiable as of this review.

Final determination: **Evidence Partially Sufficient With Observations**.

A leading candidate exists for the next acceptance stage: **U.S. Census Bureau TIGER/Line county boundary data for Montgomery County, Texas**, because it has the clearest publication path, version/vintage record, national maintenance model, public download availability, and reproducible provenance. However, this review does not accept that source. Remaining gaps include license/terms confirmation for Gridly use, geometry validation, Liberty/Montgomery shared-edge validation, transformation documentation, checksum capture, and a formal acceptance packet.

This milestone does not implement, import, activate, or approve Montgomery County. It only records candidate evidence and evaluates whether the evidence is sufficient to proceed toward a future boundary acceptance review.

## 2. Documentation-Only Boundary and Non-Authority Statement

This milestone is documentation only.

This milestone does **NOT**:

- Activate Montgomery County
- Onboard Montgomery County
- Create county packages
- Create registry entries
- Modify registries
- Modify Supabase
- Modify storage
- Modify production behavior
- Enable historical features
- Resume DriveTexas
- Enable Transportation Intelligence
- Execute migrations
- Import boundary data
- Approve implementation
- Approve activation

V564 creates no county package, registry entry, Supabase object, storage namespace, migration, imported geometry, boundary artifact, runtime configuration, production exposure, implementation authority, activation authority, or boundary-acceptance decision.

## 3. Protected Boundary Preservation

The following protected boundaries remain mandatory and unchanged:

```yaml
historicalReadsEnabled: false
historyUiEnabled: false
historicalApiExposure: false
consumerFacingHistoryDashboard: false
```

```yaml
DriveTexasPaused: true
```

```yaml
TransportationIntelligenceEnabled: false
TransportationIntelligenceDisplay: false
TransportationIntelligenceActivation: false
```

These values are preserved by this review. They are not toggles, rollout controls, implementation shortcuts, activation controls, registry controls, migration controls, or production authorization mechanisms.

## 4. Prior-Milestone Recap

### 4.1 V555 Boundary Source Review

V555 established the Montgomery boundary-source review framework. It defined why authoritative boundaries are required, identified candidate source categories, documented evaluation criteria, described containment considerations, and listed future evidence expectations for authority, accuracy, geographic completeness, provenance, versioning, freshness, ownership, licensing, maintainability, and containment compatibility.

V555 did not select, approve, accept, import, transform, implement, or activate any Montgomery boundary source.

### 4.2 V562 Boundary Source Acceptance Review

V562 evaluated whether the then-available planning record was sufficient to accept a specific authoritative Montgomery boundary reference for future implementation artifacts. It determined that acceptance was not yet recommended because no named dataset, official access path, version, publication date, retrieval date, license record, geometry validation evidence, or Liberty/Montgomery shared-edge review had been documented.

V562 identified county GIS sources as a preferred source category if future evidence confirms authority, provenance, versioning, freshness, licensing compatibility, and containment compatibility.

### 4.3 V563 Boundary Evidence Packet Review

V563 defined the evidence packet expected for any specific future Montgomery boundary dataset candidate. It required reviewers to document dataset identity, source organization, access path, version, publication/update record, ownership, licensing, limitations, provenance, completeness, containment behavior, and remaining gaps before a future acceptance decision could be considered.

V563 did not select a source, accept a source, approve implementation, approve activation, or import boundary data.

## 5. Purpose of Evidence Collection

Evidence collection exists to turn general source categories into auditable candidate records. A future boundary acceptance review cannot rely on a statement that a candidate is generally authoritative; it must be able to verify what dataset was considered, who published it, how it can be obtained, what version or vintage was reviewed, what limitations are known, what license or public-use terms apply, and whether the geometry is suitable for Montgomery containment and Liberty/Montgomery shared-edge behavior.

This review therefore records actual candidate sources and evaluates their evidence maturity. It does not decide implementation, import files, create artifacts, or activate Montgomery County.

## 6. Candidate-Source Inventory

### 6.1 Candidate A — Montgomery County IT-GIS Hub / Geocore Open Data: USCB County Boundary 2017

- **Source organization:** Montgomery County, Texas IT-GIS / Montgomery County GIS.
- **Dataset name:** `USCB County Boundary 2017` / county boundary dataset on Montgomery County open data.
- **Availability:** Public Montgomery County GIS hub and ArcGIS open data listing. The county IT-GIS hub describes county geospatial services, and the open data item identifies county boundary data for Montgomery County sourced from U.S. Census Bureau TIGER/Line data.
- **Version information:** Dataset title indicates `2017`; no complete acceptance-grade version packet is captured by this review.
- **Publication/update information:** Search result evidence indicates the open data item was published years before this review; exact last-update metadata must be captured from the source item before acceptance.
- **Ownership information:** Published through Montgomery County GIS, but underlying boundary source is identified as U.S. Census Bureau TIGER/Line.
- **Licensing information:** Not fully confirmed in this review. ArcGIS open data access suggests public availability, but Gridly-compatible license/terms must be documented before acceptance.
- **Known limitations:** Appears to be county-published but Census-derived. The `2017` title suggests possible stale vintage compared with current TIGER releases. County-published derivative status creates provenance questions: whether geometry was modified, simplified, clipped, or republished without transformation notes.
- **Evidence completeness assessment:** **Candidate With Observations**. Strong local publication channel, but insufficient version, license, freshness, transformation, checksum, and shared-edge evidence.

### 6.2 Candidate B — U.S. Census Bureau TIGER/Line County Boundary Data: Montgomery County, Texas

- **Source organization:** U.S. Department of Commerce, U.S. Census Bureau, Geography Division.
- **Dataset name:** TIGER/Line Shapefiles, County boundary / current county geography for Montgomery County, Texas.
- **Availability:** Public Census TIGER/Line download channel and data.gov catalog records. The Census TIGER/Line page states that 2025 shapefiles were released on September 23, 2025, and that legal boundaries and names are as of January 1, 2025.
- **Version information:** 2025 TIGER/Line vintage is identifiable; current county-level and county-specific extracts can be referenced by file name, release year, and retrieval date in a future evidence packet.
- **Publication/update information:** 2025 release date is identifiable; data.gov catalog records also describe the TIGER/Line extracts and download resources for Montgomery County, Texas.
- **Ownership information:** U.S. Census Bureau Geography Division maintains TIGER/Line geography through MAF/TIGER and associated boundary update programs.
- **Licensing information:** Public federal dataset, but a future acceptance packet must still cite exact Census/data.gov terms and confirm compatibility with Gridly storage, transformation, redistribution, and derivative review uses.
- **Known limitations:** TIGER/Line is authoritative for Census geography and broadly maintained, but may not represent survey-grade local legal boundary precision. Acceptance must validate positional accuracy near the Liberty/Montgomery shared edge and document whether the Census generalized/legal boundary is sufficient for Gridly containment.
- **Evidence completeness assessment:** **Strong Candidate**. Best current evidence maturity because organization, dataset family, version/vintage, release cadence, download channel, and provenance are identifiable.

### 6.3 Candidate C — TxDOT Open Data Portal: Texas County Boundaries Detailed

- **Source organization:** Texas Department of Transportation.
- **Dataset name:** Texas County Boundaries Detailed.
- **Availability:** Public TxDOT Open Data Portal ArcGIS feature service / dataset page.
- **Version information:** Portal evidence identifies the dataset as a detailed polygon layer of the 254 Texas counties; exact item update history and schema should be captured from the portal before acceptance.
- **Publication/update information:** Search evidence indicates the dataset has existed for years and has portal update metadata, but acceptance-grade publication/update evidence must be captured directly from the item page.
- **Ownership information:** TxDOT publishes the dataset. The portal states it was created by TxDOT for internal purposes.
- **Licensing information:** Not fully confirmed in this review; public portal availability is not by itself a complete license assessment.
- **Known limitations:** The TxDOT page states that TxDOT is not the authority for county boundary data for the state. That limitation materially weakens authority for Gridly boundary acceptance even if the geometry is operationally useful as comparison evidence.
- **Evidence completeness assessment:** **Candidate With Observations**. Useful as cross-check/comparison data, but not preferred as the accepted source unless authority concerns are resolved.

### 6.4 Candidate D — TxDOT Open Data Portal: Texas County Boundaries Line

- **Source organization:** Texas Department of Transportation.
- **Dataset name:** Texas County Boundaries (line).
- **Availability:** Public TxDOT Open Data Portal ArcGIS feature service / dataset page.
- **Version information:** Dataset describes a polyline layer for all 254 Texas counties; acceptance-grade item version and update metadata must be captured directly.
- **Publication/update information:** Portal evidence indicates publication years before this review. Exact latest update and metadata require capture.
- **Ownership information:** TxDOT publishes the dataset; source notes indicate county boundaries were digitized by TxDOT using USGS quad maps and converted to line features.
- **Licensing information:** Not fully confirmed in this review.
- **Known limitations:** Line features do not directly provide a closed county polygon without additional processing. Digitization from USGS quad maps and conversion to line features raise transformation and containment questions. A line dataset is more suitable for comparison or edge review than direct polygon containment.
- **Evidence completeness assessment:** **Candidate With Observations**. Useful for shared-edge evidence and comparison, but insufficient as the primary containment polygon without conversion and validation.

### 6.5 Candidate E — Texas Geographic Information Office / TNRIS DataHub and County Map Series

- **Source organization:** Texas Geographic Information Office / Texas Natural Resources Information System, a division of the Texas Water Development Board.
- **Dataset name:** Texas County Boundaries service / county map series boundary data references.
- **Availability:** Public map/data portal and map services. TxGIO describes the County Map Series as providing reference maps for all 254 Texas counties, and TNRIS mapserver exposes a Texas County Boundaries service preview.
- **Version information:** Not fully captured in this review. Some TxGIO/TNRIS products reference TxDOT and/or Census boundary sources by year in map products, but the exact downloadable Montgomery boundary dataset version is not established here.
- **Publication/update information:** Public map pages and services exist, but exact dataset release/update metadata requires further evidence collection.
- **Ownership information:** TxGIO/TNRIS publishes or aggregates statewide geospatial data. Underlying county-boundary ownership may depend on the specific service or map product.
- **Licensing information:** TxGIO map page notes public-domain data availability for its map/data services context, but acceptance requires exact dataset-level terms.
- **Known limitations:** Candidate may be an aggregator or map-product publisher rather than the originating county-boundary authority. Evidence must distinguish downloadable authoritative boundary data from cartographic reference products.
- **Evidence completeness assessment:** **Insufficient Evidence** for primary acceptance, but useful as a state-level corroborating or comparison source.

## 7. Candidate Boundary Evidence Matrix

| Candidate Source | Authority | Evidence Completeness | Strengths | Limitations |
| --- | --- | --- | --- | --- |
| Montgomery County IT-GIS / Geocore Open Data — USCB County Boundary 2017 | Local county publication channel; underlying Census source | Candidate With Observations | County-hosted; directly Montgomery-specific; public open data listing | Appears Census-derived; likely older 2017 vintage; license, updates, transformations, checksum, and shared-edge evidence missing |
| U.S. Census Bureau TIGER/Line County Boundary Data — Montgomery County, TX | Federal Census geography authority | Strong Candidate | Clear source organization; identifiable 2025 vintage; public download path; national maintenance model; reproducible provenance | Must confirm license/terms, positional suitability, geometry validity, and Liberty/Montgomery shared-edge containment compatibility |
| TxDOT Texas County Boundaries Detailed | State transportation agency publisher, but not state county-boundary authority | Candidate With Observations | Statewide polygon layer; useful comparison source; public feature service | TxDOT states it is not the authority; internal-purpose origin; license/update details need capture |
| TxDOT Texas County Boundaries Line | State transportation agency publisher | Candidate With Observations | Useful for boundary-line comparison and shared-edge review; public feature service | Line geometry is not a containment polygon; digitized from USGS quad maps; transformation required; authority weaker than Census/current county source |
| TxGIO/TNRIS Texas County Boundaries / County Map Series | State geospatial clearinghouse / aggregator | Insufficient Evidence | Statewide geospatial stewardship; useful corroborating context; public services and maps | Exact authoritative dataset identity, version, source lineage, license, and update metadata not yet established |

## 8. Candidate Evaluations Against V555/V562/V563 Criteria

### 8.1 Montgomery County IT-GIS / Geocore Open Data — USCB County Boundary 2017

- **Authority:** Moderate. County-hosted publication is relevant, but the named source appears to be Census-derived rather than locally maintained legal boundary geometry.
- **Accuracy:** Not yet acceptance-grade. Geometry precision and any simplification are not documented here.
- **Geographic completeness:** Likely full-county, but polygon validity and complete edge continuity must be verified.
- **Provenance:** Partial. County page plus Census source naming exists, but transformation chain is missing.
- **Versioning:** Partial. `2017` is visible in the dataset title, but item revision and source vintage require capture.
- **Freshness:** Concern. A 2017 candidate is potentially stale compared with current TIGER releases.
- **Ownership:** Partial. Published by Montgomery County GIS; source attribution appears Census-based.
- **Licensing compatibility:** Unknown until dataset terms are recorded.
- **Maintainability:** Moderate if county open data remains available; weaker if derivative updates are irregular.
- **Containment compatibility:** Unknown until geometry validation and shared-edge review are performed.
- **Determination:** **Candidate With Observations**.

### 8.2 U.S. Census Bureau TIGER/Line County Boundary Data — Montgomery County, Texas

- **Authority:** Strong for Census geography and nationally standardized county boundary representation.
- **Accuracy:** Acceptable candidate pending containment-specific validation; not assumed survey-grade.
- **Geographic completeness:** Strong candidate because TIGER/Line county datasets are intended as complete governmental unit geography.
- **Provenance:** Strong. Source organization, product family, release year, and publication channel are identifiable.
- **Versioning:** Strong. 2025 vintage and release information are identifiable.
- **Freshness:** Strong relative to the available evidence, with 2025 release and legal boundary date documented by Census.
- **Ownership:** Strong. U.S. Census Bureau Geography Division is identifiable.
- **Licensing compatibility:** Likely favorable as a federal public dataset, but exact terms must be documented.
- **Maintainability:** Strong. Repeatable annual TIGER/Line release process supports future refresh governance.
- **Containment compatibility:** Promising, but not accepted until Liberty/Montgomery shared-edge and geometry validation are complete.
- **Determination:** **Strong Candidate**.

### 8.3 TxDOT Texas County Boundaries Detailed

- **Authority:** Limited for acceptance because TxDOT disclaims being the state authority for county boundary data.
- **Accuracy:** Potentially useful, but internal-purpose origin and metadata must be reviewed.
- **Geographic completeness:** Likely statewide complete polygon coverage, but Montgomery-specific validation is still required.
- **Provenance:** Partial. TxDOT publication is clear; source lineage and internal processing need capture.
- **Versioning:** Partial. Portal update metadata must be captured.
- **Freshness:** Unknown until current item update metadata is recorded.
- **Ownership:** TxDOT publishes and maintains the portal item.
- **Licensing compatibility:** Unknown until item terms are documented.
- **Maintainability:** Moderate for comparison use; weaker as primary accepted source due to authority disclaimer.
- **Containment compatibility:** Potentially useful for comparison, but not independently sufficient.
- **Determination:** **Candidate With Observations**.

### 8.4 TxDOT Texas County Boundaries Line

- **Authority:** Limited as an accepted containment source; useful as state-published edge evidence.
- **Accuracy:** Must be reviewed because digitization and line conversion can introduce edge and topology questions.
- **Geographic completeness:** Statewide line coverage likely, but not a direct polygon source.
- **Provenance:** Partial. Digitized from USGS quad maps and converted to lines, but processing details require capture.
- **Versioning:** Partial; portal metadata capture required.
- **Freshness:** Unknown without current item metadata.
- **Ownership:** TxDOT publishes the item.
- **Licensing compatibility:** Unknown until documented.
- **Maintainability:** Useful as comparison data; less maintainable as primary containment input because conversion would be required.
- **Containment compatibility:** Weak as primary source because polygon construction and validation would be needed.
- **Determination:** **Candidate With Observations**.

### 8.5 TxGIO/TNRIS Texas County Boundaries / County Map Series

- **Authority:** Moderate as a state geospatial clearinghouse; uncertain as an originating county-boundary authority.
- **Accuracy:** Not yet assessable without exact dataset metadata.
- **Geographic completeness:** Likely statewide for map products/services, but exact geometry completeness needs verification.
- **Provenance:** Insufficient. Source lineage may trace to TxDOT, Census, or map-product compilation.
- **Versioning:** Insufficient. Exact data vintage and item version are not established.
- **Freshness:** Insufficient. Current service/map update evidence must be captured.
- **Ownership:** TxGIO/TNRIS publishes or aggregates; originating ownership unresolved.
- **Licensing compatibility:** Potentially favorable, but exact dataset-level terms remain required.
- **Maintainability:** Potentially useful for corroboration; insufficient for accepted primary source until dataset identity is clarified.
- **Containment compatibility:** Unknown.
- **Determination:** **Insufficient Evidence**.

## 9. Leading Candidate Source

The leading candidate source is **U.S. Census Bureau TIGER/Line County Boundary Data for Montgomery County, Texas**.

### 9.1 Rationale

- It has the clearest source organization and stewardship model.
- It has a reproducible public download path.
- It has identifiable vintage/release information.
- It provides current county-boundary geography rather than only a derivative local open-data copy or an internal-purpose state layer.
- It is maintainable through repeated Census TIGER/Line release cycles.
- It can be compared against Montgomery County GIS, TxDOT, and TxGIO/TNRIS evidence before acceptance.

### 9.2 Assumptions

- The relevant TIGER/Line county polygon for Montgomery County, Texas can be downloaded, preserved, checksummed, and cited with an exact retrieval date.
- Census public-use terms will be compatible with Gridly documentation, review, transformation, and future storage needs.
- Geometry validation will confirm closed polygon validity and acceptable containment behavior for Gridly use.
- Liberty/Montgomery shared-edge review will not reveal material conflicts requiring a more local or survey-grade source.

### 9.3 Remaining Evidence Gaps for the Leading Candidate

- Exact download URL/file selected for the acceptance packet.
- Retrieval date and checksum.
- Dataset-level license/terms citation.
- Coordinate reference system and geometry metadata capture.
- Polygon validity and topology validation.
- Liberty/Montgomery shared-edge comparison against existing Liberty assumptions and at least one corroborating source.
- Documentation of any simplification, reprojection, clipping, or transformation steps.
- Decision on whether Census vintage is precise enough for Gridly containment near shared edges.

## 10. Evidence Still Missing

The following evidence remains missing before boundary acceptance can be considered:

- Exact candidate file or service item URL selected for acceptance review.
- Retrieval date and reviewer identity.
- Dataset checksum or equivalent integrity evidence.
- Dataset license/terms and compatibility assessment.
- Full metadata capture, including CRS, geometry type, schema, source vintage, publication date, and update date.
- Ownership/stewardship confirmation and escalation path.
- Polygon validity evidence.
- Full-county completeness evidence.
- Liberty/Montgomery shared-edge comparison.
- Comparison against at least one local or state source.
- Transformation and storage plan for any future implementation packet.
- Maintainability and future refresh procedure.
- Acceptance-review signoff criteria.

## 11. Future Acceptance Dependencies

A future boundary acceptance review depends on:

1. Selecting one specific source artifact and version.
2. Capturing source metadata and license evidence.
3. Downloading or referencing the artifact in a reproducible manner.
4. Running geometry validation and documenting results.
5. Performing Liberty/Montgomery shared-edge review.
6. Comparing the selected source against Montgomery County GIS and state-level corroborating sources.
7. Recording whether any transformations are proposed or forbidden.
8. Confirming that acceptance does not create registry, package, storage, Supabase, migration, runtime, or activation authority.
9. Producing a separate boundary acceptance decision.

## 12. Risk Review

### 12.1 Technical Risk

Technical risk is moderate until geometry validation, CRS review, topology checks, and shared-edge analysis are complete. The primary technical concern is accepting a boundary that is reproducible but not precise enough for Gridly containment near the Liberty/Montgomery edge.

### 12.2 Governance Risk

Governance risk is moderate. Census appears strongest, but local county publication and state agency datasets may differ. Acceptance must document why the chosen source is authoritative enough and why alternatives were not selected as the primary source.

### 12.3 Operational Risk

Operational risk remains low in V564 because no data is imported and no production behavior changes. Future operational risk will increase if acceptance proceeds without clear refresh, replacement, rollback, and discrepancy-handling procedures.

### 12.4 Expansion Risk

Expansion risk is moderate. The source-selection approach used for Montgomery may become precedent for future counties. If evidence standards are relaxed here, future county onboarding could inherit unclear licensing, stale geometry, or weak provenance.

## 13. Approval Separation

The following distinctions are mandatory:

```text
Evidence Collection Review
≠
Boundary Acceptance
```

```text
Boundary Acceptance
≠
Implementation Approval
```

```text
Implementation Approval
≠
Activation Approval
```

```text
Activation Approval
≠
Production Activation
```

V564 performs evidence collection review only. Any future boundary acceptance, implementation approval, activation approval, or production activation must be separately documented, separately reviewed, and separately authorized.

## 14. Final Determination

**Evidence Partially Sufficient With Observations**.

The collected evidence is sufficient to identify a leading candidate and proceed toward a future boundary acceptance review, but it is not sufficient to accept any source today. The U.S. Census Bureau TIGER/Line county boundary dataset is the leading candidate, while Montgomery County GIS, TxDOT, and TxGIO/TNRIS sources should be retained as corroborating or comparison evidence unless additional evidence elevates one of them.

## 15. Future Recommendations

1. Create a future acceptance packet centered on the current Census TIGER/Line Montgomery County boundary artifact.
2. Capture exact source URL, file name, release/vintage, retrieval date, checksum, license/terms, and metadata.
3. Download no production artifact during documentation review unless a future milestone explicitly authorizes evidence capture.
4. Compare Census geometry against Montgomery County GIS and TxDOT/TNRIS state boundary layers.
5. Perform Liberty/Montgomery shared-edge review before any implementation package is drafted.
6. Document any geometry transformations and prohibit undocumented simplification.
7. Keep boundary acceptance separate from implementation and activation milestones.
8. Preserve all historical, DriveTexas, and Transportation Intelligence protected boundaries.

## 16. Merge Recommendation

**Recommended to merge as documentation-only evidence collection.**

Merging V564 records candidate-source evidence and supports a future boundary acceptance review. It does not approve boundary acceptance, implementation, activation, registry changes, Supabase changes, storage changes, migrations, imported data, DriveTexas resumption, Transportation Intelligence, historical features, or production behavior.

## 17. Source Links Reviewed

- Montgomery County IT-GIS Hub: <https://gis.mctx.org/>
- Montgomery County GIS Open Data: <https://data-moco.opendata.arcgis.com/>
- Montgomery County GIS `USCB County Boundary 2017`: <https://data-moco.opendata.arcgis.com/datasets/MOCO::uscb-county-boundary-2017/explore>
- U.S. Census Bureau TIGER/Line Shapefiles: <https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html>
- Data.gov TIGER/Line Montgomery County, TX catalog records: <https://catalog.data.gov/dataset/tiger-line-shapefile-current-county-montgomery-county-tx-all-lines>
- TxDOT Texas County Boundaries Detailed: <https://gis-txdot.opendata.arcgis.com/datasets/TXDOT::texas-county-boundaries-detailed>
- TxDOT Texas County Boundaries Line: <https://gis-txdot.opendata.arcgis.com/datasets/texas-county-boundaries-line>
- Texas Geographic Information Office / TNRIS DataHub: <https://data.tnris.org/>
- TxGIO County Map Series: <https://geographic.texas.gov/maps.html>
- TNRIS Texas County Boundaries Mapserver preview: <https://mapserver.tnris.org/?map=%2Ftnris_mapfiles%2Fcounty_extended.map>
