[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [string[]] $Fips,
  [switch] $Pilot,
  [ValidateSet('WhatIf', 'Verify', 'Acquire')] [string] $Mode = 'WhatIf',
  [Parameter(Mandatory = $true)] [string] $Destination
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$tool = Join-Path $repo 'tools/lp207/acquire-tiger2025-roadway-source.mjs'
if (-not (Test-Path $tool)) { throw "LP207 repository tool is missing: $tool" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
if (-not $Pilot -and (!$Fips -or $Fips.Count -eq 0)) { throw 'Specify -Pilot or explicit -Fips. This wrapper never defaults to all 226.' }
if ($Pilot -and $Fips) { throw '-Pilot and -Fips are mutually exclusive.' }

$modeArg = '--' + $Mode.ToLowerInvariant()
$arguments = @($tool, $modeArg, '--destination', $Destination, '--json')
if ($Pilot) { $arguments += '--pilot' } else { $arguments += @('--fips', ($Fips -join ',')) }
Write-Host "LP207 source destination: $Destination"
if ($Mode -eq 'Acquire' -and -not $PSCmdlet.ShouldProcess($Destination, 'Acquire governed TIGER2025 roadway source without overwrite')) { exit 0 }
& node @arguments
if ($LASTEXITCODE -ne 0) { throw "LP207 acquisition failed with exit code $LASTEXITCODE" }
