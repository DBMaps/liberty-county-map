# Metro Child-Area Evidence & Governance Audit

## 1. Governance

- auditOnly: **true**
- productionChangeAuthorized: **false**
- regionalizationImplementationAuthorized: **false**
- childRegionCreationAuthorized: **false**

## 2. Houston reference/control

Houston PLACE 4835000 remains selectable and coexists with 15 governed child awareness identities.
The child records use semantic centers, startup zooms, `parentCity: Houston`, `countyId: harris-tx`, five-mile awareness radii, and canonical `houston-*` IDs. Explicit child selection selects the child; Houston-wide storage remains parent mode; independently owned Harris communities are excluded and retain precedence.

## 3. Sources inspected

- **AVAILABLE** `js/app.js` — Houston runtime model, awareness conversion, selector/search aliases, precedence and camera consumption
- **AVAILABLE** `data/generated/gridly-statewide-consumer-community-projection-v1.json` — Canonical PLACE identities and county memberships
- **AVAILABLE** `reports/texas-metro-regionalization-candidate-audit.json` — Prior audit artifact; mission-supplied completed classifications control where checkout artifact is blocked/stale
- **AVAILABLE** `reports/texas-metro-regionalization-candidate-audit.md` — Prior audit narrative
- **UNAVAILABLE** `reports/statewide-place-presentation-geometry-audit.json` — Authoritative optional presentation geometry evidence
- **UNAVAILABLE** `reports/statewide-place-presentation-geometry-audit.md` — Authoritative optional presentation geometry narrative
- **AVAILABLE** `tests/lp035-1-houston-regionalization-implementation.test.js` — Identity, selection, camera, ZIP, or Houston governance validation
- **AVAILABLE** `tests/lp036-1-passive-location-resolution.test.js` — Identity, selection, camera, ZIP, or Houston governance validation
- **AVAILABLE** `tests/lp038-regional-weather-authority-certification.test.js` — Identity, selection, camera, ZIP, or Houston governance validation
- **AVAILABLE** `tests/statewide-consumer-zip-resolver.test.mjs` — Identity, selection, camera, ZIP, or Houston governance validation
- **AVAILABLE** `tests/statewide-home-area-map-focus.test.mjs` — Identity, selection, camera, ZIP, or Houston governance validation
- **AVAILABLE** `tests/semantic-place-countywide-camera-contract.test.mjs` — Identity, selection, camera, ZIP, or Houston governance validation

## 4. Evidence classification policy

- **GOVERNED_RUNTIME** — Active production registry or behavior with governing validation.
- **GOVERNED_GENERATED** — Deterministic generated artifact with established canonical provenance.
- **GOVERNED_AUDIT_EVIDENCE** — Controlled audit result; evidence, not runtime authority.
- **HISTORICAL_REPOSITORY_EVIDENCE** — Superseded or removed repository-controlled design evidence.
- **OWNER_APPROVED_NON_RUNTIME** — Explicit owner approval not promoted to runtime governance.
- **UNVERIFIED_LEGACY** — Legacy identity-bearing material without recoverable authority.

## 5. Metro summary table

| Metro | Previous regionalization classification | Evidence readiness | Existing candidates | Governed | Historical | Naming authority | Center authority | Boundary authority | Architecture |
|---|---|---|---:|---:|---:|---|---|---|---|
| San Antonio | REGIONALIZE_LIKE_HOUSTON | GOVERNED_CHILD_DEFINITION_REQUIRED | 0 | 0 | 0 | CHILD_REGION_NAMES_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_CENTERS_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_BOUNDARIES_REQUIRE_GOVERNED_SOURCE | HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION |
| Corpus Christi | REGIONALIZE_LIKE_HOUSTON | GOVERNED_CHILD_DEFINITION_REQUIRED | 0 | 0 | 0 | CHILD_REGION_NAMES_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_CENTERS_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_BOUNDARIES_REQUIRE_GOVERNED_SOURCE | HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION |
| Austin | REVIEW | INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION | 0 | 0 | 0 | CHILD_REGION_NAMES_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_CENTERS_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_BOUNDARIES_REQUIRE_GOVERNED_SOURCE | HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION |
| Dallas | REVIEW | INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION | 0 | 0 | 0 | CHILD_REGION_NAMES_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_CENTERS_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_BOUNDARIES_REQUIRE_GOVERNED_SOURCE | HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION |
| Fort Worth | REVIEW | INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION | 0 | 0 | 0 | CHILD_REGION_NAMES_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_CENTERS_REQUIRE_GOVERNED_SOURCE | CHILD_REGION_BOUNDARIES_REQUIRE_GOVERNED_SOURCE | HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION |

## 6. San Antonio detail

- Evidence readiness: **GOVERNED_CHILD_DEFINITION_REQUIRED**
- Natural structure: **NOT_ESTABLISHED_BY_REPOSITORY_EVIDENCE**
- Candidate child areas: **none found**
- Rationale: Prior scale/presentation classification supports a future regionalization inquiry, but it supplies no governed child identities.
- Independently governed central-county PLACEs that retain precedence:
  - Alamo Heights (4801600; INCORPORATED_PLACE)
  - Balcones Heights (4805384; INCORPORATED_PLACE)
  - Castle Hills (4813276; INCORPORATED_PLACE)
  - China Grove (4814716; INCORPORATED_PLACE)
  - Cibolo (4814920; INCORPORATED_PLACE)
  - Converse (4816468; INCORPORATED_PLACE)
  - Cross Mountain (4817811; CENSUS_DESIGNATED_PLACE)
  - Elmendorf (4823272; INCORPORATED_PLACE)
  - Fair Oaks Ranch (4825168; INCORPORATED_PLACE)
  - Grey Forest (4831100; INCORPORATED_PLACE)
  - Helotes (4833146; INCORPORATED_PLACE)
  - Hill Country Village (4833968; INCORPORATED_PLACE)
  - Hollywood Park (4834628; INCORPORATED_PLACE)
  - Kirby (4839448; INCORPORATED_PLACE)
  - Lackland AFB (4840036; CENSUS_DESIGNATED_PLACE)
  - Leon Valley (4842388; INCORPORATED_PLACE)
  - Live Oak (4843096; INCORPORATED_PLACE)
  - Lytle (4845288; INCORPORATED_PLACE)
  - Macdona (4845576; CENSUS_DESIGNATED_PLACE)
  - Olmos Park (4853988; INCORPORATED_PLACE)
  - Randolph AFB (4860608; CENSUS_DESIGNATED_PLACE)
  - Sandy Oaks (4865344; INCORPORATED_PLACE)
  - Scenic Oaks (4866089; CENSUS_DESIGNATED_PLACE)
  - Schertz (4866128; INCORPORATED_PLACE)
  - Selma (4866704; INCORPORATED_PLACE)
  - Shavano Park (4867268; INCORPORATED_PLACE)
  - Somerset (4868708; INCORPORATED_PLACE)
  - St. Hedwig (4864172; INCORPORATED_PLACE)
  - Terrell Hills (4872296; INCORPORATED_PLACE)
  - Timberwood Park (4873057; CENSUS_DESIGNATED_PLACE)
  - Universal City (4874408; INCORPORATED_PLACE)
  - Von Ormy (4875764; INCORPORATED_PLACE)
  - Windcrest (4879672; INCORPORATED_PLACE)
- Governance gaps:
  - child-region naming authority
  - region boundaries or an explicit governed no-boundary/radius model
  - representative semantic centers
  - parent-child identity and canonical-ID policy
  - overlap/precedence policy for incorporated places and CDPs
  - ZIP-to-region mapping or an explicit decision not to use ZIP mapping
  - awareness radius
  - startup zoom
  - owner approval

## 7. Corpus Christi detail

- Evidence readiness: **GOVERNED_CHILD_DEFINITION_REQUIRED**
- Natural structure: **NOT_ESTABLISHED_BY_REPOSITORY_EVIDENCE**
- Candidate child areas: **none found**
- Rationale: Prior scale/presentation classification supports a future regionalization inquiry, but it supplies no governed child identities.
- Independently governed central-county PLACEs that retain precedence:
  - Agua Dulce (4801396; INCORPORATED_PLACE)
  - Aransas Pass (4803600; INCORPORATED_PLACE)
  - Banquete (4805576; CENSUS_DESIGNATED_PLACE)
  - Bishop (4808392; INCORPORATED_PLACE)
  - Driscoll (4821436; INCORPORATED_PLACE)
  - Ingleside (4836008; INCORPORATED_PLACE)
  - La Paloma-Lost Creek (4841422; CENSUS_DESIGNATED_PLACE)
  - North San Pedro (4852404; CENSUS_DESIGNATED_PLACE)
  - Petronila (4857056; INCORPORATED_PLACE)
  - Port Aransas (4858808; INCORPORATED_PLACE)
  - Portland (4858904; INCORPORATED_PLACE)
  - Rancho Banquete (4860529; CENSUS_DESIGNATED_PLACE)
  - Robstown (4862600; INCORPORATED_PLACE)
  - Sandy Hollow-Escondidas (4865342; CENSUS_DESIGNATED_PLACE)
  - Spring Gardens (4869708; CENSUS_DESIGNATED_PLACE)
  - Tierra Grande (4872952; CENSUS_DESIGNATED_PLACE)
  - Tierra Verde (4872954; CENSUS_DESIGNATED_PLACE)
- Governance gaps:
  - child-region naming authority
  - region boundaries or an explicit governed no-boundary/radius model
  - representative semantic centers
  - parent-child identity and canonical-ID policy
  - overlap/precedence policy for incorporated places and CDPs
  - ZIP-to-region mapping or an explicit decision not to use ZIP mapping
  - awareness radius
  - startup zoom
  - owner approval

## 8. Austin detail

- Evidence readiness: **INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION**
- Natural structure: **NOT_ESTABLISHED_BY_REPOSITORY_EVIDENCE**
- Candidate child areas: **none found**
- Rationale: The REVIEW classification is not child-area evidence; no governed or historical child identities were found.
- Independently governed central-county PLACEs that retain precedence:
  - Barton Creek (4805750; CENSUS_DESIGNATED_PLACE)
  - Bee Cave (4807156; INCORPORATED_PLACE)
  - Briarcliff (4810197; INCORPORATED_PLACE)
  - Cedar Park (4813552; INCORPORATED_PLACE)
  - Creedmoor (4817612; INCORPORATED_PLACE)
  - Elgin (4823044; INCORPORATED_PLACE)
  - Garfield (4828320; CENSUS_DESIGNATED_PLACE)
  - Hornsby Bend (4834856; CENSUS_DESIGNATED_PLACE)
  - Hudson Bend (4835253; CENSUS_DESIGNATED_PLACE)
  - Jonestown (4838020; INCORPORATED_PLACE)
  - Lago Vista (4840264; INCORPORATED_PLACE)
  - Lakeway (4840984; INCORPORATED_PLACE)
  - Leander (4842016; INCORPORATED_PLACE)
  - Lost Creek (4844162; CENSUS_DESIGNATED_PLACE)
  - Manchaca (4846308; CENSUS_DESIGNATED_PLACE)
  - Manor (4846440; INCORPORATED_PLACE)
  - Mustang Ridge (4850200; INCORPORATED_PLACE)
  - Pflugerville (4857176; INCORPORATED_PLACE)
  - Point Venture (4858586; INCORPORATED_PLACE)
  - Rollingwood (4863008; INCORPORATED_PLACE)
  - Round Rock (4863500; INCORPORATED_PLACE)
  - San Leanna (4865552; INCORPORATED_PLACE)
  - Shady Hollow (4867082; CENSUS_DESIGNATED_PLACE)
  - Steiner Ranch (4870154; CENSUS_DESIGNATED_PLACE)
  - Sunset Valley (4871324; INCORPORATED_PLACE)
  - The Hills (4872578; INCORPORATED_PLACE)
  - Volente (4875752; INCORPORATED_PLACE)
  - Webberville (4876924; INCORPORATED_PLACE)
  - Wells Branch (4877196; CENSUS_DESIGNATED_PLACE)
  - West Lake Hills (4877632; INCORPORATED_PLACE)
- Governance gaps:
  - child-region naming authority
  - region boundaries or an explicit governed no-boundary/radius model
  - representative semantic centers
  - parent-child identity and canonical-ID policy
  - overlap/precedence policy for incorporated places and CDPs
  - ZIP-to-region mapping or an explicit decision not to use ZIP mapping
  - awareness radius
  - startup zoom
  - owner approval

## 9. Dallas detail

- Evidence readiness: **INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION**
- Natural structure: **NOT_ESTABLISHED_BY_REPOSITORY_EVIDENCE**
- Candidate child areas: **none found**
- Rationale: The REVIEW classification is not child-area evidence; no governed or historical child identities were found.
- Independently governed central-county PLACEs that retain precedence:
  - Addison (4801240; INCORPORATED_PLACE)
  - Balch Springs (4805372; INCORPORATED_PLACE)
  - Bear Creek Ranch (4806244; CENSUS_DESIGNATED_PLACE)
  - Carrollton (4813024; INCORPORATED_PLACE)
  - Cedar Hill (4813492; INCORPORATED_PLACE)
  - Cockrell Hill (4815796; INCORPORATED_PLACE)
  - Combine (4816216; INCORPORATED_PLACE)
  - Coppell (4816612; INCORPORATED_PLACE)
  - DeSoto (4820092; INCORPORATED_PLACE)
  - Duncanville (4821628; INCORPORATED_PLACE)
  - Farmers Branch (4825452; INCORPORATED_PLACE)
  - Ferris (4825752; INCORPORATED_PLACE)
  - Garland (4829000; INCORPORATED_PLACE)
  - Glenn Heights (4829840; INCORPORATED_PLACE)
  - Grand Prairie (4830464; INCORPORATED_PLACE)
  - Grapevine (4830644; INCORPORATED_PLACE)
  - Highland Park (4833824; INCORPORATED_PLACE)
  - Hutchins (4835612; INCORPORATED_PLACE)
  - Irving (4837000; INCORPORATED_PLACE)
  - Lancaster (4841212; INCORPORATED_PLACE)
  - Lewisville (4842508; INCORPORATED_PLACE)
  - Mesquite (4847892; INCORPORATED_PLACE)
  - Ovilla (4854444; INCORPORATED_PLACE)
  - Richardson (4861796; INCORPORATED_PLACE)
  - Rowlett (4863572; INCORPORATED_PLACE)
  - Sachse (4864064; INCORPORATED_PLACE)
  - Seagoville (4866428; INCORPORATED_PLACE)
  - Sunnyvale (4871156; INCORPORATED_PLACE)
  - University Park (4874492; INCORPORATED_PLACE)
  - Wilmer (4879576; INCORPORATED_PLACE)
  - Wylie (4880356; INCORPORATED_PLACE)
- Governance gaps:
  - child-region naming authority
  - region boundaries or an explicit governed no-boundary/radius model
  - representative semantic centers
  - parent-child identity and canonical-ID policy
  - overlap/precedence policy for incorporated places and CDPs
  - ZIP-to-region mapping or an explicit decision not to use ZIP mapping
  - awareness radius
  - startup zoom
  - owner approval

## 10. Fort Worth detail

- Evidence readiness: **INSUFFICIENT_EVIDENCE_FOR_REGIONALIZATION**
- Natural structure: **NOT_ESTABLISHED_BY_REPOSITORY_EVIDENCE**
- Candidate child areas: **none found**
- Rationale: The REVIEW classification is not child-area evidence; no governed or historical child identities were found.
- Independently governed central-county PLACEs that retain precedence:
  - Arlington (4804000; INCORPORATED_PLACE)
  - Azle (4805168; INCORPORATED_PLACE)
  - Bedford (4807132; INCORPORATED_PLACE)
  - Benbrook (4807552; INCORPORATED_PLACE)
  - Blue Mound (4808860; INCORPORATED_PLACE)
  - Briar (4810192; CENSUS_DESIGNATED_PLACE)
  - Burleson (4811428; INCORPORATED_PLACE)
  - Colleyville (4815988; INCORPORATED_PLACE)
  - Crowley (4817960; INCORPORATED_PLACE)
  - Dalworthington Gardens (4819084; INCORPORATED_PLACE)
  - Edgecliff Village (4822588; INCORPORATED_PLACE)
  - Euless (4824768; INCORPORATED_PLACE)
  - Everman (4824912; INCORPORATED_PLACE)
  - Flower Mound (4826232; INCORPORATED_PLACE)
  - Forest Hill (4826544; INCORPORATED_PLACE)
  - Grand Prairie (4830464; INCORPORATED_PLACE)
  - Grapevine (4830644; INCORPORATED_PLACE)
  - Haltom City (4831928; INCORPORATED_PLACE)
  - Haslet (4832720; INCORPORATED_PLACE)
  - Hurst (4835576; INCORPORATED_PLACE)
  - Keller (4838632; INCORPORATED_PLACE)
  - Kennedale (4838896; INCORPORATED_PLACE)
  - Lake Worth (4841056; INCORPORATED_PLACE)
  - Lakeside (4840744; INCORPORATED_PLACE)
  - Mansfield (4846452; INCORPORATED_PLACE)
  - Newark (4850772; INCORPORATED_PLACE)
  - North Richland Hills (4852356; INCORPORATED_PLACE)
  - Pantego (4855020; INCORPORATED_PLACE)
  - Pecan Acres (4856462; CENSUS_DESIGNATED_PLACE)
  - Pelican Bay (4856640; INCORPORATED_PLACE)
  - Rendon (4861568; CENSUS_DESIGNATED_PLACE)
  - Reno (4861604; INCORPORATED_PLACE)
  - Richland Hills (4861844; INCORPORATED_PLACE)
  - River Oaks (4862384; INCORPORATED_PLACE)
  - Roanoke (4862504; INCORPORATED_PLACE)
  - Saginaw (4864112; INCORPORATED_PLACE)
  - Sansom Park (4865660; INCORPORATED_PLACE)
  - Southlake (4869032; INCORPORATED_PLACE)
  - Trophy Club (4873710; INCORPORATED_PLACE)
  - Watauga (4876672; INCORPORATED_PLACE)
  - Westlake (4877620; INCORPORATED_PLACE)
  - Westover Hills (4877788; INCORPORATED_PLACE)
  - Westworth Village (4878076; INCORPORATED_PLACE)
  - White Settlement (4878544; INCORPORATED_PLACE)
- Governance gaps:
  - child-region naming authority
  - region boundaries or an explicit governed no-boundary/radius model
  - representative semantic centers
  - parent-child identity and canonical-ID policy
  - overlap/precedence policy for incorporated places and CDPs
  - ZIP-to-region mapping or an explicit decision not to use ZIP mapping
  - awareness radius
  - startup zoom
  - owner approval

## 11. Existing-community collision/precedence analysis

Every community enumerated above is governed as its own Census PLACE identity. County membership is not evidence that it is a metro child; future overlap must preserve that identity.

## 12. Governance gaps

All five metros lack governed child names, centers, boundaries/radius strategy, ZIP policy, parent-child policy, and owner approval.

## 13. Architecture-reuse assessment

- **San Antonio: HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION** — the Houston mechanics appear reusable, but hard-coded Houston naming and flags require a separately authorized metro-neutral contract.
- **Corpus Christi: HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION** — the Houston mechanics appear reusable, but hard-coded Houston naming and flags require a separately authorized metro-neutral contract.
- **Austin: HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION** — the Houston mechanics appear reusable, but hard-coded Houston naming and flags require a separately authorized metro-neutral contract.
- **Dallas: HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION** — the Houston mechanics appear reusable, but hard-coded Houston naming and flags require a separately authorized metro-neutral contract.
- **Fort Worth: HOUSTON_ARCHITECTURE_REUSABLE_WITH_GENERALIZATION** — the Houston mechanics appear reusable, but hard-coded Houston naming and flags require a separately authorized metro-neutral contract.

## 14. Recommended next-stage sequencing

1. Obtain a governed naming and identity source for San Antonio and Corpus Christi before design work.
2. Govern overlap/precedence policy against the enumerated Bexar and Nueces County PLACE identities.
3. Only after names are governed, govern centers, boundaries/radius strategy, startup zoom, ZIP policy, and owner approval.
4. Keep Austin, Dallas, and Fort Worth in evidence research/review; do not begin child design from current repository evidence.
5. Authorize and design a metro-neutral generalization of Houston only in a separate implementation milestone.

## 15. Explicit limitations

- No child-area candidate is reported from general geographic knowledge.
- County-membership PLACE records are collision/precedence evidence, not proposed metro children.
- The optional statewide presentation geometry reports are absent in this checkout; no geometry conclusion is fabricated.
- The checked-in prior audit is blocked/stale relative to the completed classifications supplied in the audit mission; the mission classifications are recorded without treating them as child evidence.
- Houston geometryStrategy text describes intended seed/source strategies, but no governed child polygons were found; centers and five-mile awareness radii drive current selection behavior.
- Scoped repository text and targeted history checks found no governed or historical child definitions for the five metros.
