[CmdletBinding()]
param(
    [string]$PlaceSource = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\PLACE\derived\tl_2025_48_place.shp',
    [string]$CountySource = 'C:\GitHub\Gridly-Source-Data\Census\tl_2025_us_county\tl_2025_us_county.shp',
    [string]$OutputDirectory = 'C:\GitHub\Gridly-Source-Data\Processing\Census-Places',
    [string]$PlaceZip = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\PLACE\original\tl_2025_48_place.zip'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# LP188.2A is certification-only. This program writes only to OutputDirectory.
. (Join-Path $PSScriptRoot 'gridly-gis-env.ps1')

function Invoke-Ogr {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
}

function Write-StableJson {
    param([string]$Path, [object]$Value)
    $json = ($Value | ConvertTo-Json -Depth 20).Replace("`r`n", "`n") + "`n"
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

function Read-Features([string]$Path) {
    return @((Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json).features)
}

function Get-DeclaredEpsg([string]$OgrInfoText) {
    $matches = [regex]::Matches($OgrInfoText, '(?:AUTHORITY|ID)\["EPSG",[" ]*(\d+)')
    if ($matches.Count -eq 0) { return $null }
    return $matches[$matches.Count - 1].Groups[1].Value
}

foreach ($required in @($PlaceSource, $CountySource, $PlaceZip)) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { throw "Required source is absent: $required" }
}
foreach ($command in @('ogrinfo', 'ogr2ogr')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "Required GDAL command is unavailable: $command" }
}
if ((Get-Item -LiteralPath $PlaceZip).Length -ne 9782040) { throw 'PLACE ZIP byte size does not match the governed source lock.' }
$zipHash = (Get-FileHash -LiteralPath $PlaceZip -Algorithm SHA256).Hash.ToUpperInvariant()
if ($zipHash -ne '5A0C4D49641F69028EE9F5C343BF09936EC00A378E5E6393115B106BAB935E13') { throw 'PLACE ZIP SHA-256 does not match the governed source lock.' }

$scratch = Join-Path ([IO.Path]::GetTempPath()) ("gridly-lp1882a-" + [guid]::NewGuid().ToString('N'))
$promote = "$OutputDirectory.tmp-$([guid]::NewGuid().ToString('N'))"
try {
    New-Item -ItemType Directory -Path $scratch, $promote | Out-Null
    $placeInfo = Join-Path $scratch 'place-info.txt'
    $countyInfo = Join-Path $scratch 'county-info.txt'
    & ogrinfo -ro -so -al $PlaceSource 2>&1 | Set-Content -LiteralPath $placeInfo
    if ($LASTEXITCODE -ne 0) { throw 'ogrinfo could not read PLACE geometry.' }
    & ogrinfo -ro -so -al $CountySource 2>&1 | Set-Content -LiteralPath $countyInfo
    if ($LASTEXITCODE -ne 0) { throw 'ogrinfo could not read COUNTY geometry.' }
    $placeText = Get-Content -LiteralPath $placeInfo -Raw
    $countyText = Get-Content -LiteralPath $countyInfo -Raw
    if ($placeText -notmatch 'Feature Count:\s*1863' -or $placeText -notmatch 'STATEFP' -or $placeText -notmatch 'GEOID') { throw 'PLACE source contract failed.' }
    foreach ($field in @('STATEFP','COUNTYFP','GEOID','NAME')) { if ($countyText -notmatch "\b$field\b") { throw "COUNTY field is absent: $field" } }
    $placeEpsg = Get-DeclaredEpsg $placeText
    $countyEpsg = Get-DeclaredEpsg $countyText

    $db = Join-Path $scratch 'intersection.gpkg'
    # A Texas PLACE source can contain both POLYGON and MULTIPOLYGON features.
    # Promote single polygons without changing their coordinates so the layer
    # accepts every source geometry without GDAL's polygon-layer warning.
    Invoke-Ogr ogr2ogr @('-f','GPKG',$db,$PlaceSource,'-nln','places','-nlt','PROMOTE_TO_MULTI','-where',"STATEFP = '48'",'-makevalid')
    Invoke-Ogr ogr2ogr @('-f','GPKG','-update',$db,$CountySource,'-nln','counties','-where',"STATEFP = '48'",'-makevalid')

    $placeCount = (& ogrinfo -ro -so $db places 2>&1 | Select-String 'Feature Count:\s*(\d+)').Matches.Groups[1].Value
    $countyCount = (& ogrinfo -ro -so $db counties 2>&1 | Select-String 'Feature Count:\s*(\d+)').Matches.Groups[1].Value
    if ($placeCount -ne '1863') { throw "Expected 1863 Texas places; found $placeCount." }
    if ($countyCount -ne '254') { throw "Expected 254 Texas counties; found $countyCount." }

    $canonicalRaw = Join-Path $scratch 'canonical.geojson'
    $membershipRaw = Join-Path $scratch 'memberships.geojson'
    $canonicalSql = 'SELECT STATEFP, PLACEFP, GEOID, GEOIDFQ, NAME, NAMELSAD, LSAD, CLASSFP, FUNCSTAT, ALAND, AWATER, INTPTLAT, INTPTLON FROM places ORDER BY GEOID'
    Invoke-Ogr ogr2ogr @('-f','GeoJSON',$canonicalRaw,$db,'-dialect','SQLITE','-sql',$canonicalSql)
    # ST_Area(intersection) > 0 rejects line/point boundary touches. No percentage threshold is applied.
    $membershipSql = "SELECT p.GEOID AS placeGeoid, p.NAME AS placeName, c.GEOID AS countyFips, c.NAME AS countyName FROM places p JOIN counties c ON ST_Intersects(p.geom,c.geom) WHERE ST_Area(ST_Intersection(p.geom,c.geom)) > 0 ORDER BY p.GEOID,c.GEOID"
    Invoke-Ogr ogr2ogr @('-f','GeoJSON',$membershipRaw,$db,'-dialect','SQLITE','-sql',$membershipSql)

    $canonical = @(Read-Features $canonicalRaw | ForEach-Object {
        $p = $_.properties
        $type = if ($p.CLASSFP -eq 'C9') { 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE' } elseif ($p.LSAD -eq '57') { 'CENSUS_DESIGNATED_PLACE' } elseif ($p.CLASSFP -eq 'C1') { 'INCORPORATED_PLACE' } else { 'OTHER_REQUIRES_REVIEW' }
        [pscustomobject][ordered]@{ stateFips=$p.STATEFP; placeFips=$p.PLACEFP; geoid=$p.GEOID; geoidFq=$p.GEOIDFQ; officialName=$p.NAME; nameLsad=$p.NAMELSAD; lsad=$p.LSAD; classFp=$p.CLASSFP; funcStat=$p.FUNCSTAT; governedType=$type; aland=$p.ALAND; awater=$p.AWATER; intptLat=$p.INTPTLAT; intptLon=$p.INTPTLON }
    } | Sort-Object geoid)
    $memberships = @(Read-Features $membershipRaw | ForEach-Object { $p=$_.properties; [pscustomobject][ordered]@{ placeGeoid=$p.placeGeoid; placeName=$p.placeName; countyFips=$p.countyFips; countyName=$p.countyName; membershipSource='CENSUS_TIGER_2025_GEOMETRY'; membershipMethod='POLYGON_AREA_INTERSECTION' } } | Sort-Object placeGeoid,countyFips)

    $duplicateGeoids = @($canonical | Group-Object geoid | Where-Object Count -gt 1)
    $nonTexas = @($canonical | Where-Object stateFips -ne '48')
    $membershipByPlace = $memberships | Group-Object placeGeoid -AsHashTable -AsString
    $unmatched = @($canonical | Where-Object { -not $membershipByPlace.ContainsKey($_.geoid) })
    $unmatchedDiagnostics = @()
    if ($unmatched.Count -gt 0) {
        $unmatchedRaw = Join-Path $scratch 'unmatched-diagnostics.geojson'
        $unmatchedGeoids = @($unmatched.geoid | Sort-Object)
        $quotedGeoids = @($unmatchedGeoids | ForEach-Object { "'$($_.Replace("'", "''"))'" }) -join ','
        # These observations are read-only. In particular, the Census internal
        # point and nearest county never feed the governed membership query.
        $unmatchedSql = @"
SELECT p.GEOID AS geoid, p.PLACEFP AS placeFp, p.NAME AS officialName,
 p.NAMELSAD AS nameLsad, p.LSAD AS lsad, p.CLASSFP AS classFp,
 p.FUNCSTAT AS funcStat, p.INTPTLAT AS intptLat, p.INTPTLON AS intptLon,
 p.ALAND AS aland, p.AWATER AS awater,
 CASE WHEN EXISTS (SELECT 1 FROM counties c WHERE ST_Intersects(p.geom,c.geom)) THEN 1 ELSE 0 END AS intersectsAnyCounty,
 CASE WHEN EXISTS (SELECT 1 FROM counties c WHERE ST_Touches(p.geom,c.geom)) THEN 1 ELSE 0 END AS touchesAnyCounty,
 COALESCE((SELECT MAX(ST_Area(ST_Intersection(p.geom,c.geom))) FROM counties c WHERE ST_Intersects(p.geom,c.geom)),0) AS maximumIntersectionArea,
 CASE WHEN EXISTS (SELECT 1 FROM counties c WHERE ST_Intersects(c.geom,MakePoint(CAST(p.INTPTLON AS REAL),CAST(p.INTPTLAT AS REAL),4269))) THEN 1 ELSE 0 END AS internalPointInOrOnCounty,
 (SELECT c.GEOID FROM counties c ORDER BY ST_Distance(p.geom,c.geom),c.GEOID LIMIT 1) AS nearestCountyGeoid,
 (SELECT c.NAME FROM counties c ORDER BY ST_Distance(p.geom,c.geom),c.GEOID LIMIT 1) AS nearestCountyName,
 ST_IsEmpty(p.geom) AS geometryEmpty, ST_IsValid(p.geom) AS geometryValid,
 GeometryType(p.geom) AS geometryType, ST_MinX(p.geom) AS bboxMinX,
 ST_MinY(p.geom) AS bboxMinY, ST_MaxX(p.geom) AS bboxMaxX, ST_MaxY(p.geom) AS bboxMaxY
FROM places p WHERE p.GEOID IN ($quotedGeoids) ORDER BY p.GEOID
"@
        Invoke-Ogr ogr2ogr @('-f','GeoJSON',$unmatchedRaw,$db,'-dialect','SQLITE','-sql',$unmatchedSql)
        $unmatchedDiagnostics = @(Read-Features $unmatchedRaw | ForEach-Object {
            $p = $_.properties
            [pscustomobject][ordered]@{
                geoid=$p.geoid; placeFp=$p.placeFp; officialName=$p.officialName; nameLsad=$p.nameLsad; lsad=$p.lsad; classFp=$p.classFp; funcStat=$p.funcStat
                intptLat=$p.intptLat; intptLon=$p.intptLon; aland=$p.aland; awater=$p.awater
                intersectsAnyCounty=([bool]$p.intersectsAnyCounty); touchesOnly=([bool]$p.touchesAnyCounty -and [double]$p.maximumIntersectionArea -le 0)
                maximumIntersectionArea=$p.maximumIntersectionArea; internalPointInOrOnCounty=([bool]$p.internalPointInOrOnCounty)
                nearestCountyGeoid=$p.nearestCountyGeoid; nearestCountyName=$p.nearestCountyName
                geometryEmpty=([bool]$p.geometryEmpty); geometryValid=([bool]$p.geometryValid); geometryType=$p.geometryType
                boundingBox=[ordered]@{ minX=$p.bboxMinX; minY=$p.bboxMinY; maxX=$p.bboxMaxX; maxY=$p.bboxMaxY }
            }
        } | Sort-Object geoid)
        $diagnosticArtifact = "$OutputDirectory.unmatched-place-diagnostics.json"
        $diagnosticReport = [ordered]@{
            milestone='LP188.2A'; purpose='READ_ONLY_UNMATCHED_PLACE_RECONCILIATION'
            membershipMethod='ST_Intersects AND ST_Area(ST_Intersection) > 0'
            internalPointUsedForMembership=$false; nearestCountyUsedForMembership=$false
            sourceContracts=[ordered]@{
                place=[ordered]@{ source='TIGER/Line 2025 Texas Places'; expectedEpsg='4269'; detectedEpsg=$placeEpsg; recordCount=1863; zipSha256=$zipHash }
                county=[ordered]@{ source='authoritative Census 2025 county shapefile'; expectedEpsg='4269'; detectedEpsg=$countyEpsg; texasRecordCount=254 }
                projectionMismatchDetected=($placeEpsg -ne $countyEpsg -or $placeEpsg -ne '4269'); vintageMismatchDetected=$false
                projectionOrVintageMismatchCouldExplainUnmatched=($placeEpsg -ne $countyEpsg -or $placeEpsg -ne '4269')
            }
            unmatchedPlaces=$unmatchedDiagnostics
        }
        Write-StableJson $diagnosticArtifact $diagnosticReport
        Write-Host "Unmatched-place diagnostic artifact: $diagnosticArtifact"
        Write-Host ($diagnosticReport | ConvertTo-Json -Depth 20)
    }
    $invalidGeometry = [int](& ogrinfo -ro $db -dialect SQLITE -sql 'SELECT COUNT(*) AS n FROM places WHERE NOT ST_IsValid(geom)' 2>&1 | Select-String 'n \(Integer\) = (\d+)').Matches.Groups[1].Value
    $duplicates = @($canonical | Group-Object officialName | Where-Object Count -gt 1 | Sort-Object Name | ForEach-Object {
        $rows = @($_.Group | Sort-Object geoid)
        [ordered]@{ displayName=$_.Name; placeGeoids=@($rows.geoid); governedTypes=@($rows.governedType | Sort-Object -Unique); countyMemberships=@($rows | ForEach-Object { $g=$_.geoid; @($memberships | Where-Object placeGeoid -eq $g | ForEach-Object countyFips) } | Sort-Object -Unique) }
    })
    $single = @($membershipByPlace.GetEnumerator() | Where-Object { $_.Value.Count -eq 1 }).Count
    $multi = @($membershipByPlace.GetEnumerator() | Where-Object { $_.Value.Count -gt 1 }).Count
    $countiesWithPlaces = @($memberships.countyFips | Sort-Object -Unique).Count
    $gdalVersion = (& ogrinfo --version).Trim()
    $summary = [ordered]@{
        milestone='LP188.2A'; censusEdition='TIGER2025'; finalClassification='PLACE_COUNTY_MEMBERSHIP_CERTIFIED_READY_FOR_COMMUNITY_MANUFACTURING'
        provenance=[ordered]@{ placeZip='tl_2025_48_place.zip'; placeZipBytes=9782040; placeZipSha256=$zipHash; placeShapefile=$PlaceSource; countyShapefile=$CountySource; gdalVersion=$gdalVersion; qgisVersion='3.44.11 (configured by gridly-gis-env.ps1)' }
        counts=[ordered]@{ TOTAL_PLACES=$canonical.Count; INCORPORATED_ACTIVE=@($canonical | Where-Object governedType -eq 'INCORPORATED_PLACE').Count; INCORPORATED_INACTIVE_OR_NONFUNCTIONING=@($canonical | Where-Object governedType -eq 'INACTIVE_OR_NONFUNCTIONING_INCORPORATED_PLACE').Count; CDP=@($canonical | Where-Object governedType -eq 'CENSUS_DESIGNATED_PLACE').Count; OTHER_REQUIRES_REVIEW=@($canonical | Where-Object governedType -eq 'OTHER_REQUIRES_REVIEW').Count; SINGLE_COUNTY_PLACES=$single; MULTI_COUNTY_PLACES=$multi; TOTAL_PLACE_COUNTY_MEMBERSHIPS=$memberships.Count; UNMATCHED_PLACES=$unmatched.Count; COUNTIES_WITH_AT_LEAST_ONE_PLACE=$countiesWithPlaces; COUNTIES_WITH_ZERO_CENSUS_PLACES=254-$countiesWithPlaces; DUPLICATE_DISPLAY_NAME_GROUPS=$duplicates.Count; DUPLICATE_GEOIDS=$duplicateGeoids.Count; INVALID_GEOMETRIES=$invalidGeometry; NON_TEXAS_RECORDS=$nonTexas.Count }
        method=[ordered]@{ operation='OGR SQLite ST_Intersects plus ST_Area(ST_Intersection) > 0'; arbitraryThresholdUsed=$false; canonicalIdentity='Census PLACE GEOID'; stableSort='canonical GEOID; membership place GEOID then county FIPS' }
    }
    Write-Host 'Certification reconciliation diagnostics:'
    foreach ($diagnostic in @(
        @('Canonical places', $summary.counts.TOTAL_PLACES),
        @('Duplicate GEOIDs', $summary.counts.DUPLICATE_GEOIDS),
        @('Non-Texas records', $summary.counts.NON_TEXAS_RECORDS),
        @('Unmatched places', $summary.counts.UNMATCHED_PLACES),
        @('Invalid geometries', $summary.counts.INVALID_GEOMETRIES),
        @('Other requires review', $summary.counts.OTHER_REQUIRES_REVIEW),
        @('Single-county places', $summary.counts.SINGLE_COUNTY_PLACES),
        @('Multi-county places', $summary.counts.MULTI_COUNTY_PLACES),
        @('Total memberships', $summary.counts.TOTAL_PLACE_COUNTY_MEMBERSHIPS),
        @('Counties with Census places', $summary.counts.COUNTIES_WITH_AT_LEAST_ONE_PLACE),
        @('Counties with zero Census places', $summary.counts.COUNTIES_WITH_ZERO_CENSUS_PLACES),
        @('Duplicate-name groups', $summary.counts.DUPLICATE_DISPLAY_NAME_GROUPS)
    )) { Write-Host ("  {0}: {1}" -f $diagnostic[0], $diagnostic[1]) }

    $failedGates = @()
    if ($canonical.Count -ne 1863) { $failedGates += "Canonical places: expected 1863, found $($canonical.Count)" }
    if ($duplicateGeoids.Count -gt 0) { $failedGates += "Duplicate GEOIDs: expected 0, found $($duplicateGeoids.Count)" }
    if ($nonTexas.Count -gt 0) { $failedGates += "Non-Texas records: expected 0, found $($nonTexas.Count)" }
    if ($unmatched.Count -gt 0) { $failedGates += "Unmatched places: expected 0, found $($unmatched.Count)" }
    if ($invalidGeometry -gt 0) { $failedGates += "Invalid geometries: expected 0, found $invalidGeometry" }
    if ($summary.counts.OTHER_REQUIRES_REVIEW -gt 0) { $failedGates += "Other requires review: expected 0, found $($summary.counts.OTHER_REQUIRES_REVIEW)" }
    if ($failedGates.Count -gt 0) {
        Write-Host 'Failing reconciliation gates:'
        foreach ($failedGate in $failedGates) { Write-Host "  - $failedGate" }
        throw 'Certification reconciliation failed; temporary output will not be promoted.'
    }
    Write-StableJson (Join-Path $promote 'texas-place-canonical.json') $canonical
    Write-StableJson (Join-Path $promote 'texas-place-county-memberships.json') $memberships
    Write-StableJson (Join-Path $promote 'texas-place-duplicate-names.json') $duplicates
    Write-StableJson (Join-Path $promote 'texas-place-certification-summary.json') $summary
    if (Test-Path $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
    Move-Item -LiteralPath $promote -Destination $OutputDirectory
} finally {
    if (Test-Path $scratch) { Remove-Item -LiteralPath $scratch -Recurse -Force }
    if (Test-Path $promote) { Remove-Item -LiteralPath $promote -Recurse -Force }
}
