<#
.SYNOPSIS
Stages externally hosted LP030 roadway GeoJSON assets and writes a deployment manifest.

.DESCRIPTION
This tooling is intentionally outside production runtime behavior. It copies validated
GeoJSON roadway packages from a caller-provided source directory to a caller-provided
external asset staging directory and emits a manifest for upload/release review.

It does not modify data/road-segments/, DriveTexas files, app runtime code, service
worker configuration, or production manifests.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$SourceDirectory,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DestinationDirectory,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ManifestOutputPath,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$BaseUrl,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$CountyId,

    [Parameter()]
    [ValidateNotNullOrEmpty()]
    [string]$PackageVersion = (Get-Date -AsUTC -Format 'yyyyMMddTHHmmssZ'),

    [Parameter()]
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-Lp030FullPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $executionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
}

function Test-Lp030ProtectedPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $fullPath = Resolve-Lp030FullPath -Path $Path
    $normalized = $fullPath.Replace('\\', '/')
    return $normalized -match '(^|/)data/road-segments(/|$)'
}

function Get-Lp030GeoJsonFeatureCount {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $json = Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
    if ($json.type -ne 'FeatureCollection') {
        throw "Roadway asset must be a GeoJSON FeatureCollection: $Path"
    }

    if ($null -eq $json.features) {
        return 0
    }

    return @($json.features).Count
}

if (Test-Lp030ProtectedPath -Path $SourceDirectory) {
    throw 'LP030 tooling may not read roadway assets from data/road-segments/.'
}

if (Test-Lp030ProtectedPath -Path $DestinationDirectory) {
    throw 'LP030 tooling may not write roadway assets to data/road-segments/.'
}

if (Test-Lp030ProtectedPath -Path $ManifestOutputPath) {
    throw 'LP030 tooling may not write manifests under data/road-segments/.'
}

$sourceFullPath = Resolve-Lp030FullPath -Path $SourceDirectory
$destinationFullPath = Resolve-Lp030FullPath -Path $DestinationDirectory
$manifestFullPath = Resolve-Lp030FullPath -Path $ManifestOutputPath

if (-not (Test-Path -LiteralPath $sourceFullPath -PathType Container)) {
    throw "Source directory does not exist: $sourceFullPath"
}

$sourceAssets = @(Get-ChildItem -LiteralPath $sourceFullPath -Filter '*.geojson' -File | Sort-Object Name)
if ($sourceAssets.Count -eq 0) {
    throw "No .geojson roadway assets found in $sourceFullPath"
}

if (-not (Test-Path -LiteralPath $destinationFullPath -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($destinationFullPath, 'Create LP030 external roadway asset staging directory')) {
        New-Item -ItemType Directory -Path $destinationFullPath -Force | Out-Null
    }
}

$manifestParent = Split-Path -Parent $manifestFullPath
if ($manifestParent -and -not (Test-Path -LiteralPath $manifestParent -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($manifestParent, 'Create LP030 manifest output directory')) {
        New-Item -ItemType Directory -Path $manifestParent -Force | Out-Null
    }
}

$assets = foreach ($asset in $sourceAssets) {
    $targetPath = Join-Path $destinationFullPath $asset.Name

    if ((Test-Path -LiteralPath $targetPath) -and -not $Force) {
        throw "Destination asset already exists. Re-run with -Force to overwrite: $targetPath"
    }

    $featureCount = Get-Lp030GeoJsonFeatureCount -Path $asset.FullName
    $hash = (Get-FileHash -LiteralPath $asset.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $bytes = (Get-Item -LiteralPath $asset.FullName).Length

    if ($PSCmdlet.ShouldProcess($targetPath, "Stage LP030 roadway asset from $($asset.FullName)")) {
        Copy-Item -LiteralPath $asset.FullName -Destination $targetPath -Force:$Force
    }

    $url = $null
    if ($BaseUrl) {
        $url = ($BaseUrl.TrimEnd('/') + '/' + [System.Uri]::EscapeDataString($asset.Name))
    }

    [pscustomobject]@{
        fileName = $asset.Name
        countyId = $CountyId
        packageVersion = $PackageVersion
        url = $url
        sha256 = $hash
        bytes = $bytes
        featureCount = $featureCount
        sourcePath = $asset.FullName
        stagedPath = $targetPath
    }
}

$manifest = [ordered]@{
    contractVersion = 'LP030.1'
    generatedAtUtc = (Get-Date -AsUTC -Format 'o')
    purpose = 'external-roadway-asset-upload-tooling'
    productionRuntimeModified = $false
    driveTexasModified = $false
    protectedDataRoadSegmentsModified = $false
    assetCount = $assets.Count
    assets = $assets
}

if ($PSCmdlet.ShouldProcess($manifestFullPath, 'Write LP030 external roadway asset deployment manifest')) {
    $manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestFullPath -Encoding utf8
}

$manifest | ConvertTo-Json -Depth 8
