param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-z0-9]{20}$')][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$Repository,
  [string]$ReviewDirectory = (Join-Path $env:TEMP 'gridly-lp169-remaining-review'),
  [string]$Attestation = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Capture = Join-Path $PSScriptRoot 'capture-owner-production-evidence.ps1'
& $Capture -ProjectRef $ProjectRef -Repository $Repository -ReviewDirectory $ReviewDirectory

$Template = Join-Path $ReviewDirectory 'owner-attestation.json'
if (-not $Attestation) {
  node (Join-Path $PSScriptRoot 'build-remaining-production-evidence.mjs') --template $Template $ProjectRef
  if ($LASTEXITCODE -ne 0) { throw 'Safe owner-attestation template generation failed.' }
  Write-Host 'OWNER_REMAINING_CONFIGURATION_EVIDENCE_REQUIRED'
  Write-Host "Complete every field in $Template with a value or UNKNOWN/NOT_CONFIGURED, then rerun this same command with -Attestation `"$Template`"."
  exit 2
}

node (Join-Path $PSScriptRoot 'build-remaining-production-evidence.mjs') --ingest $ReviewDirectory $Attestation $ProjectRef
if ($LASTEXITCODE -ne 0) { throw 'Remaining evidence validation or atomic ingestion failed; input was not displayed.' }
npm run certify:lp169
npm run verify:lp169
Write-Host 'LP169 remaining evidence reconciled without mutation, deployment, activation, distribution, or secret-value reads.'
