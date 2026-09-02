$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not (Test-Path -LiteralPath "js/gridly.local.js" -PathType Leaf)) {
  throw "Missing authoritative js/gridly.local.js. Run: powershell -ExecutionPolicy Bypass -File tools/Setup-GridlyLocalDriveTexas.ps1; then add the existing referrer-restricted ArcGIS key to GRIDLY_RUNTIME_CONFIG. No credential values were printed."
}

node tools/native-provider-config.mjs compose
if ($LASTEXITCODE -ne 0) { throw "Native provider configuration composition failed." }
node tools/native-provider-config.mjs validate
if ($LASTEXITCODE -ne 0) { throw "Native provider configuration validation failed." }
npm run prepare:native
if ($LASTEXITCODE -ne 0) { throw "Native staging failed." }
node tools/native-provider-config.mjs verify-staged
if ($LASTEXITCODE -ne 0) { throw "Native provider consumption verification failed." }

Write-Host "Native staging PASS: Official Roadways uses the composed DriveTexas public-client key; report submission uses the separate tracked Supabase public-client authority. Credential values were not printed."
