[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath = "artifacts/harris-roadway-partition-analysis.json",

  [int[]]$GridSizes = @(4, 6, 8, 10),

  [int[]]$TargetPackageSizesMb = @(5, 10, 12, 15, 20),

  [int]$LargestFeatureCount = 25
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-PercentileValue {
  param([long[]]$Values, [double]$Percentile)
  if (-not $Values -or $Values.Count -eq 0) { return 0 }
  $sorted = @($Values | Sort-Object)
  $index = [Math]::Ceiling(($Percentile / 100.0) * $sorted.Count) - 1
  if ($index -lt 0) { $index = 0 }
  if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
  return [long]$sorted[$index]
}

function Get-CoordinateBounds {
  param($Coordinates)
  $state = [ordered]@{ MinX = $null; MinY = $null; MaxX = $null; MaxY = $null }
  $stack = New-Object System.Collections.Stack
  $stack.Push($Coordinates)
  while ($stack.Count -gt 0) {
    $item = $stack.Pop()
    if ($item -is [System.Array] -and $item.Count -ge 2 -and $item[0] -is [ValueType] -and $item[1] -is [ValueType]) {
      $x = [double]$item[0]; $y = [double]$item[1]
      if ($null -eq $state.MinX -or $x -lt $state.MinX) { $state.MinX = $x }
      if ($null -eq $state.MaxX -or $x -gt $state.MaxX) { $state.MaxX = $x }
      if ($null -eq $state.MinY -or $y -lt $state.MinY) { $state.MinY = $y }
      if ($null -eq $state.MaxY -or $y -gt $state.MaxY) { $state.MaxY = $y }
    } elseif ($item -is [System.Collections.IEnumerable] -and -not ($item -is [string])) {
      foreach ($child in $item) { $stack.Push($child) }
    }
  }
  return $state
}


function Get-TargetSizeEstimate {
  param(
    [long]$TotalByteLength,
    [long]$TotalFeatureCount,
    [int[]]$TargetPackageSizesMb,
    [long]$HardMaximumMb = 20,
    [double]$VarianceFactor = 0.35
  )
  $hardMaximumBytes = [long]$HardMaximumMb * 1024L * 1024L
  foreach ($targetMb in $TargetPackageSizesMb) {
    if ($targetMb -le 0) { continue }
    $targetBytes = [long]$targetMb * 1024L * 1024L
    $likelyPackageCount = [Math]::Max(1, [Math]::Ceiling($TotalByteLength / [double]$targetBytes))
    $averageBytes = [Math]::Ceiling($TotalByteLength / [double]$likelyPackageCount)
    $averageFeatures = [Math]::Ceiling($TotalFeatureCount / [double]$likelyPackageCount)
    $estimatedMinimumBytes = [long][Math]::Max(1, [Math]::Floor($averageBytes * (1.0 - $VarianceFactor)))
    $estimatedMaximumBytes = [long][Math]::Min($hardMaximumBytes, [Math]::Ceiling($averageBytes * (1.0 + $VarianceFactor)))
    $estimatedMinimumFeatures = [long][Math]::Max(1, [Math]::Floor($averageFeatures * (1.0 - $VarianceFactor)))
    $estimatedMaximumFeatures = [long][Math]::Ceiling($averageFeatures * (1.0 + $VarianceFactor))
    [ordered]@{
      targetMb = $targetMb
      analysisKind = "estimate_only_not_spatial_grouping"
      likelyPackageCount = [int]$likelyPackageCount
      byteLength = [ordered]@{ min = $estimatedMinimumBytes; median = [long]$averageBytes; max = $estimatedMaximumBytes }
      featureCount = [ordered]@{ min = $estimatedMinimumFeatures; median = [long]$averageFeatures; max = $estimatedMaximumFeatures }
      oversizedPackageCount = if ($averageBytes -gt $hardMaximumBytes) { [int]$likelyPackageCount } else { 0 }
      undersizedPackageCount = if ($estimatedMinimumBytes -lt [long](0.5 * $targetBytes)) { [int][Math]::Ceiling($likelyPackageCount * 0.15) } else { 0 }
      representativeBoundsPackageEstimate = "not_available_without_candidate_bounds_or_deterministic_spatial_grouping"
      note = "Estimate spreads serialized feature bytes across target-size packages with a conservative +/- variance factor; it does not generate or certify physical packages."
    }
  }
}

function Add-NameFieldCount {
  param([hashtable]$Counts, [string]$Field, $Value)
  if ([string]::IsNullOrWhiteSpace($Field)) { return }
  if ($null -ne $Value -and -not [string]::IsNullOrWhiteSpace([string]$Value)) {
    $Counts[$Field] = 1 + [int]($Counts[$Field] ?? 0)
  }
}

$resolvedSource = Resolve-Path -LiteralPath $SourcePath
$sourceItem = Get-Item -LiteralPath $resolvedSource
$sourceExtension = $sourceItem.Extension.ToLowerInvariant()
$sourceBytesBefore = $sourceItem.Length

if ($sourceExtension -ne ".geojson" -and $sourceExtension -ne ".json") {
  $sidecars = @(".shp", ".dbf", ".shx", ".prj", ".cpg") | ForEach-Object {
    $path = [System.IO.Path]::ChangeExtension($sourceItem.FullName, $_)
    if (Test-Path -LiteralPath $path) {
      $item = Get-Item -LiteralPath $path
      [ordered]@{ path = $item.FullName; byteLength = $item.Length; present = $true }
    } else {
      [ordered]@{ path = $path; byteLength = 0; present = $false }
    }
  }
  $result = [ordered]@{
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    sourcePath = $sourceItem.FullName
    sourceKind = "non_geojson_source"
    sourceByteLength = $sourceBytesBefore
    sidecars = $sidecars
    analyzed = $false
    reason = "Convert the source to GeoJSON first; this read-only analyzer intentionally does not invoke ogr2ogr or mutate source data."
    recommendedConversionCommand = "ogr2ogr -f GeoJSON <local-output-outside-git>/harris-road-segments.geojson `"$($sourceItem.FullName)`""
    targetSizeEstimateNote = "Target-size package estimates require GeoJSON feature serialization; no packages are generated by this analyzer."
  }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
  $result | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
  Write-Output "Wrote non-GeoJSON source inventory to $OutputPath"
  exit 0
}

$raw = Get-Content -LiteralPath $sourceItem.FullName -Raw
$geojson = $raw | ConvertFrom-Json -Depth 100
if ($geojson.type -ne "FeatureCollection" -or -not ($geojson.features -is [System.Array])) { throw "Source must be a GeoJSON FeatureCollection." }

$geometryCounts = @{}
$propertyFieldCounts = @{}
$roadNameFields = @{}
$featureSummaries = New-Object System.Collections.Generic.List[object]
$invalidGeometryCount = 0
$nullGeometryCount = 0
$duplicateKeys = @{}
$countyBounds = [ordered]@{ minX = $null; minY = $null; maxX = $null; maxY = $null }
$nameCandidates = @("name", "fullname", "full_name", "road_name", "street", "linearid", "LINEARID", "ref", "highway", "tiger:name_base")

for ($i = 0; $i -lt $geojson.features.Count; $i++) {
  $feature = $geojson.features[$i]
  $geometry = $feature.geometry
  $serializedBytes = [Text.Encoding]::UTF8.GetByteCount(($feature | ConvertTo-Json -Depth 100 -Compress))
  if ($null -eq $geometry) { $nullGeometryCount++; $invalidGeometryCount++; continue }
  $geometryType = [string]$geometry.type
  $geometryCounts[$geometryType] = 1 + [int]($geometryCounts[$geometryType] ?? 0)
  if ($feature.properties) {
    foreach ($prop in $feature.properties.PSObject.Properties) {
      $propertyFieldCounts[$prop.Name] = 1 + [int]($propertyFieldCounts[$prop.Name] ?? 0)
      if ($nameCandidates -contains $prop.Name) { Add-NameFieldCount -Counts $roadNameFields -Field $prop.Name -Value $prop.Value }
    }
  }
  $bounds = Get-CoordinateBounds -Coordinates $geometry.coordinates
  if ($null -eq $bounds.MinX) { $invalidGeometryCount++; continue }
  if ($null -eq $countyBounds.minX -or $bounds.MinX -lt $countyBounds.minX) { $countyBounds.minX = $bounds.MinX }
  if ($null -eq $countyBounds.maxX -or $bounds.MaxX -gt $countyBounds.maxX) { $countyBounds.maxX = $bounds.MaxX }
  if ($null -eq $countyBounds.minY -or $bounds.MinY -lt $countyBounds.minY) { $countyBounds.minY = $bounds.MinY }
  if ($null -eq $countyBounds.maxY -or $bounds.MaxY -gt $countyBounds.maxY) { $countyBounds.maxY = $bounds.MaxY }
  $dupKey = "$geometryType|$($bounds.MinX),$($bounds.MinY),$($bounds.MaxX),$($bounds.MaxY)|$($feature.properties.name ?? $feature.properties.LINEARID ?? $feature.id ?? '')"
  $duplicateKeys[$dupKey] = 1 + [int]($duplicateKeys[$dupKey] ?? 0)
  $featureSummaries.Add([ordered]@{ index = $i; geometryType = $geometryType; byteLength = $serializedBytes; bounds = $bounds }) | Out-Null
}

$gridResults = foreach ($gridSize in $GridSizes) {
  $tileCount = $gridSize * $gridSize
  $tiles = @(for ($i = 0; $i -lt $tileCount; $i++) { [ordered]@{ featureCount = 0L; byteLength = 0L; crossingFeatureCount = 0L } })
  $width = ([double]$countyBounds.maxX - [double]$countyBounds.minX) / $gridSize
  $height = ([double]$countyBounds.maxY - [double]$countyBounds.minY) / $gridSize
  foreach ($summary in $featureSummaries) {
    $minCol = [Math]::Max(0, [Math]::Min($gridSize - 1, [Math]::Floor(($summary.bounds.MinX - $countyBounds.minX) / $width)))
    $maxCol = [Math]::Max(0, [Math]::Min($gridSize - 1, [Math]::Floor(($summary.bounds.MaxX - $countyBounds.minX) / $width)))
    $minRow = [Math]::Max(0, [Math]::Min($gridSize - 1, [Math]::Floor(($summary.bounds.MinY - $countyBounds.minY) / $height)))
    $maxRow = [Math]::Max(0, [Math]::Min($gridSize - 1, [Math]::Floor(($summary.bounds.MaxY - $countyBounds.minY) / $height)))
    $primaryIndex = ([int]$minRow * $gridSize) + [int]$minCol
    $tiles[$primaryIndex].featureCount++
    $tiles[$primaryIndex].byteLength += [long]$summary.byteLength
    if ($minCol -ne $maxCol -or $minRow -ne $maxRow) { $tiles[$primaryIndex].crossingFeatureCount++ }
  }
  $featureCounts = [long[]]@($tiles | ForEach-Object { [long]$_.featureCount })
  $byteCounts = [long[]]@($tiles | ForEach-Object { [long]$_.byteLength })
  [ordered]@{
    gridSize = "${gridSize}x${gridSize}"
    packageCount = $tileCount
    emptyTiles = @($tiles | Where-Object { $_.featureCount -eq 0 }).Count
    featureCount = [ordered]@{ min = ($featureCounts | Measure-Object -Minimum).Minimum; median = Get-PercentileValue $featureCounts 50; max = ($featureCounts | Measure-Object -Maximum).Maximum }
    byteLength = [ordered]@{ min = ($byteCounts | Measure-Object -Minimum).Minimum; median = Get-PercentileValue $byteCounts 50; max = ($byteCounts | Measure-Object -Maximum).Maximum }
    boundaryCrossingFeatureCount = [long](($tiles | Measure-Object -Property crossingFeatureCount -Sum).Sum)
  }
}

$result = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  sourcePath = $sourceItem.FullName
  sourceKind = "geojson"
  sourceByteLength = $sourceBytesBefore
  sourceSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $sourceItem.FullName).Hash.ToLowerInvariant()
  sourceUnchanged = ((Get-Item -LiteralPath $sourceItem.FullName).Length -eq $sourceBytesBefore)
  featureCount = $geojson.features.Count
  geometryTypeCounts = $geometryCounts
  nullGeometryCount = $nullGeometryCount
  invalidGeometryCount = $invalidGeometryCount
  propertyFieldInventory = $propertyFieldCounts
  roadNameFieldAvailability = $roadNameFields
  bounds = $countyBounds
  largestFeatures = @($featureSummaries | Sort-Object -Property byteLength -Descending | Select-Object -First $LargestFeatureCount)
  duplicateSegmentIndicatorCount = @($duplicateKeys.GetEnumerator() | Where-Object { $_.Value -gt 1 }).Count
  targetSizeEstimates = @(Get-TargetSizeEstimate -TotalByteLength ([long](($featureSummaries | Measure-Object -Property byteLength -Sum).Sum)) -TotalFeatureCount ([long]$geojson.features.Count) -TargetPackageSizesMb $TargetPackageSizesMb)
  fixedGridCandidates = $gridResults
  notes = @("Read-only analysis only; no GeoJSON packages are generated.", "Boundary-crossing counts use feature bounding boxes and are conservative indicators, not clipped geometry counts.")
}

New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutputPath) | Out-Null
$result | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output "Wrote Harris roadway partition analysis to $OutputPath"
