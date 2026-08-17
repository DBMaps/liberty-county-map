[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [ValidateSet('WhatIf','Build','Resume','Verify')] [string] $Mode = 'WhatIf',
  [string] $SourceRoot = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\ROADS',
  [string] $OutputRoot = '',
  [string] $GdalExecutable = 'C:\Program Files\QGIS 3.44.11\bin\ogr2ogr.exe'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not $OutputRoot) { $OutputRoot = Join-Path $repo 'owner-local/lp209-roadway-manufacturing' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (($Mode -eq 'Build' -or $Mode -eq 'Resume') -and -not $PSCmdlet.ShouldProcess($OutputRoot, "$Mode 226 inactive roadway candidates")) { return }
$writeReports = 'false'
if ($Mode -eq 'Build' -or $Mode -eq 'Resume') { $writeReports = 'true' }
$js = @"
import { executeOwner } from './tools/lp209/statewide-roadway-candidates.mjs';
const result=await executeOwner({mode:'$($Mode.ToLowerInvariant())',sourceRoot:String.raw`$SourceRoot`,outputRoot:String.raw`$OutputRoot`,gdal:String.raw`$GdalExecutable`,writeReports:$writeReports}); console.log(result.readiness);
"@
$js | & node --input-type=module
if ($LASTEXITCODE -ne 0) { throw "LP209 $Mode failed closed (exit $LASTEXITCODE)." }
