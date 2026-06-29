param(
    [Parameter(Mandatory = $true)]
    [string]$County,

    [switch]$Json
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    $current = Get-Location
    while ($current) {
        if (Test-Path (Join-Path $current ".git")) { return $current.Path }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current.Path -or [string]::IsNullOrWhiteSpace($parent)) { break }
        $current = Get-Item $parent
    }
    return (Get-Location).Path
}

function ConvertTo-CountySlug([string]$Name) {
    return ($Name.Trim().ToLowerInvariant() -replace "[^a-z0-9]+", "-" -replace "^-|-$", "")
}

function Test-PathRelative([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    return Test-Path (Join-Path $script:RepoRoot $Path)
}

function Read-JsonFile([string]$Path) {
    $fullPath = Join-Path $script:RepoRoot $Path
    if (!(Test-Path $fullPath)) { return $null }
    return Get-Content $fullPath -Raw | ConvertFrom-Json
}

function Test-JsonContainsCounty([string]$Path, [string]$CountyName, [string]$Slug) {
    $fullPath = Join-Path $script:RepoRoot $Path
    if (!(Test-Path $fullPath)) { return $false }
    $content = Get-Content $fullPath -Raw
    return ($content -match [regex]::Escape($CountyName)) -or ($content -match [regex]::Escape($Slug))
}

function New-Check([string]$Name, [bool]$Pass, [string]$Detail, [string]$Severity = "required") {
    [pscustomobject]@{
        name = $Name
        status = if ($Pass) { "PASS" } else { if ($Severity -eq "warn") { "WARN" } else { "FAIL" } }
        pass = $Pass
        severity = $Severity
        detail = $Detail
    }
}

$script:RepoRoot = Get-RepoRoot
$CountyName = $County.Trim()
$CountySlug = ConvertTo-CountySlug $CountyName
$CountyId = "$CountySlug-tx"

$CommunityManifest = "Community-Packages/$CountySlug/package-manifest.json"
$CrossingManifest = "Crossing-Packages/$CountySlug/package-manifest.json"
$ProductionPackage = "Crossing-Packages/$CountySlug/Production/$CountySlug-production-crossings.geojson"
$ProductionManifest = "Crossing-Packages/production-crossing-manifest.json"
$ApplicationAssetRoot = "assets/county-implementation/$CountySlug/runtime-assets"
$RuntimeRegistry = "assets/package-registry/runtime-package-registry.json"
$PackageRegistry = "js/gridlyPackageRegistry.js"

$communityExists = Test-PathRelative $CommunityManifest
$crossingExists = Test-PathRelative $CrossingManifest
$productionPackageExists = Test-PathRelative $ProductionPackage
$productionManifestEntryExists = Test-JsonContainsCounty $ProductionManifest $CountyName $CountySlug
$applicationAssetsPresent = (Test-PathRelative $ApplicationAssetRoot) -and ((Get-ChildItem (Join-Path $RepoRoot $ApplicationAssetRoot) -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1) -ne $null)

$runtimeRegistryEntry = $false
$runtimeRegistryJson = Read-JsonFile $RuntimeRegistry
if ($runtimeRegistryJson -and $runtimeRegistryJson.packages) {
    $runtimeRegistryEntry = @($runtimeRegistryJson.packages | Where-Object {
        ($_.county -eq $CountyName) -or ($_.manifest -match [regex]::Escape("/$CountySlug/"))
    }).Count -gt 0
}
$packageRegistryContent = if (Test-PathRelative $PackageRegistry) { Get-Content (Join-Path $RepoRoot $PackageRegistry) -Raw } else { "" }
$packageRegistryEntry = $packageRegistryContent -match [regex]::Escape("community.$CountyId")
$runtimeRegistered = $runtimeRegistryEntry -or $packageRegistryEntry

$operational = $false
$searchEnabled = $false
$awarenessEnabled = $false
$consumerEnabled = $false

if ($packageRegistryContent) {
    $countyIndex = $packageRegistryContent.IndexOf("community.$CountyId")
    if ($countyIndex -ge 0) {
        $countySlice = $packageRegistryContent.Substring($countyIndex, [Math]::Min(1500, $packageRegistryContent.Length - $countyIndex))
        $operational = $countySlice -match 'status"?\s*:\s*"?(active|operational-maintenance)' -or $countySlice -match 'productionEnabled\s*:\s*true'
        $searchEnabled = $countySlice -match 'selectable\s*:\s*true'
        $awarenessEnabled = $countySlice -match 'ownsAwarenessAreas\s*:\s*true' -or $countySlice -match 'awarenessAreas\s*:'
        $consumerEnabled = $countySlice -match 'activeImplementation\s*:\s*true' -or $countySlice -match 'productionEnabled\s*:\s*true'
    }
}

$certificationCandidates = @(
    "Crossing-Packages/$CountySlug/Production/production-certification.json",
    "assets/county-implementation/$CountySlug/evidence",
    "assets/county-implementation/$CountySlug/validation"
)
$certificationEvidencePresent = @($certificationCandidates | Where-Object { Test-PathRelative $_ }).Count -gt 0

$enabledOperational = $operational -and $searchEnabled -and $awarenessEnabled -and $consumerEnabled

$checks = @(
    New-Check "Community Package" $communityExists $CommunityManifest
    New-Check "Crossing Package" $crossingExists $CrossingManifest
    New-Check "Production Package" $productionPackageExists $ProductionPackage
    New-Check "Production Manifest" $productionManifestEntryExists $ProductionManifest
    New-Check "Application Assets" $applicationAssetsPresent $ApplicationAssetRoot
    New-Check "Runtime Registered" $runtimeRegistered "Registry reference found: $runtimeRegistered"
    New-Check "Search Enabled" $(if ($enabledOperational) { $searchEnabled } else { -not $searchEnabled }) $(if ($enabledOperational) { "Expected enabled after controlled promotion; enabled=$searchEnabled" } else { "Expected disabled before controlled promotion; enabled=$searchEnabled" })
    New-Check "Awareness Enabled" $(if ($enabledOperational) { $awarenessEnabled } else { -not $awarenessEnabled }) $(if ($enabledOperational) { "Expected enabled after controlled promotion; enabled=$awarenessEnabled" } else { "Expected disabled before controlled promotion; enabled=$awarenessEnabled" })
    New-Check "Consumer Enabled" $(if ($enabledOperational) { $consumerEnabled } else { -not $consumerEnabled }) $(if ($enabledOperational) { "Expected enabled after controlled promotion; enabled=$consumerEnabled" } else { "Expected disabled before controlled promotion; enabled=$consumerEnabled" })
    New-Check "Certification Evidence" $certificationEvidencePresent "Optional certification evidence discovered: $certificationEvidencePresent" "warn"
)

$requiredFailures = @($checks | Where-Object { $_.severity -eq "required" -and -not $_.pass })
$promotionPrereqsReady = $communityExists -and $crossingExists -and $productionPackageExists -and $productionManifestEntryExists -and $applicationAssetsPresent -and $runtimeRegistered

if ($enabledOperational) {
    $finalStatus = "ALREADY OPERATIONAL"
} elseif ($promotionPrereqsReady -and $requiredFailures.Count -eq 0) {
    $finalStatus = "READY FOR CONTROLLED PROMOTION"
} else {
    $finalStatus = "BLOCKED"
}

$knownGaps = @()
foreach ($failure in $requiredFailures) { $knownGaps += "$($failure.name): $($failure.detail)" }
if (-not $certificationEvidencePresent) { $knownGaps += "Certification Evidence: optional evidence was not found in standard locations." }
if ($finalStatus -eq "READY FOR CONTROLLED PROMOTION") { $knownGaps += "Promotion has not been executed; county remains disabled until a later controlled promotion step." }

$result = [pscustomobject]@{
    title = "GRIDLY COUNTY PROMOTION READINESS"
    county = $CountyName
    countySlug = $CountySlug
    countyId = $CountyId
    finalStatus = $finalStatus
    checks = $checks
    knownRemainingGaps = $knownGaps
    changedFiles = $false
    promotedCounty = $false
    enabledCounty = $false
}

if ($Json) {
    $result | ConvertTo-Json -Depth 8
    exit 0
}

Write-Host "GRIDLY COUNTY PROMOTION READINESS"
Write-Host ""
Write-Host ("County: {0}" -f $CountyName)
Write-Host ""
foreach ($check in $checks) {
    Write-Host ("{0}: {1}" -f $check.name, $check.status)
    Write-Host ("  {0}" -f $check.detail)
}
Write-Host ""
Write-Host "Final Status:"
Write-Host $finalStatus

if ($finalStatus -eq "BLOCKED" -or $knownGaps.Count -gt 0) {
    Write-Host ""
    Write-Host "Known Remaining Gaps:"
    foreach ($gap in $knownGaps) { Write-Host ("- {0}" -f $gap) }
}
