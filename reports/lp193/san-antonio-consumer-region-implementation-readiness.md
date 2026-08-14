# LP193 — San Antonio consumer-region implementation readiness

**Status:** `SAN_ANTONIO_CONSUMER_REGION_IMPLEMENTATION_READY_NOT_ACTIVATED_WITH_SELECTIVE_FAR_SOUTHWEST_LIMITATION`

**Recommendation:** `READY_FOR_GUARDED_SAN_ANTONIO_RUNTIME_ACTIVATION`

LP193 defines future contracts only; runtime behavior is untouched. Owner inputs select the fail-closed GDAL 3.13 certification path.

| Production ID | Label | Geometry | Center | Zoom | Readiness |
|---|---|---|---|---:|---|
| `central-san-antonio` | Central San Antonio | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.52110359096712,"latitude":29.43715940524094,"status":"INSIDE_OR_ON_REGION"} | 11.16 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `medical-region` | Medical Region | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.51516602675414,"latitude":29.495636300789577,"status":"INSIDE_OR_ON_REGION"} | 11.36 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `airport-fort-sam` | Airport / Fort Sam | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.44027413969336,"latitude":29.502531081732176,"status":"INSIDE_OR_ON_REGION"} | 11.03 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `stone-oak-far-north` | Stone Oak / Far North | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.49512037206648,"latitude":29.610029480200975,"status":"INSIDE_OR_ON_REGION"} | 11.22 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `utsa-northwest` | UTSA / Northwest | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.61471921652927,"latitude":29.591886635851893,"status":"INSIDE_OR_ON_REGION"} | 10.69 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `far-west-alamo-ranch` | Far West / Alamo Ranch | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.65764791813613,"latitude":29.435772836272815,"status":"INSIDE_OR_ON_REGION"} | 11.66 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `northeast-san-antonio` | Northeast San Antonio | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.40784840163508,"latitude":29.581475901424064,"status":"INSIDE_OR_ON_REGION"} | 10.67 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `southside-brooks` | Southside / Brooks | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.50839898231199,"latitude":29.295473924732278,"status":"INSIDE_OR_ON_REGION"} | 10.77 | IMPLEMENTATION_READY_NOT_ACTIVATED |
| `southwest-port-san-antonio` | Southwest / Port San Antonio | CERTIFIED_VALID_NON_EMPTY_UNION | {"method":"GDAL_ST_POINTONSURFACE_EPSG3083_TO_WGS84","longitude":-98.57515605724419,"latitude":29.36192203964279,"status":"INSIDE_OR_ON_REGION"} | 11.27 | IMPLEMENTATION_READY_NOT_ACTIVATED_WITH_FAR_SOUTHWEST_LIMITATION |

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
