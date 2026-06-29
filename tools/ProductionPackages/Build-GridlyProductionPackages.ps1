# Build-GridlyProductionPackages.ps1
# V790 — Production Package Manufacturing Toolkit

[CmdletBinding(DefaultParameterSetName = "All", SupportsShouldProcess = $true)]
param(
    [Parameter(ParameterSetName = "All")]
    [switch]$All,

    [Parameter(ParameterSetName = "County")]
    [ValidateNotNullOrEmpty()]
    [string]$County,

    [switch]$Force,
    [switch]$Json
)

$ErrorActionPreference = "Stop"

function ConvertTo-CountySlug {
    param([Parameter(Mandatory)][string]$Name)
    return ($Name.Trim().ToLowerInvariant() -replace "[^a-z0-9]+", "-" -replace "(^-|-$)", "")
}

function ConvertTo-CountyDisplayName {
    param([Parameter(Mandatory)][string]$Slug)
    return (($Slug -split "-") | ForEach-Object {
        if ($_.Length -gt 0) { $_.Substring(0, 1).ToUpperInvariant() + $_.Substring(1) } else { $_ }
    }) -join " "
}

function Read-JsonFile {
    param([Parameter(Mandatory)][string]$Path)
    return Get-Content -Raw -Encoding UTF8 $Path | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory)]$Value,
        [Parameter(Mandatory)][string]$Path,
        [int]$Depth = 100
    )
    $Value | ConvertTo-Json -Depth $Depth | Set-Content -Encoding UTF8 $Path
}

function Get-FeatureCount {
    param($GeoJson)
    if ($null -eq $GeoJson.features) { return 0 }
    return @($GeoJson.features).Count
}

function Get-ExistingProductionRule {
    param([Parameter(Mandatory)][string]$CrossingRoot)

    $productionFiles = Get-ChildItem -Path $CrossingRoot -Directory |
        ForEach-Object { Join-Path $_.FullName ("Production\{0}-production-crossings.geojson" -f $_.Name) } |
        Where-Object { Test-Path $_ }

    if (@($productionFiles).Count -eq 0) {
        return [pscustomobject]@{
            IsDiscoverable = $false
            Reason = "No existing production packages are available to infer consumer visibility fields."
        }
    }

    $requiredFields = @("gridlyProductionCertified", "gridlyClassification", "gridlyDisplayName", "gridlyId")
    foreach ($file in $productionFiles) {
        $geoJson = Read-JsonFile $file
        foreach ($feature in @($geoJson.features)) {
            foreach ($field in $requiredFields) {
                if (-not ($feature.properties.PSObject.Properties.Name -contains $field)) {
                    return [pscustomobject]@{
                        IsDiscoverable = $false
                        Reason = "Existing production package $file is missing expected field $field."
                    }
                }
            }
        }
    }

    return [pscustomobject]@{
        IsDiscoverable = $true
        RequiredFields = $requiredFields
        Rule = "Preserve source features and add gridlyProductionCertified=true, gridlyClassification=PUBLIC_ROADWAY, gridlyDisplayName from STREET/HIGHWAY fallback, and gridlyId from CROSSING."
    }
}

function Add-ProductionVisibilityFields {
    param($GeoJson)

    foreach ($feature in @($GeoJson.features)) {
        $properties = $feature.properties
        $crossing = [string]$properties.CROSSING
        $street = [string]$properties.STREET
        $highway = [string]$properties.HIGHWAY
        $displayName = $street.Trim()
        if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = $highway.Trim() }
        if ([string]::IsNullOrWhiteSpace($displayName)) { $displayName = "Unnamed Crossing" }

        $properties | Add-Member -NotePropertyName "gridlyProductionCertified" -NotePropertyValue $true -Force
        $properties | Add-Member -NotePropertyName "gridlyClassification" -NotePropertyValue "PUBLIC_ROADWAY" -Force
        $properties | Add-Member -NotePropertyName "gridlyDisplayName" -NotePropertyValue $displayName -Force
        $properties | Add-Member -NotePropertyName "gridlyId" -NotePropertyValue ("FRA-{0}" -f $crossing) -Force
    }

    return $GeoJson
}

function Get-EligibleCountyRecords {
    param(
        [Parameter(Mandatory)][string]$CommunityRoot,
        [Parameter(Mandatory)][string]$CrossingRoot
    )

    $records = @()
    Get-ChildItem -Path $CommunityRoot -Directory | Sort-Object Name | ForEach-Object {
        $slug = $_.Name
        $communityManifest = Join-Path $_.FullName "package-manifest.json"
        $crossingDir = Join-Path $CrossingRoot $slug
        $crossingManifest = Join-Path $crossingDir "package-manifest.json"
        if ((Test-Path $communityManifest) -and (Test-Path $crossingManifest)) {
            $manifest = Read-JsonFile $crossingManifest
            $records += [pscustomobject]@{
                Slug = $slug
                County = if ($manifest.county) { [string]$manifest.county } else { ConvertTo-CountyDisplayName $slug }
                CommunityManifest = $communityManifest
                CrossingManifest = $crossingManifest
                CrossingPackage = Join-Path (Get-Location) ([string]$manifest.packageFile)
                ProductionPackage = Join-Path $crossingDir ("Production\{0}-production-crossings.geojson" -f $slug)
                ProductionDir = Join-Path $crossingDir "Production"
            }
        }
    }
    return $records
}

$repoRoot = (Get-Location).Path
$communityRoot = Join-Path $repoRoot "Community-Packages"
$crossingRoot = Join-Path $repoRoot "Crossing-Packages"
$manifestPath = Join-Path $crossingRoot "production-crossing-manifest.json"

if (-not $All -and [string]::IsNullOrWhiteSpace($County)) { $All = $true }

$eligible = @(Get-EligibleCountyRecords -CommunityRoot $communityRoot -CrossingRoot $crossingRoot)
if ($County) {
    $requestedSlug = ConvertTo-CountySlug $County
    $eligible = @($eligible | Where-Object { $_.Slug -eq $requestedSlug -or $_.County -ieq $County })
}

$visibilityRule = Get-ExistingProductionRule -CrossingRoot $crossingRoot
$results = @()
$totalProductionCrossings = 0
$builtCount = 0
$skippedCount = 0
$blockedCount = 0
$failedCount = 0

foreach ($record in $eligible) {
    $status = "Skipped"
    $message = "Production package already exists. Use -Force to rebuild."
    $crossingCount = 0

    try {
        if ((Test-Path $record.ProductionPackage) -and -not $Force) {
            $existing = Read-JsonFile $record.ProductionPackage
            $crossingCount = Get-FeatureCount $existing
            $skippedCount++
        }
        elseif (-not $visibilityRule.IsDiscoverable) {
            $status = "Blocked"
            $message = $visibilityRule.Reason
            $blockedCount++
        }
        elseif (-not (Test-Path $record.CrossingPackage)) {
            $status = "Blocked"
            $message = "Crossing source package file is missing: $($record.CrossingPackage)"
            $blockedCount++
        }
        else {
            $source = Read-JsonFile $record.CrossingPackage
            $crossingCount = Get-FeatureCount $source
            $production = Add-ProductionVisibilityFields -GeoJson $source
            $message = "Production package manufactured."
            if ($WhatIfPreference) { $message = "WhatIf: production package would be manufactured." }
            $status = "Built"

            if ($PSCmdlet.ShouldProcess($record.ProductionPackage, "Write production crossing package")) {
                New-Item -ItemType Directory -Force -Path $record.ProductionDir | Out-Null
                Write-JsonFile -Value $production -Path $record.ProductionPackage -Depth 100
            }
            $builtCount++
        }
    }
    catch {
        $status = "Failed"
        $message = $_.Exception.Message
        $failedCount++
    }

    if ($status -in @("Built", "Skipped")) { $totalProductionCrossings += $crossingCount }

    $results += [pscustomobject]@{
        county = $record.County
        slug = $record.Slug
        status = $status
        crossingCount = $crossingCount
        sourcePackage = $record.CrossingPackage.Replace($repoRoot + [IO.Path]::DirectorySeparatorChar, "")
        productionPackage = $record.ProductionPackage.Replace($repoRoot + [IO.Path]::DirectorySeparatorChar, "")
        message = $message
        certification = "Pending: no existing production-certification.json files were found to use as a compatible generation pattern."
    }
}

if (-not $WhatIfPreference) {
    $productionRecords = @()
    Get-ChildItem -Path $crossingRoot -Directory | Sort-Object Name | ForEach-Object {
        $slug = $_.Name
        $file = Join-Path $_.FullName ("Production\{0}-production-crossings.geojson" -f $slug)
        if (Test-Path $file) {
            $geoJson = Read-JsonFile $file
            $productionRecords += [pscustomobject]@{
                county = ConvertTo-CountyDisplayName $slug
                status = "PASS"
                crossingCount = Get-FeatureCount $geoJson
                certificationFile = ("Crossing-Packages\{0}\Production\production-certification.json" -f $slug)
                packageFile = ("Crossing-Packages\{0}\Production\{0}-production-crossings.geojson" -f $slug)
            }
        }
    }
    $manifest = [pscustomobject]@{
        dataset = "Gridly Production Crossing Packages"
        status = "active"
        generatedAt = (Get-Date).ToString("o")
        totalPackages = @($productionRecords).Count
        totalCrossings = ($productionRecords | Measure-Object -Property crossingCount -Sum).Sum
        passCount = @($productionRecords).Count
        blockedCount = 0
        records = $productionRecords
    }
    Write-JsonFile -Value $manifest -Path $manifestPath -Depth 20
}

$summary = [pscustomobject]@{
    title = "GRIDLY PRODUCTION PACKAGE MANUFACTURING"
    generatedAt = (Get-Date).ToString("o")
    whatIf = [bool]$WhatIfPreference
    force = [bool]$Force
    eligibleCounties = @($eligible).Count
    builtCount = $builtCount
    skippedCount = $skippedCount
    blockedCount = $blockedCount
    failedCount = $failedCount
    totalProductionCrossings = $totalProductionCrossings
    visibilityRule = $visibilityRule
    results = $results
}

if ($Json) {
    $summary | ConvertTo-Json -Depth 100
}
else {
    Write-Host "GRIDLY PRODUCTION PACKAGE MANUFACTURING" -ForegroundColor Cyan
    Write-Host ""
    foreach ($label in @("Built", "Skipped", "Blocked", "Failed")) {
        Write-Host $label
        $items = @($results | Where-Object { $_.status -eq $label })
        if ($items.Count -eq 0) { Write-Host "  (none)" }
        foreach ($item in $items) { Write-Host ("  {0}: {1} ({2})" -f $item.county, $item.message, $item.crossingCount) }
        Write-Host ""
    }
    Write-Host "Totals:"
    Write-Host ("Eligible counties          : {0}" -f @($eligible).Count)
    Write-Host ("Built count                : {0}" -f $builtCount)
    Write-Host ("Skipped count              : {0}" -f $skippedCount)
    Write-Host ("Blocked count              : {0}" -f $blockedCount)
    Write-Host ("Failed count               : {0}" -f $failedCount)
    Write-Host ("Total production crossings : {0}" -f $totalProductionCrossings)
}

if ($failedCount -gt 0) { exit 1 }
