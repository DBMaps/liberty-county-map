param(
  [string]$DuckDb = "duckdb",
  [string]$TexasGeometry = "owner-local/lp24111/tl_2025_us_county.shp"
)
$ErrorActionPreference = "Stop"
$release = "2026-08-19.0"
$sqlPath = "tools/lp24111/extract-texas.sql"
if (-not (Test-Path $TexasGeometry)) { throw "Missing authoritative Census county geometry: $TexasGeometry" }
if (-not (Test-Path $sqlPath)) { throw "Missing extraction program: $sqlPath" }
New-Item -ItemType Directory -Force owner-local/lp24111 | Out-Null

# DuckDB dot commands are CLI syntax, not SQL accepted by -c.  Send one complete
# SQL program on stdin so execution is identical in DuckDB 1.5.5 and PowerShell 5.1.
$escapedGeometry = $TexasGeometry.Replace("'", "''")
$preamble = "SET VARIABLE release_id='$release';`nSET VARIABLE texas_geometry='$escapedGeometry';`n"
$program = $preamble + [Environment]::NewLine + (Get-Content -Raw $sqlPath)
$program | & $DuckDb
if ($LASTEXITCODE -ne 0) { throw "DuckDB extraction failed ($LASTEXITCODE)" }
