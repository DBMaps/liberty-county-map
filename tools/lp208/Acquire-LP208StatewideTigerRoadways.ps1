[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [ValidateSet('WhatIf', 'Verify', 'Acquire')] [string] $Mode = 'WhatIf',
  [string] $Destination = 'C:\GitHub\Gridly-Source-Data\Census\TIGER2025\ROADS'
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$tool = Join-Path $repo 'tools/lp208/statewide-tiger2025-roadway-source.mjs'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if ($Mode -eq 'Acquire' -and -not $PSCmdlet.ShouldProcess($Destination, 'Sequentially acquire the frozen LP208 source cohort')) { return }
$modeArg = '--' + $Mode.ToLowerInvariant()
& node $tool $modeArg --destination $Destination --write
if ($LASTEXITCODE -ne 0) { throw "LP208 did not reach statewide source certification (exit $LASTEXITCODE). Review the generated acquisition report." }
