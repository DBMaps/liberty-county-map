[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string] $SourceRoot = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\ROADS',
  [string] $OutputRoot = '',
  [string] $DeterminismRoot = '',
  [string] $GdalExecutable = 'C:\Program Files\QGIS 3.44.11\bin\ogr2ogr.exe'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $OutputRoot) { $OutputRoot = Join-Path $repo 'owner-local/lp209-roadway-manufacturing' }
if (-not $DeterminismRoot) { $DeterminismRoot = Join-Path $repo 'owner-local/lp209-roadway-determinism' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not $PSCmdlet.ShouldProcess($DeterminismRoot, 'Rerun 11 LP209 controls and test five owner candidates')) { return }
$env:LP209_SOURCE_ROOT=$SourceRoot; $env:LP209_OUTPUT_ROOT=$OutputRoot; $env:LP209_DETERMINISM_ROOT=$DeterminismRoot; $env:LP209_GDAL=$GdalExecutable
@'
import { runOwnerFinal } from './tools/lp209/final-certification.mjs';
await runOwnerFinal({sourceRoot:process.env.LP209_SOURCE_ROOT,outputRoot:process.env.LP209_OUTPUT_ROOT,determinismRoot:process.env.LP209_DETERMINISM_ROOT,gdal:process.env.LP209_GDAL});
'@ | & node --input-type=module
if ($LASTEXITCODE -ne 0) { throw "LP209 final owner certification failed closed (exit $LASTEXITCODE)." }
