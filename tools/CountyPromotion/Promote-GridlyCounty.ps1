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

function ConvertTo-JsStringArray([string[]]$Items) {
    return (($Items | ForEach-Object { '"' + ($_ -replace '"', '\"') + '"' }) -join ", ")
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

function Find-BoundaryFeature([string]$CountyName) {
    $boundaryPath = Join-Path $script:RepoRoot "assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson"
    if (!(Test-Path $boundaryPath)) { return $null }

    $json = Get-Content $boundaryPath -Raw | ConvertFrom-Json
    $feature = @($json.features | Where-Object { $_.properties.NAME -eq $CountyName -or $_.properties.NAMELSAD -eq "$CountyName County" })
    if ($feature.Count -ne 1) { return $null }

    $coordinates = @()
    function Add-Coordinates([object]$Node) {
        if ($null -eq $Node) { return }
        if ($Node -is [System.Array] -and $Node.Count -ge 2 -and $Node[0] -is [ValueType] -and $Node[1] -is [ValueType]) {
            $script:CountyBoundaryCoordinateAccumulator += ,@([double]$Node[0], [double]$Node[1])
            return
        }
        foreach ($child in $Node) { Add-Coordinates $child }
    }

    $script:CountyBoundaryCoordinateAccumulator = @()
    Add-Coordinates $feature[0].geometry.coordinates
    $coordinates = $script:CountyBoundaryCoordinateAccumulator
    if ($coordinates.Count -eq 0) { return $null }

    $west = ($coordinates | ForEach-Object { $_[0] } | Measure-Object -Minimum).Minimum
    $east = ($coordinates | ForEach-Object { $_[0] } | Measure-Object -Maximum).Maximum
    $south = ($coordinates | ForEach-Object { $_[1] } | Measure-Object -Minimum).Minimum
    $north = ($coordinates | ForEach-Object { $_[1] } | Measure-Object -Maximum).Maximum

    return [pscustomobject]@{
        geoid = [string]$feature[0].properties.GEOID
        bounds = [pscustomobject]@{ south = [Math]::Round($south, 6); west = [Math]::Round($west, 6); north = [Math]::Round($north, 6); east = [Math]::Round($east, 6) }
        center = [pscustomobject]@{ lat = [Math]::Round(($south + $north) / 2, 6); lng = [Math]::Round(($west + $east) / 2, 6) }
    }
}

function Get-CommunityNames([string]$CountySlug) {
    $manifest = Read-JsonFile "Community-Packages/$CountySlug/package-manifest.json"
    if (-not $manifest -or -not $manifest.communities) { return @() }
    return @($manifest.communities | ForEach-Object { [string]$_ } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Test-DeterministicPlan([object]$Readiness) {
    $countyName = $Readiness.county
    $slug = $Readiness.countySlug
    $countyId = $Readiness.countyId
    $boundary = Find-BoundaryFeature $countyName
    $communities = Get-CommunityNames $slug
    $registryPath = Join-Path $script:RepoRoot "js/gridlyPackageRegistry.js"
    $appPath = Join-Path $script:RepoRoot "js/app.js"
    $registry = Get-Content $registryPath -Raw
    $app = Get-Content $appPath -Raw
    $blockers = @()

    if (-not $boundary -or [string]::IsNullOrWhiteSpace($boundary.geoid)) { $blockers += "Missing deterministic boundary metadata: standard Texas county boundary GEOID could not be inferred for $countyName." }
    if (-not $boundary -or -not $boundary.bounds) { $blockers += "Missing deterministic bounds: county awareness bounds could not be computed from boundary geometry for $countyName." }
    if ($communities.Count -eq 0) { $blockers += "Missing deterministic community mapping: Community-Packages/$slug/package-manifest.json does not list local communities." }
    if ($registry -notmatch [regex]::Escape('id: "community.' + $countyId + '"')) { $blockers += "Package registry pattern missing: community.$countyId entry was not found." }
    if ($app -notmatch "(?m)^  \`"chambers-tx\`": Object\.freeze\(\{") { $blockers += "Runtime insertion anchor missing: Chambers controlled-promotion runtime entry was not found." }
    if ($app -notmatch "const GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID = Object\.freeze\(\{") { $blockers += "Awareness bounds anchor missing." }
    if ($app -notmatch "const GRIDLY_AWARENESS_AREA_DEFINITIONS = \[") { $blockers += "Awareness area definitions anchor missing." }
    if ($app -notmatch "const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY = Object\.freeze\(\{") { $blockers += "Home/search options anchor missing." }
    if ($app -notmatch "const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object\.freeze\(\[") { $blockers += "Boundary overlay county-id anchor missing." }

    $areas = @()
    if ($boundary) {
        $areas += [pscustomobject]@{ key = "$slug-county"; label = "$countyName County"; storageValue = "$countyName County"; lat = $boundary.center.lat; lng = $boundary.center.lng; radiusMiles = $null; startupZoom = 10; countyWide = $true }
    }
    foreach ($community in $communities) {
        # V793 deliberately refuses to geocode or guess local anchors. Community coordinates must exist in deterministic repo data.
        $blockers += "Missing deterministic community coordinate mapping for '$community' in $countyName; writer will not guess local search/home-area anchors."
    }

    return [pscustomobject]@{
        safeToWrite = ($blockers.Count -eq 0)
        blockers = $blockers
        boundary = $boundary
        communities = $communities
        awarenessAreas = $areas
    }
}

function New-Plan([object]$Readiness, [object]$Deterministic) {
    $slug = $Readiness.countySlug
    $countyName = $Readiness.county
    $countyId = $Readiness.countyId
    $geoid = if ($Deterministic.boundary) { $Deterministic.boundary.geoid } else { $null }

    $files = @(
        [pscustomobject]@{ path = "js/gridlyPackageRegistry.js"; purpose = "Set community.$countyId production metadata active/selectable/controlled-promotion without changing package contents." },
        [pscustomobject]@{ path = "js/app.js"; purpose = "Add runtime county config, search/home-area registration, awareness anchors, and boundary overlay wiring." },
        [pscustomobject]@{ path = "docs/certifications/evidence/<promotion-run>.json"; purpose = "Record machine-readable promotion evidence for promoted counties." }
    )

    return [pscustomobject]@{
        county = $countyName
        countySlug = $slug
        countyId = $countyId
        readinessStatus = $Readiness.finalStatus
        geoid = $geoid
        deterministicWriterSafe = $Deterministic.safeToWrite
        deterministicBlockers = $Deterministic.blockers
        deterministicCommunities = $Deterministic.communities
        wouldChangeFiles = $files
        activeState = [pscustomobject]@{
            packageRegistryStatus = "active"
            lifecycle = "production"
            activeImplementation = $true
            productionEnabled = $true
            selectable = $true
            ownsAwarenessAreas = $true
            runtimeRegistration = "enabled"
            searchHomeAreaRegistration = if ($Deterministic.safeToWrite) { "enabled" } else { "blocked until deterministic community mapping exists" }
            awarenessBoundsAreas = if ($Deterministic.safeToWrite) { "enabled" } else { "blocked until deterministic bounds and area mapping exist" }
            boundaryOverlayRegistration = if ($geoid) { "enabled via GEOID $geoid" } else { "blocked; GEOID not discovered" }
            packageContentsChanged = $false
        }
    }
}

function Set-FileContentUtf8Bom([string]$RelativePath, [string]$Content) {
    $fullPath = Join-Path $script:RepoRoot $RelativePath
    $encoding = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($fullPath, $Content, $encoding)
}

function Apply-PromotionBatch([object[]]$ApprovedResults) {
    $registryPath = "js/gridlyPackageRegistry.js"
    $appPath = "js/app.js"
    $registry = Get-Content (Join-Path $script:RepoRoot $registryPath) -Raw
    $app = Get-Content (Join-Path $script:RepoRoot $appPath) -Raw
    $changed = New-Object System.Collections.Generic.List[string]

    foreach ($result in $ApprovedResults) {
        $name = $result.county
        $slug = $result.countySlug
        $countyId = $result.countyId
        $areas = @($result.deterministic.awarenessAreas)
        $areaNames = @($areas | ForEach-Object { $_.storageValue })
        $defaultCity = if ($areaNames.Count -gt 1) { $areaNames[1] } else { "$name County" }
        $registryReplacement = @"
{ id: "community.$countyId", name: "$name", packageType: "community", version: "1.0.0-v793-controlled-promotion", status: "active", dependencies: [], capabilities: ["community-metadata", "regional-membership", "awareness-areas", "controlled-promotion"], validationState: "valid", community: Object.freeze({ countyId: "$countyId", displayName: "$name", countyName: "$name County", state: "TX", awarenessAreas: Object.freeze([$(ConvertTo-JsStringArray $areaNames)]), productionEnabled: true, selectable: true }), regional: Object.freeze({ foundationId: "regional.southeast-texas", operationalRegionId: "operational-region.southeast-texas", countyId: "$countyId", lifecycle: "production", activeImplementation: true, controlledPromotion: true, runtimeOwnershipMigrated: false }), operationalRegion: Object.freeze({ id: "operational-region.southeast-texas", role: "controlled-enabled-community-package" }), ownership: Object.freeze({ ownsAwarenessAreas: true, ownsPackageMetadata: true, ownsValidationState: true, ownsRoads: false, ownsCorridors: false, ownsRail: false, ownsCrossings: false, ownsTransportationIntelligence: false, ownsIntelligenceObjects: false, ownsTrust: false, ownsPresentationBehavior: false }) }
"@
        $registryReplacement = $registryReplacement.Trim()
        $registryPattern = '\{ id: "community\.' + [regex]::Escape($countyId) + '"[^\r\n]*\}'
        $newRegistry = [regex]::Replace($registry, $registryPattern, $registryReplacement, 1)
        if ($newRegistry -eq $registry) { throw "Safe registry replacement failed for $name." }
        $registry = $newRegistry

        $boundsConst = "const $($slug.ToUpperInvariant() -replace '-', '_')_COUNTY_AWARENESS_BOUNDS = { south: $($result.deterministic.boundary.bounds.south), west: $($result.deterministic.boundary.bounds.west), north: $($result.deterministic.boundary.bounds.north), east: $($result.deterministic.boundary.bounds.east) };"
        if ($app -notmatch [regex]::Escape($boundsConst)) { $app = $app -replace '(const CHAMBERS_COUNTY_AWARENESS_BOUNDS = \{[^\r\n]+\};)', "`$1`r`n$boundsConst" }

        $runtimeEntry = @"
  "$countyId": Object.freeze({
    id: "$countyId",
    name: "$name County",
    state: "TX",
    defaultCity: "$defaultCity",
    stage: GRIDLY_COUNTY_STAGE_OPERATIONAL,
    operational: true,
    productionEnabled: true,
    selectable: true,
    packageRoot: "assets/county-implementation/$slug/",
    manifestPath: "Community-Packages/$slug/package-manifest.json",
    boundaryPath: "assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson",
    boundarySource: "standard Texas county boundary overlay GEOID $($result.deterministic.boundary.geoid)",
    roadSegmentsPath: null,
    roadSegmentsPathPrevious: "assets/county-implementation/$slug/runtime-assets/source/tl_2025_$($result.deterministic.boundary.geoid)_roads.shp",
    crossingsPath: null,
    localCrossingsPath: "assets/county-implementation/$slug/runtime-assets/$slug-county-rail-crossings.geojson",
    crossingOverridesPath: "assets/county-implementation/$slug/runtime-assets/$slug-county-crossing-review-overrides.json",
    defaultAwarenessAreas: [$(ConvertTo-JsStringArray $areaNames)],
    runtimeSourceOwner: "$slug-owned",
    runtimeSourceAvailability: Object.freeze({ boundary: "available", roads: "source-available", crossings: "available", awarenessAreas: "available" }),
    controlledPromotion: Object.freeze({ milestone: "V793", status: "controlled-enabled", readinessGate: "READY FOR CONTROLLED PROMOTION" })
  }),
"@
        $app = $app -replace '(?s)(  "chambers-tx": Object\.freeze\(\{.*?\n  \}\),\r?\n)', "`$1$runtimeEntry"
        $boundsEntry = '  "' + $countyId + '": Object.freeze({ ...' + ($slug.ToUpperInvariant() -replace '-', '_') + '_COUNTY_AWARENESS_BOUNDS, source: "' + $slug + '-controlled-promotion-bounds-v793" })'
        $app = $app -replace '(  "chambers-tx": Object\.freeze\(\{ \.\.\.CHAMBERS_COUNTY_AWARENESS_BOUNDS, source: "chambers-controlled-promotion-bounds-v788" \}\))', "`$1,`r`n$boundsEntry"
        $areaLines = @($areas | ForEach-Object { '  { key: "' + $_.key + '", label: "' + $_.label + '", storageValue: "' + $_.storageValue + '", countyId: "' + $countyId + '", lat: ' + $_.lat + ', lng: ' + $_.lng + ', radiusMiles: null, startupZoom: 10, countyWide: true, source: "' + $name + ' V793 controlled promotion anchor" },' }) -join "`r`n"
        $app = $app -replace '(  \{ key: "cove"[^\r\n]+\},\r?\n)', "`$1$areaLines`r`n"
        $homeLine = '  "' + $countyId + '": [' + (ConvertTo-JsStringArray $areaNames) + ']'
        $app = $app -replace '(  "chambers-tx": \[GRIDLY_CHAMBERS_COUNTY_WIDE_HOME_TOWN, "Anahuac", "Mont Belvieu", "Winnie", "Beach City", "Cove"\])', "`$1,`r`n$homeLine"
        $app = $app -replace '(const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object\.freeze\(\[[^\]]*)\]\);', '`$1, "' + $countyId + '"]);'
    }

    Set-FileContentUtf8Bom $registryPath $registry
    Set-FileContentUtf8Bom $appPath $app
    $changed.Add($registryPath)
    $changed.Add($appPath)
    return @($changed | Sort-Object -Unique)
}

$script:RepoRoot = Get-RepoRoot
$counties = Get-CountyListFromInput
$results = @()
$hasBlocked = $false
$writeModeEnabled = $true

foreach ($countyName in $counties) {
    $readiness = Invoke-Readiness $countyName
    $deterministic = Test-DeterministicPlan $readiness
    $plan = New-Plan $readiness $deterministic
    $status = "READY"
    $blockedReason = $null

    if ($readiness.finalStatus -eq "ALREADY OPERATIONAL") {
        $status = "REFUSED"
        $blockedReason = "County is already operational; deterministic writer does not support re-promotion or -Force."
        $hasBlocked = $true
    }
    elseif ($readiness.finalStatus -ne "READY FOR CONTROLLED PROMOTION") {
        $status = "REFUSED"
        $blockedReason = "Readiness gate returned '$($readiness.finalStatus)' instead of READY FOR CONTROLLED PROMOTION."
        $hasBlocked = $true
    }
    elseif (-not $deterministic.safeToWrite) {
        $status = if ($WhatIf) { "BLOCKED FOR DETERMINISTIC WRITE" } else { "BLOCKED FOR WRITE MODE" }
        $blockedReason = "Deterministic writer safety gates failed: $($deterministic.blockers -join ' | ')"
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
        deterministic = $deterministic
        readiness = $readiness
    }
}

$changedFiles = @()
$promotedCounties = @()
if (-not $WhatIf -and -not $hasBlocked) {
    $changedFiles = Apply-PromotionBatch $results
    $promotedCounties = @($results | ForEach-Object { $_.county })
    foreach ($result in $results) { $result.status = "PROMOTED" }
}

$output = [pscustomobject]@{
    title = "GRIDLY COUNTY PROMOTION DETERMINISTIC WRITER"
    version = "V793"
    mode = if ($WhatIf) { "WhatIf" } else { "Write" }
    writeModeEnabled = $writeModeEnabled
    allOrNothing = $true
    changedFiles = $changedFiles
    countiesPromoted = $promotedCounties
    packageContentsChanged = $false
    protectedSystemsChanged = $false
    results = $results
}

if ($Json) {
    $output | ConvertTo-Json -Depth 14
    if ($hasBlocked) { exit 2 }
    exit 0
}

Write-Host "GRIDLY COUNTY PROMOTION DETERMINISTIC WRITER"
Write-Host "Mode: $($output.mode)"
Write-Host "Write Mode Enabled: $writeModeEnabled"
Write-Host "All Or Nothing: true"
if ($changedFiles.Count -gt 0) { Write-Host ("Changed Files: {0}" -f ($changedFiles -join ", ")) }
if ($promotedCounties.Count -gt 0) { Write-Host ("Counties Promoted: {0}" -f ($promotedCounties -join ", ")) }
Write-Host ""
foreach ($result in $results) {
    Write-Host ("County: {0}" -f $result.county)
    Write-Host ("Readiness: {0}" -f $result.readinessStatus)
    Write-Host ("Status: {0}" -f $result.status)
    if ($result.blockedReason) { Write-Host ("Blocked Reason: {0}" -f $result.blockedReason) }
    Write-Host "Would Change Files:"
    foreach ($file in $result.plan.wouldChangeFiles) { Write-Host ("- {0}: {1}" -f $file.path, $file.purpose) }
    Write-Host "Deterministic Writer Gates:"
    if ($result.deterministic.blockers.Count -eq 0) { Write-Host "- PASS" } else { foreach ($blocker in $result.deterministic.blockers) { Write-Host ("- BLOCKED: {0}" -f $blocker) } }
    Write-Host "Would Activate State:"
    $result.plan.activeState.PSObject.Properties | ForEach-Object { Write-Host ("- {0}: {1}" -f $_.Name, $_.Value) }
    Write-Host ""
}

if ($hasBlocked) { exit 2 }
exit 0
