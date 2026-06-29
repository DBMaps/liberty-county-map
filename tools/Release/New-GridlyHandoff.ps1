param(
    [Parameter(Mandatory)]
    [string]$Version,

    [Parameter(Mandatory)]
    [string]$Title
)

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OutDir = Join-Path $Repo "docs\handoffs"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$SafeTitle = ($Title -replace '[^A-Za-z0-9]+','-').Trim('-').ToUpper()
$OutFile = Join-Path $OutDir "$Version-$SafeTitle-HANDOFF.md"

$Branch = git branch --show-current 2>$null
$Commit = git rev-parse --short HEAD 2>$null
$Date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

@"
# $Version — $Title Handoff

Generated: $Date

## Branch
$Branch

## Commit
$Commit

## Completed

-

## Current Status

-

## Validation Performed

-

## Remaining Work

-

## Known Issues

None documented.

## Next Recommended Task

-

## Notes

-
"@ | Set-Content -Encoding UTF8 $OutFile

Write-Host ""
Write-Host "Created:"
Write-Host $OutFile
