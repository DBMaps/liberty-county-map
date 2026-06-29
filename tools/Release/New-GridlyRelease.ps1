param(
    [Parameter(Mandatory)]
    [string]$Version,

    [Parameter(Mandatory)]
    [string]$Title
)

$Repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$OutDir = Join-Path $Repo "docs\release-notes"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$SafeTitle = ($Title -replace '[^A-Za-z0-9]+','-').Trim('-').ToUpper()
$OutFile = Join-Path $OutDir "$Version-$SafeTitle.md"

$Branch = git branch --show-current 2>$null
$Commit = git rev-parse --short HEAD 2>$null
$Date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

@"
# $Version — $Title

Generated: $Date

## Branch

$Branch

## Commit

$Commit

## Summary

-

## Files Changed

-

## Testing

-

## Merge Recommendation

- [ ] PASS
- [ ] PASS WITH OBSERVATIONS
- [ ] BLOCKED

## Notes

-
"@ | Set-Content -Encoding UTF8 $OutFile

Write-Host ""
Write-Host "Created:"
Write-Host $OutFile
