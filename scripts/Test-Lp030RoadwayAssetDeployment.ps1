<#
.SYNOPSIS
Self-contained validation for LP030 external roadway asset deployment tooling.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$deployScript = Join-Path $PSScriptRoot 'Deploy-Lp030RoadwayAssets.ps1'

if (-not (Test-Path -LiteralPath $deployScript -PathType Leaf)) {
    throw "Deploy script not found: $deployScript"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("gridly-lp030-roadway-assets-" + [System.Guid]::NewGuid().ToString('n'))
$sourceDir = Join-Path $tempRoot 'source'
$destinationDir = Join-Path $tempRoot 'external-assets'
$manifestPath = Join-Path $tempRoot 'manifest/lp030-roadway-assets.json'
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null

$fixturePath = Join-Path $sourceDir 'liberty-test-roadway.geojson'
@'
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "LP030 Test Road" },
      "geometry": { "type": "LineString", "coordinates": [[-95.0, 30.0], [-95.1, 30.1]] }
    }
  ]
}
'@ | Set-Content -LiteralPath $fixturePath -Encoding utf8

try {
    & $deployScript `
        -SourceDirectory $sourceDir `
        -DestinationDirectory $destinationDir `
        -ManifestOutputPath $manifestPath `
        -BaseUrl 'https://assets.gridly.example/roadways/lp030' `
        -CountyId 'liberty-tx' `
        -PackageVersion 'lp030-test' | Out-Null

    $stagedPath = Join-Path $destinationDir 'liberty-test-roadway.geojson'
    if (-not (Test-Path -LiteralPath $stagedPath -PathType Leaf)) {
        throw 'Expected staged roadway asset was not copied.'
    }

    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw 'Expected deployment manifest was not written.'
    }

    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.contractVersion -ne 'LP030.1') { throw 'Unexpected manifest contract version.' }
    if ($manifest.productionRuntimeModified -ne $false) { throw 'Manifest must confirm production runtime was not modified.' }
    if ($manifest.driveTexasModified -ne $false) { throw 'Manifest must confirm DriveTexas was not modified.' }
    if ($manifest.protectedDataRoadSegmentsModified -ne $false) { throw 'Manifest must confirm data/road-segments was not modified.' }
    if ($manifest.assetCount -ne 1) { throw 'Expected exactly one staged asset.' }
    if ($manifest.assets[0].featureCount -ne 1) { throw 'Expected one GeoJSON feature.' }
    if ($manifest.assets[0].url -ne 'https://assets.gridly.example/roadways/lp030/liberty-test-roadway.geojson') { throw 'Unexpected manifest URL.' }

    $expectedHash = (Get-FileHash -LiteralPath $fixturePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($manifest.assets[0].sha256 -ne $expectedHash) { throw 'Manifest SHA-256 does not match fixture.' }

    $protectedFailure = $false
    $protectedPath = Join-Path $repoRoot 'data/road-segments/lp030-test-output'
    try {
        & $deployScript -SourceDirectory $sourceDir -DestinationDirectory $protectedPath -ManifestOutputPath $manifestPath -Force | Out-Null
    } catch {
        $protectedFailure = $_.Exception.Message -match 'data/road-segments'
    }

    if (-not $protectedFailure) {
        throw 'Expected data/road-segments protection validation to fail.'
    }

    Write-Host 'LP030 roadway asset deployment tooling tests passed'
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
