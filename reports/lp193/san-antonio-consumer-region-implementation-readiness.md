# LP193 — San Antonio consumer-region implementation readiness

**Status:** `SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READINESS_OWNER_GDAL_HOLD`

**Recommendation:** `NOT_READY`

LP193 defines future contracts only; runtime behavior is untouched. Owner inputs select the fail-closed GDAL 3.13 certification path.

| Production ID | Label | Geometry | Center | Zoom | Readiness |
|---|---|---|---|---:|---|
| `central-san-antonio` | Central San Antonio | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `medical-region` | Medical Region | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `airport-fort-sam` | Airport / Fort Sam | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `stone-oak-far-north` | Stone Oak / Far North | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `utsa-northwest` | UTSA / Northwest | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `far-west-alamo-ranch` | Far West / Alamo Ranch | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `northeast-san-antonio` | Northeast San Antonio | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `southside-brooks` | Southside / Brooks | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |
| `southwest-port-san-antonio` | Southwest / Port San Antonio | OWNER_GDAL_EXECUTION_REQUIRED | pending owner GDAL | pending | IMPLEMENTATION_READINESS_HOLD |

Far Southwest is excluded. `southwest-port-san-antonio` is `PARTIAL_CERTIFIED_REGION_PENDING_FAR_SOUTHWEST_CLARIFICATION`; Somerset 4868708 and Von Ormy 4875764 remain independent.

## Owner execution

```powershell
$env:PATH = 'C:\Program Files\QGIS 3.44.11\bin;' + $env:PATH
$env:GRIDLY_GDAL_BIN = 'C:\Program Files\QGIS 3.44.11\bin'
$env:GRIDLY_SA_TOMORROW_GEOJSON = 'C:\GitHub\Gridly-Source-Data\SanAntonio\SATomorrow\SATomorrowSubAreaPlans-CoSAGIS-Opendata.geojson'
npm run build:lp193
npm run verify:lp193
npm run test:lp193
```
