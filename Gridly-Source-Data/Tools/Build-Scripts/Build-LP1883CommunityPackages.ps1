[CmdletBinding()]
param(
    [string]$InputDirectory = 'C:\GitHub\Gridly-Source-Data\Processing\Census-Places',
    [string]$RepositoryRoot = 'C:\GitHub\liberty-county-map',
    [string]$OutputDirectory = 'C:\GitHub\Gridly-Source-Data\Processing\Community-Packages\statewide-identity-v1'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Builder = Join-Path $RepositoryRoot 'tools\lp188\manufacture-community-packages.mjs'
$LegacyRoot = Join-Path $RepositoryRoot 'Community-Packages'
if (-not (Test-Path -LiteralPath $Builder -PathType Leaf)) { throw "Repository-controlled LP188.3 builder is absent: $Builder" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js is required to run the approved identity-contract helper.' }

# The Node manufacturer performs both isolated generations, validates hashes,
# and atomically promotes only a complete deterministic output family.
& node $Builder --input $InputDirectory --output $OutputDirectory --legacy-root $LegacyRoot
if ($LASTEXITCODE -ne 0) { throw "LP188.3 manufacturing failed closed with exit code $LASTEXITCODE" }
