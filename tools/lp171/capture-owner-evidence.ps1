param([Parameter(Mandatory=$true)][string]$Repository,[Parameter(Mandatory=$true)][string]$ProjectRef,[string]$AttestationPath="evidence/lp171/owner-attestations.json")
$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $root
function Fail([string]$Message) { Write-Error $Message; exit 1 }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Fail "LP171 capture stopped: gh is required for sanitized read-only metadata." }
$supabase = Get-Command supabase -ErrorAction SilentlyContinue
if (-not $supabase) { $supabaseCommand = @("npx","--yes","supabase") } else { $supabaseCommand = @("supabase") }
# These probes only establish tool/account accessibility. Raw authenticated output is discarded.
& gh repo view $Repository --json nameWithOwner,isPrivate *> $null
if ($LASTEXITCODE -ne 0) { Fail "LP171 capture stopped: GitHub metadata was unavailable." }
if ($supabaseCommand[0] -eq "supabase") { & supabase projects list *> $null } else { & npx --yes supabase projects list *> $null }
if ($LASTEXITCODE -ne 0) { Fail "LP171 capture stopped: Supabase metadata was unavailable." }
if (-not (Test-Path $AttestationPath)) { Fail "LP171 capture stopped: owner attestation file is missing." }
# Node validates secret safety and performs atomic deterministic report ingestion.
node tools/lp171/ingest-owner-evidence.mjs $AttestationPath
if ($LASTEXITCODE -ne 0) { Fail "LP171 capture stopped: governed attestation validation failed." }
Write-Output "LP171 owner evidence capture: PASS (read-only metadata; project $ProjectRef; raw output discarded)"
