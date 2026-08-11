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

    $db = Join-Path $scratch 'intersection.gpkg'
    Invoke-Ogr ogr2ogr @('-f','GPKG',$db,$PlaceSource,'-nln','places','-where',"STATEFP = '48'",'-makevalid')
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
        [ordered]@{ stateFips=$p.STATEFP; placeFips=$p.PLACEFP; geoid=$p.GEOID; geoidFq=$p.GEOIDFQ; officialName=$p.NAME; nameLsad=$p.NAMELSAD; lsad=$p.LSAD; classFp=$p.CLASSFP; funcStat=$p.FUNCSTAT; governedType=$type; aland=$p.ALAND; awater=$p.AWATER; intptLat=$p.INTPTLAT; intptLon=$p.INTPTLON }
    } | Sort-Object geoid)
    $memberships = @(Read-Features $membershipRaw | ForEach-Object { $p=$_.properties; [ordered]@{ placeGeoid=$p.placeGeoid; placeName=$p.placeName; countyFips=$p.countyFips; countyName=$p.countyName; membershipSource='CENSUS_TIGER_2025_GEOMETRY'; membershipMethod='POLYGON_AREA_INTERSECTION' } } | Sort-Object placeGeoid,countyFips)

    $duplicateGeoids = @($canonical | Group-Object geoid | Where-Object Count -gt 1)
    $nonTexas = @($canonical | Where-Object stateFips -ne '48')
    $membershipByPlace = $memberships | Group-Object placeGeoid -AsHashTable -AsString
    $unmatched = @($canonical | Where-Object { -not $membershipByPlace.ContainsKey($_.geoid) })
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
    if ($canonical.Count -ne 1863 -or $duplicateGeoids.Count -or $nonTexas.Count -or $unmatched.Count -or $invalidGeometry -or $summary.counts.OTHER_REQUIRES_REVIEW) { throw 'Certification reconciliation failed; temporary output will not be promoted.' }
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
