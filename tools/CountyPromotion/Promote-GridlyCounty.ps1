param(
    [string]$County,
    [switch]$AllReady,
    [switch]$WhatIf,
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

function Read-JsonFile([string]$RelativePath) {
    $fullPath = Join-Path $script:RepoRoot $RelativePath
    if (!(Test-Path $fullPath)) { return $null }
    return Get-Content $fullPath -Raw | ConvertFrom-Json
}

function Get-CountyListFromInput {
    if ($AllReady) {
        $manifest = Read-JsonFile "Crossing-Packages/production-crossing-manifest.json"
        if (-not $manifest -or -not $manifest.records) { throw "Unable to read production crossing manifest for -AllReady." }
        return @($manifest.records | Where-Object { $_.status -eq "PASS" } | ForEach-Object { $_.county } | Sort-Object -Unique)
    }

    if ([string]::IsNullOrWhiteSpace($County)) { throw "Specify -County <county or comma-separated counties> or -AllReady." }
    return @($County -split "," | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Invoke-Readiness([string]$CountyName) {
    $readinessTool = Join-Path $script:RepoRoot "tools/CountyPromotion/Test-GridlyCountyPromotionReadiness.ps1"
    if (!(Test-Path $readinessTool)) { throw "Readiness tool not found: $readinessTool" }
    $jsonText = & powershell -ExecutionPolicy Bypass -File $readinessTool -County $CountyName -Json
    if ($LASTEXITCODE -ne 0) { throw "Readiness tool failed for $CountyName." }
    return ($jsonText | ConvertFrom-Json)
}

function Find-BoundaryGeoid([string]$CountyName) {
    $boundaryPath = Join-Path $script:RepoRoot "assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson"
    if (!(Test-Path $boundaryPath)) { return $null }

    $content = Get-Content $boundaryPath -Raw
    $namePattern = '"NAME"\s*:\s*"' + [regex]::Escape($CountyName) + '"'
    $match = [regex]::Match($content, $namePattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) { return $null }

    $start = [Math]::Max(0, $match.Index - 800)
    $length = [Math]::Min(1600, $content.Length - $start)
    $slice = $content.Substring($start, $length)
    $geoidMatch = [regex]::Match($slice, '"GEOID"\s*:\s*"(?<geoid>\d{5})"', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($geoidMatch.Success) { return $geoidMatch.Groups["geoid"].Value }
    return $null
}

function New-Plan([object]$Readiness) {
    $slug = $Readiness.countySlug
    $countyName = $Readiness.county
    $countyId = $Readiness.countyId
    $geoid = Find-BoundaryGeoid $countyName

    $files = @(
        [pscustomobject]@{ path = "js/gridlyPackageRegistry.js"; purpose = "Set community.$countyId production metadata active/selectable/controlled-promotion without changing package contents." },
        [pscustomobject]@{ path = "js/app.js"; purpose = "Add runtime county config, search/home-area registration, awareness anchors, and boundary overlay wiring." },
        [pscustomobject]@{ path = "docs/certifications/<promotion-run>.md"; purpose = "Record controlled promotion certification for $countyName." },
        [pscustomobject]@{ path = "docs/certifications/evidence/<promotion-run>.json"; purpose = "Record machine-readable promotion evidence for $countyName." }
    )

    $activeState = [pscustomobject]@{
        packageRegistryStatus = "active"
        lifecycle = "production"
        activeImplementation = $true
        productionEnabled = $true
        selectable = $true
        ownsAwarenessAreas = $true
        runtimeRegistration = "enabled"
        searchHomeAreaRegistration = "enabled"
        awarenessBoundsAreas = "enabled"
        boundaryOverlayRegistration = if ($geoid) { "enabled via GEOID $geoid" } else { "pending; GEOID not discovered" }
        packageContentsChanged = $false
    }

    return [pscustomobject]@{
        county = $countyName
        countySlug = $slug
        countyId = $countyId
        readinessStatus = $Readiness.finalStatus
        geoid = $geoid
        wouldChangeFiles = $files
        activeState = $activeState
    }
}

$script:RepoRoot = Get-RepoRoot
$counties = Get-CountyListFromInput
$results = @()
$hasBlocked = $false
$writeModeEnabled = $false

foreach ($countyName in $counties) {
    $readiness = Invoke-Readiness $countyName
    $plan = New-Plan $readiness
    $status = "READY"
    $blockedReason = $null

    if ($readiness.finalStatus -eq "ALREADY OPERATIONAL") {
        $status = "REFUSED"
        $blockedReason = "County is already operational; this foundation does not support re-promotion or -Force."
        $hasBlocked = $true
    }
    elseif ($readiness.finalStatus -ne "READY FOR CONTROLLED PROMOTION") {
        $status = "REFUSED"
        $blockedReason = "Readiness gate returned '$($readiness.finalStatus)' instead of READY FOR CONTROLLED PROMOTION."
        $hasBlocked = $true
    }
    elseif (-not $WhatIf) {
        $status = "BLOCKED FOR WRITE MODE"
        $blockedReason = "Write mode is intentionally blocked in V792 because deterministic edits across runtime/search/awareness/boundary registration have not been proven safe. Re-run with -WhatIf."
        $hasBlocked = $true
    }

    $results += [pscustomobject]@{
        county = $readiness.county
        countySlug = $readiness.countySlug
        countyId = $readiness.countyId
        readinessStatus = $readiness.finalStatus
        action = if ($WhatIf) { "WhatIf" } else { "Promote" }
        status = $status
        blockedReason = $blockedReason
        plan = $plan
        readiness = $readiness
    }
}

$output = [pscustomobject]@{
    title = "GRIDLY COUNTY PROMOTION AUTOMATION FOUNDATION"
    version = "V792"
    mode = if ($WhatIf) { "WhatIf" } else { "Write" }
    writeModeEnabled = $writeModeEnabled
    changedFiles = $false
    packageContentsChanged = $false
    protectedSystemsChanged = $false
    results = $results
}

if ($Json) {
    $output | ConvertTo-Json -Depth 12
    if ($hasBlocked) { exit 2 }
    exit 0
}

Write-Host "GRIDLY COUNTY PROMOTION AUTOMATION FOUNDATION"
Write-Host "Mode: $($output.mode)"
Write-Host "Write Mode Enabled: $writeModeEnabled"
Write-Host ""
foreach ($result in $results) {
    Write-Host ("County: {0}" -f $result.county)
    Write-Host ("Readiness: {0}" -f $result.readinessStatus)
    Write-Host ("Status: {0}" -f $result.status)
    if ($result.blockedReason) { Write-Host ("Blocked Reason: {0}" -f $result.blockedReason) }
    Write-Host "Would Change Files:"
    foreach ($file in $result.plan.wouldChangeFiles) { Write-Host ("- {0}: {1}" -f $file.path, $file.purpose) }
    Write-Host "Would Activate State:"
    $result.plan.activeState.PSObject.Properties | ForEach-Object { Write-Host ("- {0}: {1}" -f $_.Name, $_.Value) }
    Write-Host ""
}

if ($hasBlocked) { exit 2 }
exit 0
