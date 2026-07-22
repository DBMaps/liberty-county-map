<#
LP051.3 authoritative ZIP source import helper (Windows PowerShell 5.1 compatible).
Attempts deterministic source acquisition when the owner supplies an approved public URL or HUD token workflow, then writes the blocked/derived manifest used by this branch.
#>
param(
  [string]$SourceUrl = "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2025_Gazetteer/2025_Gaz_zcta_national.zip",
  [string]$OutDir = "data/source/zip"
)
$ErrorActionPreference = "Stop"
if (!(Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$target = Join-Path $OutDir (Split-Path $SourceUrl -Leaf)
try {
  Invoke-WebRequest -Uri $SourceUrl -OutFile $target -UseBasicParsing
  $hash = (Get-FileHash -Algorithm SHA256 -Path $target).Hash.ToLowerInvariant()
  Write-Host "Downloaded $target"
  Write-Host "SHA256 $hash"
} catch {
  Write-Warning "Source acquisition failed. Do not fabricate ZIP authority. Error: $($_.Exception.Message)"
  exit 2
}
