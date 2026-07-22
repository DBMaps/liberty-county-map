<#
LP051.4 owner-side ZIP source acquisition helper (Windows PowerShell 5.1 compatible).
Retains ZIP-related source files under data\source\zip and records checksums without
printing credentials. HUD artifacts may require owner manual download or a token supplied
through GRIDLY_HUD_TOKEN / -HudToken.
#>
param(
  [string]$OutDir = "data/source/zip",
  [string]$HudUrl = $env:GRIDLY_HUD_ZIP_COUNTY_URL,
  [string]$HudToken = $env:GRIDLY_HUD_TOKEN,
  [string]$CensusGazetteerUrl = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip",
  [switch]$SkipCensus
)
$ErrorActionPreference = "Stop"
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$manifestPath = Join-Path $OutDir "gridly-zip-source-acquisition-manifest.json"
$files = @()
$warnings = @()
function Add-ArtifactMetadata([string]$PathValue, [string]$Name, [string]$Version, [string]$Origin, [string]$Redistribution) {
  if (!(Test-Path $PathValue)) { return }
  $item = Get-Item $PathValue
  $hash = (Get-FileHash -Algorithm SHA256 -Path $PathValue).Hash.ToLowerInvariant()
  Write-Host "Source artifact detected: $($item.Name)"
  Write-Host "Checksum generated: $hash"
  $script:files += [ordered]@{ sourceName=$Name; sourceVersion=$Version; acquisitionDate=(Get-Date).ToString('yyyy-MM-dd'); sourceUrlOrOrigin=$Origin; path=$PathValue.Replace('\\','/'); originalFilename=$item.Name; fileSize=$item.Length; sha256=$hash; redistributionAllowed=$Redistribution }
}
if ($HudUrl) {
  $hudTarget = Join-Path $OutDir (Split-Path $HudUrl -Leaf)
  try {
    $headers = @{}
    if ($HudToken) { $headers['Authorization'] = "Bearer $HudToken"; Write-Host "Authentication required: using GRIDLY_HUD_TOKEN without printing token value" }
    Invoke-WebRequest -Uri $HudUrl -Headers $headers -OutFile $hudTarget -UseBasicParsing
    Add-ArtifactMetadata $hudTarget "HUD USPS ZIP Code Crosswalk" "owner_supplied_url" $HudUrl "Review HUD terms before committing raw files."
  } catch {
    $warnings += "HUD automated acquisition failed: $($_.Exception.Message)"
    Write-Warning "HUD automated acquisition failed. Manual download required."
  }
} else {
  $warnings += "HUD automated URL not supplied. Set GRIDLY_HUD_ZIP_COUNTY_URL or manually place the official HUD ZIP-County Crosswalk CSV/XLSX/ZIP in data/source/zip."
  Write-Host "Authentication required or manual download required: HUD URL not supplied."
}
if (!$SkipCensus) {
  $censusTarget = Join-Path $OutDir (Split-Path $CensusGazetteerUrl -Leaf)
  try {
    Invoke-WebRequest -Uri $CensusGazetteerUrl -OutFile $censusTarget -UseBasicParsing
    Add-ArtifactMetadata $censusTarget "Census Gazetteer ZCTA supporting source" "2025" $CensusGazetteerUrl "Public Census geography; verify current Census terms before redistribution."
  } catch {
    $warnings += "Census supporting acquisition failed: $($_.Exception.Message)"
    Write-Warning "Census supporting acquisition failed; HUD import may still proceed if retained manually."
  }
}
Get-ChildItem -Path $OutDir -File | Where-Object { $_.Name -notlike '*.json' } | ForEach-Object {
  $currentFile = $_
  if (($files | Where-Object { $_.originalFilename -eq $currentFile.Name }).Count -eq 0) { Add-ArtifactMetadata $currentFile.FullName "Owner-retained ZIP source artifact" "manual" "manual owner placement" "Review source terms before committing raw files." }
}
$status = if ($files.Count -gt 0) { "Import ready" } else { "Import blocked" }
if ($files.Count -eq 0) { Write-Host "Source artifact missing" }
Write-Host $status
@{ milestone='LP051.4'; ownerSideWorkflow=$true; acquisitionDate=(Get-Date).ToString('yyyy-MM-dd'); sourceFiles=$files; sourceAcquisitionWarnings=$warnings; missingSourceRequirements=if($files.Count -eq 0){@('Place official HUD ZIP-County Crosswalk artifact under data/source/zip or provide GRIDLY_HUD_ZIP_COUNTY_URL with GRIDLY_HUD_TOKEN when required.')}else{@()} } | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $manifestPath
Write-Host "Metadata written: $manifestPath"
