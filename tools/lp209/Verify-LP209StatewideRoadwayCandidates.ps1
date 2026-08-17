[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required.' }
Push-Location $repo
try { & node tools/lp209/statewide-roadway-candidates.mjs --verify }
finally { Pop-Location }
if ($LASTEXITCODE -ne 0) { throw "LP209 committed evidence verification failed closed (exit $LASTEXITCODE)." }
