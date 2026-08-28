param(
  [string]$DuckDb = "duckdb",
  [string]$TexasGeometry = "owner-local/lp24111/tl_2025_us_county.shp"
)
$ErrorActionPreference = "Stop"
$release = "2026-08-19.0"
if (-not (Test-Path $TexasGeometry)) { throw "Missing authoritative Census county geometry: $TexasGeometry" }
New-Item -ItemType Directory -Force owner-local/lp24111 | Out-Null
& $DuckDb -c "SET VARIABLE release_id='$release'; SET VARIABLE texas_geometry='$($TexasGeometry.Replace("'", "''"))'; .read tools/lp24111/extract-texas.sql"
if ($LASTEXITCODE -ne 0) { throw "DuckDB extraction failed ($LASTEXITCODE)" }
