param([ValidateSet('WhatIf','Apply','Verify')][string]$Mode='WhatIf')
$ErrorActionPreference='Stop'
node (Join-Path $PSScriptRoot 'statewide-roadway-runtime-activation.mjs') "--mode=$Mode"
if ($LASTEXITCODE -ne 0) { throw "LP211 $Mode failed closed." }
