# LP193 — San Antonio consumer-region implementation readiness

**Status:** `SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READINESS_OWNER_GDAL_HOLD`  
**Recommendation:** `NOT_READY`

LP193 defines production identities and future contracts only. Runtime behavior is untouched. Geometry certification remains fail-closed until the governed owner source is processed with GDAL 3.13.0.

| Production ID | Label | Atomic membership | Geometry | Center | Zoom | Readiness |
|---|---|---|---|---|---:|---|
| `central-san-antonio` | Central San Antonio | Downtown; Eastside; Midtown; Near North; Westside | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `medical-region` | Medical Region | Medical Center; Near Northwest; North Central | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `airport-fort-sam` | Airport / Fort Sam | Fort Sam Houston; Greater Airport Area; Near Northeast | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `stone-oak-far-north` | Stone Oak / Far North | Far North; Stone Oak | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `utsa-northwest` | UTSA / Northwest | Northwest; UTSA; West Northwest | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `far-west-alamo-ranch` | Far West / Alamo Ranch | Far West; Highway 151 and Loop 1604 | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `northeast-san-antonio` | Northeast San Antonio | Far East; NE I-35 and Loop 410; Northeast; Rolling Oaks | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `southside-brooks` | Southside / Brooks | Brooks; Far South; South; Southeast; Texas AM - San Antonio | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `southwest-port-san-antonio` | Southwest / Port San Antonio | Port San Antonio; Southwest | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |

## Contracts

- Awareness: all nine may eventually be selectable; every independent PLACE/CDP remains excluded and `INDEPENDENT_GOVERNED_PLACE_WINS`.
- Search/ZIP: INDEPENDENT_GOVERNED_PLACE_CDP_IDENTITY → EXACT_GOVERNED_COMMUNITY_IDENTITY → SAN_ANTONIO_CONSUMER_REGION_PROJECTION_FROM_GOVERNED_ATOMIC_GEOGRAPHY → BROADER_FALLBACK_BEHAVIOR. No ZIP mapping was created.
- Far Southwest: `PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION`. Southwest / Port San Antonio is limited to Port San Antonio and Southwest; wording must not imply Far Southwest coverage. Somerset and Von Ormy remain independent and held.
- Geometry: West Northwest must use `CERTIFIED_DERIVED_MAKEVALID`; Far Southwest must never enter the union.

## Owner execution

```powershell
$env:PATH = 'C:\Program Files\QGIS 3.44.11\bin;' + $env:PATH
$env:GRIDLY_GDAL_BIN = 'C:\Program Files\QGIS 3.44.11\bin'
$env:GRIDLY_SA_TOMORROW_GEOJSON = 'C:\GitHub\Gridly-Source-Data\SanAntonio\SATomorrow\SATomorrowSubAreaPlans-CoSAGIS-Opendata.geojson'
npm run build:lp193
npm run verify:lp193
npm run test:lp193
```
