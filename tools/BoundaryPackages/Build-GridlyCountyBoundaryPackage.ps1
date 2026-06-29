# Build-GridlyCountyBoundaryPackage.ps1
# Manufactures county-specific boundary GeoJSON packages from the authoritative local TIGER/Line 2025 county shapefile.

[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string[]]$County,
    [switch]$All,
    [switch]$Force,
    [switch]$Json,
    [string]$SourceShapefile
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
$DefaultSourceShapefile = Join-Path $RepoRoot "county_sources/census-tiger-2025/tl_2025_us_county.shp"
$FallbackSourceShapefile = "C:\GitHub\Gridly-Source-Data\Census\tl_2025_us_county\tl_2025_us_county.shp"
$DefaultSourceShapefileMetadataPath = "county_sources/census-tiger-2025/tl_2025_us_county.shp"
$SourceShapefileWasProvided = -not [string]::IsNullOrWhiteSpace($SourceShapefile)
$SourceShapefileFallbackUsed = $false
if (!$SourceShapefileWasProvided) {
    $SourceShapefile = $DefaultSourceShapefile
    if (!(Test-Path $SourceShapefile) -and (Test-Path $FallbackSourceShapefile)) {
        $SourceShapefile = $FallbackSourceShapefile
        $SourceShapefileFallbackUsed = $true
    }
}
$ManufacturedBoundarySourcePath = if (!$SourceShapefileWasProvided -and !$SourceShapefileFallbackUsed) { $DefaultSourceShapefileMetadataPath } else { $SourceShapefile }
$SourceLabel = "Census TIGER/Line 2025 county shapefile"

$SupportedCounties = @{
    "liberty" = @{ countyName = "Liberty"; countySlug = "liberty"; geoid = "48291"; plausibleBbox = @{ west = -95.3; south = 29.7; east = -94.3; north = 30.7 } }
    "montgomery" = @{ countyName = "Montgomery"; countySlug = "montgomery"; geoid = "48339"; plausibleBbox = @{ west = -96.0; south = 29.9; east = -95.0; north = 30.8 } }
    "san-jacinto" = @{ countyName = "San Jacinto"; countySlug = "san-jacinto"; geoid = "48407"; plausibleBbox = @{ west = -95.4; south = 30.3; east = -94.7; north = 31.0 } }
    "chambers" = @{ countyName = "Chambers"; countySlug = "chambers"; geoid = "48071"; plausibleBbox = @{ west = -95.1; south = 29.3; east = -94.2; north = 30.2 } }
    "jefferson" = @{ countyName = "Jefferson"; countySlug = "jefferson"; geoid = "48245"; plausibleBbox = @{ west = -94.8; south = 29.4; east = -93.6; north = 30.5 } }
}

function ConvertTo-CountySlug([string]$Name) { return ($Name.Trim().ToLowerInvariant() -replace "[^a-z0-9]+", "-" -replace "(^-|-$)", "") }
function Get-CoordinateCount($Coordinates) {
    if ($null -eq $Coordinates) { return 0 }
    if ($Coordinates -is [array] -and $Coordinates.Count -ge 2 -and $Coordinates[0] -is [double]) { return 1 }
    $count = 0
    foreach ($item in $Coordinates) { $count += Get-CoordinateCount $item }
    return $count
}
function Get-Bbox($Coordinates) {
    $box = @{ west = 999; south = 999; east = -999; north = -999 }
    function Walk($node) {
        if ($node -is [array] -and $node.Count -ge 2 -and $node[0] -is [double]) {
            $lon = [double]$node[0]; $lat = [double]$node[1]
            if ($lon -lt $script:box.west) { $script:box.west = $lon }
            if ($lon -gt $script:box.east) { $script:box.east = $lon }
            if ($lat -lt $script:box.south) { $script:box.south = $lat }
            if ($lat -gt $script:box.north) { $script:box.north = $lat }
            return
        }
        foreach ($child in $node) { Walk $child }
    }
    $script:box = $box; Walk $Coordinates; return $script:box
}
function Test-PlausibleBbox($Actual, $Expected) {
    return $Actual.west -ge $Expected.west -and $Actual.east -le $Expected.east -and $Actual.south -ge $Expected.south -and $Actual.north -le $Expected.north
}

if (-not $All -and (!$County -or $County.Count -eq 0)) { throw "Specify -County <name-or-slug> or -All." }
$Targets = if ($All) { $SupportedCounties.Values } else { $County | ForEach-Object { $slug = ConvertTo-CountySlug $_; if (!$SupportedCounties.ContainsKey($slug)) { throw "Unsupported county '$($_)'. Supported: $($SupportedCounties.Keys -join ', ')" }; $SupportedCounties[$slug] } }

$results = @()
if (!(Test-Path $SourceShapefile)) { throw "Authoritative source shapefile not found: $SourceShapefile" }
$ogr = Get-Command ogr2ogr -ErrorAction SilentlyContinue
if (!$ogr) { throw "ogr2ogr is required to manufacture boundary packages from $SourceShapefile." }

foreach ($target in $Targets) {
    $slug = $target.countySlug
    $relativeOutput = "assets/county-implementation/$slug/boundary/$slug-county-boundary.geojson"
    $output = Join-Path $RepoRoot $relativeOutput
    $outDir = Split-Path $output -Parent
    if (!(Test-Path $outDir) -and $PSCmdlet.ShouldProcess($outDir, "Create boundary package directory")) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }
    if ((Test-Path $output) -and !$Force) { throw "Output exists: $relativeOutput. Re-run with -Force to replace manufactured output." }
    if ($PSCmdlet.ShouldProcess($relativeOutput, "Extract GEOID $($target.geoid) from TIGER/Line 2025 county shapefile")) {
        $tmp = "$output.tmp"
        if (Test-Path $tmp) { Remove-Item $tmp -Force }
        & $ogr.Source -f GeoJSON $tmp $SourceShapefile -where "GEOID='$($target.geoid)'" -lco RFC7946=YES
        if ($LASTEXITCODE -ne 0) { throw "ogr2ogr failed for $slug GEOID $($target.geoid)." }
        $geojson = Get-Content $tmp -Raw | ConvertFrom-Json
        if ($geojson.type -ne "FeatureCollection" -or !$geojson.features -or $geojson.features.Count -ne 1) { throw "Expected exactly one GeoJSON feature for $slug GEOID $($target.geoid)." }
        $feature = $geojson.features[0]
        if ([string]$feature.properties.GEOID -ne [string]$target.geoid) { throw "Extracted GEOID mismatch for $slug." }
        $coordinateCount = Get-CoordinateCount $feature.geometry.coordinates
        $bbox = Get-Bbox $feature.geometry.coordinates
        if ($coordinateCount -le 50) { throw "Coordinate count validation failed for ${slug}: $coordinateCount." }
        if (!(Test-PlausibleBbox $bbox $target.plausibleBbox)) { throw "Plausible bbox validation failed for $slug." }
        $feature.properties | Add-Member -Force NoteProperty countyName $target.countyName
        $feature.properties | Add-Member -Force NoteProperty countySlug $target.countySlug
        $feature.properties | Add-Member -Force NoteProperty state "TX"
        $feature.properties | Add-Member -Force NoteProperty source $SourceLabel
        $feature.properties | Add-Member -Force NoteProperty generatedAt ([DateTime]::UtcNow.ToString("o"))
        $feature.properties | Add-Member -Force NoteProperty bboxFallbackUsed $false
        $feature.properties | Add-Member -Force NoteProperty boundaryManufacturingSystem "V802 County Boundary Manufacturing System"
        $feature.properties | Add-Member -Force NoteProperty manufacturedBoundarySourcePath $ManufacturedBoundarySourcePath
        $feature.properties | Add-Member -Force NoteProperty manufacturedBoundaryOutputPath $relativeOutput
        $geojson | Add-Member -Force NoteProperty source $SourceLabel
        $geojson | ConvertTo-Json -Depth 100 -Compress | Set-Content -Path $output -Encoding UTF8
        Remove-Item $tmp -Force
        $results += [pscustomobject]@{ countySlug = $slug; GEOID = $target.geoid; output = $relativeOutput; coordinateCount = $coordinateCount; bboxFallbackUsed = $false; bbox = $bbox }
    }
}
if ($Json) { $results | ConvertTo-Json -Depth 20 } else { $results | Format-Table -AutoSize }
