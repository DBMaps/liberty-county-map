[CmdletBinding()]
param(
  [ValidateSet('WhatIf','Apply','Verify')][string]$Mode = 'WhatIf',
  [string]$OwnerWorkspace = $(if ($env:LP209_OWNER_WORKSPACE) { $env:LP209_OWNER_WORKSPACE } else { 'C:\GitHub\liberty-county-map\owner-local\lp209-roadway-manufacturing' })
)
$ErrorActionPreference='Stop'
$env:LP209_OWNER_WORKSPACE=$OwnerWorkspace
Write-Host "LP210 mode=$Mode credential present=$([bool]($env:SUPABASE_SERVICE_ROLE_KEY -or $env:GRIDLY_ROADWAY_STORAGE_TOKEN))"
node (Join-Path $PSScriptRoot 'statewide-roadway-publication.mjs') "--mode=$Mode"
if ($LASTEXITCODE -ne 0) { throw "LP210 $Mode failed closed." }
