param(
    [Parameter(Mandatory)]
    [string]$Version,

    [Parameter(Mandatory)]
    [string]$Title,

    [ValidateSet("Patch","Feature","Platform")]
    [string]$Level = "Feature"
)

$Root = Split-Path -Parent $PSScriptRoot
$Repo = Split-Path -Parent $Root
$OutputDir = Join-Path $Repo "docs\certifications"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$SafeTitle = ($Title -replace '[^A-Za-z0-9]+','-').Trim('-').ToUpper()

$LevelLabel = switch ($Level) {
    "Patch"    { "Level 1 — Patch" }
    "Feature"  { "Level 2 — Feature" }
    "Platform" { "Level 3 — Platform" }
}

$OutFile = Join-Path $OutputDir "$Version-$SafeTitle-CERTIFICATION.md"

@"
# $Version — $Title Certification

## Certification Level
$LevelLabel

## Summary

-

## Runtime Health

- [ ] Application loads
- [ ] No JavaScript errors
- [ ] Map initializes
- [ ] Awareness Brief renders
- [ ] Community Pulse renders

## Production Validation

- [ ] Production runtime verified
- [ ] Production manifest verified
- [ ] County packages verified

## Protected Systems

- [ ] Shared Reports
- [ ] Route Watch
- [ ] Awareness Filtering
- [ ] Hazard Lifecycle
- [ ] Alert Generation
- [ ] Supabase Sync

## Console / Audit Evidence

### Console

```text

```

### Audit Helpers

```text

```

## Findings

### Pass

-

### Observations

-

### Blocked

-

## Release Decision

- [ ] PASS
- [ ] PASS WITH OBSERVATIONS
- [ ] BLOCKED
"@ | Set-Content -Encoding UTF8 $OutFile

Write-Host ""
Write-Host "Created:"
Write-Host $OutFile
