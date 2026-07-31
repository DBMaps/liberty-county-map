# LP106 — Texas authoritative address coverage audit

## Decision boundary

LP106 adds a deterministic, aggregate-only audit for the unresolved `274 County Road 677, Dayton, Texas 77535` source conflict. It does not rebuild a package, emit an address feature, alter a certificate, authorize runtime use, or convert a resident claim into an authoritative coordinate.

The immutable TxGIO geodatabase and NAD R23 archive are intentionally not stored in this checkout. Therefore the result in this workspace is:

> **SOURCE UNAVAILABLE / LIVE QUERY NOT EXECUTED**

This means the source snapshots could not be queried here. It does **not** mean that either source lacks Texas, Liberty County, County Road 677, or the target address. “Source absent” and equivalent conclusions are prohibited without a completed query against an identified immutable snapshot.

## Audit contract

`tools/lp106/audit-authoritative-address-coverage.mjs`:

* accepts independently optional TxGIO and NAD source paths, so one available source can still produce governed evidence;
* calculates a deterministic SHA-256 identity before querying each source and verifies that every hashed file remains unchanged;
* invokes `ogrinfo` with `-ro -so -where` as separate process arguments, without a shell;
* performs bounded exact-candidate counts for house 274, governed road-677 spellings, Dayton, ZIP 77535, and Liberty County/FIPS 48291;
* emits no feature rows, coordinates, user paths, packages, or certificates;
* records an unavailable source as `SOURCE UNAVAILABLE / LIVE QUERY NOT EXECUTED`, with `exactFound: null` rather than false;
* treats a zero as evidence only for the identified snapshot and never as generalized source absence; and
* writes one atomic JSON evidence report under the selected reports directory.

If an exact candidate is counted, an authorized reviewer must inspect source provenance and fields before any targeted deterministic rebuild is considered. If both identified snapshots return zero, the correct finding is only `NO_EXACT_CANDIDATE_IN_QUERIED_SNAPSHOTS`. Neither outcome authorizes production mutation.

## Governed source hierarchy assessment

The machine-readable assessment is `data/lp106/governed-source-hierarchy.json`. The hierarchy separates authority from convenience:

1. An originating Liberty County or regional 911 address authority is preferred for adjudicating locally assigned rural addresses, subject to written access and reuse approval.
2. TxGIO is the official statewide aggregator and the governed manufacturing source for the current package, but LP105 licensing gates remain fail-closed.
3. NAD R23 is an official federal aggregator and independent pinned-release corroboration source; contributor provenance and release rights still matter.
4. County appraisal situs data can corroborate an address but must not automatically be treated as an entrance/address point.
5. Licensed open aggregators may identify gaps but cannot unilaterally create authoritative records.
6. A resident claim initiates verification; it cannot manufacture a certified coordinate.

Ranking never makes conflicts self-resolving. Snapshot identity, originating-source provenance, precision, licensing, and deterministic certification remain mandatory.

## Exact PowerShell 5.1 local audit block

Run from the repository root on the machine holding the two immutable source artifacts. The block deliberately hashes the NAD archive and a stable, sorted manifest of every TxGIO GDB file both before and after the audit. It stops if either immutable identity changes. Replace only the three path values at the top if the documented defaults differ.

```powershell
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$Repo = (Get-Location).Path
$TxgioGdb = 'C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb'
$NadArchive = 'C:\GitHub\Gridly-Source-Data\National-Address-Database\NAD_r23.zip'
$GdalBin = 'C:\Program Files\QGIS 3.44.11\bin'
$Ogrinfo = Join-Path $GdalBin 'ogrinfo.exe'
$Reports = Join-Path $Repo 'reports\lp106'

if (-not (Test-Path -LiteralPath $TxgioGdb -PathType Container)) { throw "TxGIO GDB not found: $TxgioGdb" }
if (-not (Test-Path -LiteralPath $NadArchive -PathType Leaf)) { throw "NAD R23 archive not found: $NadArchive" }
if (-not (Test-Path -LiteralPath $Ogrinfo -PathType Leaf)) { throw "ogrinfo not found: $Ogrinfo" }

function Get-ImmutableDirectoryIdentity([string]$Path) {
  $Root = (Resolve-Path -LiteralPath $Path).Path
  $Lines = Get-ChildItem -LiteralPath $Root -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
      $Relative = $_.FullName.Substring($Root.Length).TrimStart('\').Replace('\', '/')
      $Digest = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      '{0}|{1}|{2}' -f $Relative, $_.Length, $Digest
    }
  $Utf8 = New-Object System.Text.UTF8Encoding($false)
  $Bytes = $Utf8.GetBytes(($Lines -join "`n") + "`n")
  $Sha = [System.Security.Cryptography.SHA256]::Create()
  try { ([BitConverter]::ToString($Sha.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant() }
  finally { $Sha.Dispose() }
}

$TxgioBefore = Get-ImmutableDirectoryIdentity $TxgioGdb
$NadBefore = (Get-FileHash -LiteralPath $NadArchive -Algorithm SHA256).Hash.ToLowerInvariant()

& node '.\tools\lp106\audit-authoritative-address-coverage.mjs' `
  --txgio-gdb $TxgioGdb `
  --nad-archive $NadArchive `
  --gdal $Ogrinfo `
  --reports $Reports
if ($LASTEXITCODE -ne 0) { throw "LP106 audit failed with exit code $LASTEXITCODE" }

$TxgioAfter = Get-ImmutableDirectoryIdentity $TxgioGdb
$NadAfter = (Get-FileHash -LiteralPath $NadArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($TxgioBefore -ne $TxgioAfter) { throw 'IMMUTABILITY FAILURE: TxGIO GDB changed during the audit.' }
if ($NadBefore -ne $NadAfter) { throw 'IMMUTABILITY FAILURE: NAD R23 archive changed during the audit.' }

$Report = Join-Path $Reports 'lp106-authoritative-address-coverage-audit.json'
Get-Content -LiteralPath $Report -Raw
Write-Host "TxGIO immutable identity: $TxgioAfter"
Write-Host "NAD R23 SHA-256: $NadAfter"
Write-Host "LP106 report: $Report"
```

The report should be retained with its two source identities and reviewed as evidence. Do not commit the immutable sources or any report containing local paths. The tool redacts source paths from its JSON output.

## Synthetic and regression verification

```bash
npm run test:lp106
node --test tests/lp1042-nad-r23-inspection.test.mjs tests/lp1043-nad-r23-measurement.test.mjs tests/lp1044-txgio-address-builder.test.mjs tests/lp1044-txgio-address-query.test.mjs tests/lp105-texas-statewide-readiness.test.mjs tests/lp1055-liberty-274-source-conflict.test.mjs
npm run audit:lp106 -- --generated-at 2026-07-31T00:00:00.000Z
```

The last command is the expected no-large-source workspace proof and must report `SOURCE UNAVAILABLE / LIVE QUERY NOT EXECUTED`, not source absence.
