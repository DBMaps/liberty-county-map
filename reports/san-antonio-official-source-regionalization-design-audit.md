# San Antonio official-source regionalization design audit

## 1. Governance

- auditOnly: **true**
- runtimeChangeAuthorized: **false**
- regionalizationImplementationAuthorized: **false**
- productionChildRegionsCreated: **false**

## 2. Executive finding

**OFFICIAL_SOURCE_PARTIALLY_READY_GAPS_EXIST**; regionalizationStillJustified: **true**. The City/SA Tomorrow 13-Regional-Center plus 17-Community-Area framework is the correct authority family, but no version-pinned, licensed, machine-readable Community Area geometry and complete official name/ID registry was certified. Design may proceed only after source acquisition; production identities may not.

## 3. Official sources discovered

| Rank | Exact title | Owner | Type | Geometry | Deterministic use |
|---:|---|---|---|---|---|
| 1 | City of San Antonio GIS | City of San Antonio | official GIS portal | POTENTIALLY_AVAILABLE_NOT_ACQUIRED | NOT_YET |
| 1 | City of San Antonio ArcGIS Online organization | City of San Antonio | official ArcGIS organization | ITEM_DEPENDENT | NOT_YET |
| 2 | SA Tomorrow Area Planning | City of San Antonio Planning Department | official planning program | MAPS_PUBLISHED; MACHINE_READABLE_LAYER_NOT_CERTIFIED | PLANNING_AUTHORITY_YES; GEOMETRY_INPUT_NO |
| 3 | SA Tomorrow Comprehensive Plan | City of San Antonio | official comprehensive-planning framework | CONCEPTUAL_MAPS; GIS LAYER_NOT_CERTIFIED | CONTEXT_ONLY_UNTIL_VERSION_CERTIFIED |
| 4 | City of San Antonio Planning Department — Comprehensive Planning | City of San Antonio Planning Department | official departmental publication index | NO_SINGLE_LAYER | DISCOVERY_ONLY |

- [City of San Antonio GIS](https://gis.sanantonio.gov/) — format: web GIS; service/layer endpoint not certified; status: current portal; layer publication/update status not certified; coverage: City of San Antonio; count: not certified; IDs: not certified; download: not certified; archive: not certified; terms: NOT_VERIFIED.
- [City of San Antonio ArcGIS Online organization](https://cosagis.maps.arcgis.com/home/index.html) — format: ArcGIS Online items and services; status: current organization; candidate item identity not certified; coverage: varies by item; count: not certified; IDs: not certified; download: not certified; archive: not certified; terms: ITEM_TERMS_NOT_VERIFIED.
- [SA Tomorrow Area Planning](https://www.sanantonio.gov/Planning/PlanningUrbanDesign/ComprehensivePlanning/SA-Tomorrow-Area-Planning) — format: web pages and adopted plan documents; status: active program; individual plan adoption/version varies; coverage: 30 sub-areas planned citywide: 13 Regional Centers and 17 Community Areas; count: 30; IDs: not certified; download: not certified; archive: adoption documents may carry ordinance/version identity; not inventoried here; terms: PUBLICATION_ACCESS_CONFIRMED; REUSE_TERMS_NOT_VERIFIED.
- [SA Tomorrow Comprehensive Plan](https://satomorrow.com/) — format: web and planning documents; status: adopted framework; exact current document/version must be certified; coverage: San Antonio comprehensive-plan geography; count: not certified; IDs: not certified; download: not certified; archive: adoption/version identity requires acquisition; terms: NOT_VERIFIED.
- [City of San Antonio Planning Department — Comprehensive Planning](https://www.sanantonio.gov/Planning/PlanningUrbanDesign/ComprehensivePlanning) — format: web and linked documents; status: current landing page; coverage: San Antonio; count: not certified; IDs: not certified; download: not certified; archive: not certified; terms: NOT_VERIFIED.

## 4. Source authority ranking

City GIS/ArcGIS layer metadata ranks first, Planning Department publications second, SA Tomorrow framework documents third, and other City publications fourth. A specific layer cannot become manufacturing authority until its identity and terms are certified.

## 5. SA Tomorrow framework findings

The official framework has **13 Regional Centers** and **17 Community Areas** (30 plan geographies). Regional Centers are focused nodes/plan areas, do not cover the whole city, and should not be broad child boundaries. Their exact recorded names are: Brooks; Downtown; Fort Sam Houston; Greater Airport Area; Highway 151 and Loop 1604; Medical Center; Midtown; Northeast I-35 and Loop 410; Port San Antonio; Rolling Oaks; Stone Oak; Texas A&M-San Antonio; UTSA. Community Areas are the better atomic broad-area candidate, but a complete official name/ID registry and polygon partition were not certified; therefore this report invents no Community Area names. Overlap, gaps, and combined coverage remain geometric questions.

## 6. Official GIS availability

Official portals exist, but no service/layer endpoint or export was certified. CRS, geometry type, feature count, byte length, SHA-256, update metadata, and license therefore remain null—not guessed.

## 7. Consumer-reference comparison

[Maps San Antonio regions](https://mapssanantonio.com/regions/) is explicitly **non-authoritative**. Its directional concepts suggest that fewer broad selections may be understandable, but do not govern identity. Alamo Heights and Schertz/Cibolo/Universal City are independent PLACE identities; Lackland and Randolph correspond to governed CDPs; Fort Sam Houston is also an official Regional Center name; Harlandale, Judson, Edgewood, and South San Antonio are not certified here as City child geographies; Floresville is not a San Antonio child.

## 8. Independent Bexar PLACE/CDP precedence

Policy: **INDEPENDENT_GOVERNED_PLACE_WINS**. All 33 exact repository-governed identities follow. Spatial categories are deliberately unknown until overlay analysis.

- Alamo Heights (4801600; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Balcones Heights (4805384; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Castle Hills (4813276; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- China Grove (4814716; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Cibolo (4814920; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Converse (4816468; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Cross Mountain (4817811; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Elmendorf (4823272; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Fair Oaks Ranch (4825168; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Grey Forest (4831100; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Helotes (4833146; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Hill Country Village (4833968; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Hollywood Park (4834628; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Kirby (4839448; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Lackland AFB (4840036; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Leon Valley (4842388; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Live Oak (4843096; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Lytle (4845288; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Macdona (4845576; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Olmos Park (4853988; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Randolph AFB (4860608; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Sandy Oaks (4865344; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Scenic Oaks (4866089; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Schertz (4866128; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Selma (4866704; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Shavano Park (4867268; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Somerset (4868708; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- St. Hedwig (4864172; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Terrell Hills (4872296; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Timberwood Park (4873057; CENSUS_DESIGNATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Universal City (4874408; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Von Ormy (4875764; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**
- Windcrest (4879672; INCORPORATED_PLACE) — relationship/overlap: not determined; **INDEPENDENT_GOVERNED_PLACE_WINS**

## 9. Geometry suitability

Status: **NOT_AUDITABLE_WITHOUT_CERTIFIED_LAYER**. CRS/type/validity/multipart/overlap/gaps/city correspondence/partition/outside-city and independent-community overlays were not tested because no layer was certified.

## 10. Gridly model alternatives

- **MODEL_A_DIRECT_OFFICIAL_AREAS** — selections: 17 Community Areas if certified; clarity: MEDIUM_LOW; defensibility: HIGH_AFTER_CERTIFICATION; Houston compatibility: PARTIAL.
- **MODEL_B_GOVERNED_CONSOLIDATION** — selections: approximately 8–12; clarity: HIGH_IF_OWNER_APPROVED; defensibility: HIGH_IF_CROSSWALK_IS_DETERMINISTIC; Houston compatibility: HIGH_AFTER_GENERALIZATION.
- **MODEL_C_HYBRID** — selections: approximately 8–12 consolidated areas; clarity: HIGH; defensibility: HIGHEST: Community Areas govern extents; official Regional Centers inform centers/labels; Houston compatibility: HIGH_AFTER_GENERALIZATION.
- **MODEL_D_UNSUITABLE** — selections: none; clarity: N/A; defensibility: LOW GIVEN EXISTING OFFICIAL FRAMEWORK; Houston compatibility: N/A.

## 11. Recommended model

**MODEL C — HYBRID**, design-only: certified Community Areas as atomic polygon authority, deterministic consolidation, Regional Centers as optional official center/label evidence, and independent PLACE/CDP precedence.

## 12. Recommended target child-count range

**8–12, approximate and not final.** Seventeen direct areas may overwhelm; this range preserves useful local differentiation without copying Houston's 15.

## 13. Naming governance strategy

Names must come from the certified official area registry or an owner-approved deterministic crosswalk whose inputs and rationale are versioned; consumer-reference terms cannot self-authorize.

## 14. Semantic-center governance strategy

Fallback order: official Regional Center geometry representative point when one is uniquely assigned by an approved crosswalk → projected polygon centroid only when contained → polygon point-on-surface. No coordinates are selected here.

## 15. Boundary/radius strategy

**HYBRID_POLYGON_IDENTITY_CENTER_RADIUS_PRESENTATION**: polygons govern identity/resolution; a governed center and separately validated radius/zoom govern presentation.

## 16. Houston architecture compatibility

**HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION**. Reuse product principles, not Houston IDs, names, count, flags, or fixed-radius assumptions.

## 17. Required future generalization

- metro-neutral parent/child identity contract
- polygon-aware resolution contract
- independent PLACE/CDP precedence before child resolution
- source-version metadata for manufactured children

## 18. Remaining governance gaps

- exact current Community Area names and stable identifiers
- ArcGIS REST item/service/layer identity
- download/export permission and reuse terms
- publication/update/version/archive identity
- polygon CRS, count, validity, gaps, overlaps, multipart behavior and city-limit correspondence
- per-PLACE/CDP spatial relationship and planning overlap
- deterministic Community Area consolidation crosswalk
- owner-approved names, exact count, centers, zoom/radius

## 19. Recommended next-stage milestone

Acquire and certify the official City Community Area and Regional Center GIS layers and adopted-plan registry; pin service/item/layer IDs, export bytes and SHA-256, terms, versions, names/IDs, CRS and feature counts; then run geometry topology and PLACE/CDP overlay analysis and propose (not implement) an owner-reviewable consolidation crosswalk.

Governance chain: OFFICIAL_CITY_GIS_LAYER_ACQUISITION → SOURCE_IDENTITY_AND_USE_TERMS_CERTIFICATION → OFFICIAL_AREA_NAME_ID_GEOMETRY_REGISTRY → GEOMETRY_VALIDATION_AND_CITY_LIMIT_COMPARISON → DETERMINISTIC_CONSOLIDATION_CROSSWALK → INDEPENDENT_GOVERNED_PLACE_WINS → CHILD_IDENTITY_AND_NAME_REVIEW → SEMANTIC_CENTER_MANUFACTURING → OWNER_APPROVAL → SEPARATELY_AUTHORIZED_RUNTIME_IMPLEMENTATION.

## 20. Explicit limitations

- Network access to official hosts was unavailable in the execution environment; URLs are recorded but live layer metadata was not silently inferred.
- No Community Area name is emitted without a certified official registry.
- Regional Center names represent the official 13-center framework; spelling/version must be revalidated during source identity certification.
- No external geometry was downloaded, so no topology or spatial-relationship claim is made.
- The consumer reference is comparison evidence only.
- No runtime, app.js, awareness, semantic-camera, PLACE target, Houston, or production-boundary change is authorized or made.

Owner execution required: **true**, solely for official source capture/certification; no production execution is authorized.
