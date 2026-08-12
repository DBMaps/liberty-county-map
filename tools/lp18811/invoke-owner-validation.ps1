$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $repo
try {
foreach ($name in @('GRIDLY_PROTECTED_URL','GRIDLY_PROTECTED_DEPLOYMENT_ID','GRIDLY_PROTECTED_BUILD_IDENTITY','GRIDLY_VALIDATOR_ACCESS_CLIENT_ID','GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET','GRIDLY_EXECUTOR_IDENTITY_REFERENCE')) { if (-not [Environment]::GetEnvironmentVariable($name)) { throw "Required protected environment input is unavailable: $name" } }
$wave = Get-Content -Raw 'reports/lp18810/validation-waves.json' | ConvertFrom-Json
if ($wave.waves.Count -ne 1 -or $wave.waves[0].waveId -ne 'LP18810-NP-001' -or $wave.waves[0].countyCount -ne 215) { throw 'Governed wave identity/count mismatch' }
if (-not $wave.waves[0].nonProductionValidationAuthorized -or $wave.waves[0].productionDeploymentAuthorized -or $wave.waves[0].productionActivationAuthorized) { throw 'Authorization boundary mismatch' }
$fips = ($wave.waves[0].countyFips -join ',')
Write-Host 'Executing exact governed cohort in OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION only.'
& node 'tools/lp18811/protected-validation-harness.mjs' --wave 'LP18810-NP-001' --county-fips $fips --environment 'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION' --repository-root $repo --protected-url $env:GRIDLY_PROTECTED_URL --deployment-id $env:GRIDLY_PROTECTED_DEPLOYMENT_ID --expected-build-identity $env:GRIDLY_PROTECTED_BUILD_IDENTITY --executor-identity-reference $env:GRIDLY_EXECUTOR_IDENTITY_REFERENCE --no-production-deployment --no-activation --no-public-launch --no-supabase-production-mutation --no-restriction-clearing --no-runtime-operational-membership-mutation --evidence-output 'evidence/lp18811/execution-results/owner-result.json'
if ($LASTEXITCODE -ne 0) { throw "Protected validation command failed: $LASTEXITCODE" }
npm run build:lp18811
npm run test:lp18811
npm run verify:lp18811
} finally {
  Pop-Location
}
