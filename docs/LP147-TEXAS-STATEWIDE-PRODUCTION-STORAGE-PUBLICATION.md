# LP147 — Texas Statewide Production Storage Publication

## Corrected production baseline

Owner-observed production SQL supersedes the incomplete repository-only LP146 observation. The private `certified-addresses` bucket contains 315 total objects, including 28 address packages and 28 runtime certificates for the existing operational cohort. Therefore the publication starting point is **56 of 508 expected county objects present**, with **226 packages and 226 certificates (452 objects) remaining**. The earlier `1 present / 253 absent` conclusion is not authoritative production truth.

The LP147 program does not encode those observed counts. It independently downloads every expected object and compares its byte length and SHA-256 with the existing repository evidence.

## Safety boundary

This is an owner-executed production operation. Codex did not receive or use production credentials and did not perform an upload. The workflow reads the LP130 inventory, requires all 254 existing package byte streams, validates their size and SHA-256, and validates each existing runtime certificate before Storage access. It never rebuilds a package or regenerates a certificate. It does not alter runtime membership, geometry membership, planner logic, Edge Functions, application code, or county activation.

Matching remote objects are skipped. Missing objects are created with upsert disabled, then downloaded and byte-verified. Inaccessible and unverifiable objects are never overwritten. Mismatches are reported and blocked by default; `--replace-mismatched` is available only with an explicit upload command after the owner investigates and authorizes replacement. A report checkpoint is atomically persisted after every object, so rerunning `--upload` is the supported resume procedure: the remote state, rather than a potentially stale local cursor, determines what remains.

## Owner procedure — Windows PowerShell

Run from `C:\GitHub\liberty-county-map` in a PowerShell session that has Node.js installed. Keep credentials in the process environment; never put them in a tracked file or command transcript.

```powershell
Set-Location C:\GitHub\liberty-county-map
$env:SUPABASE_URL = 'https://<project-ref>.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = Read-Host 'Supabase service-role key'

npm run test:lp147
npm run plan:lp147
npm run upload:lp147
npm run verify-remote:lp147
```

The default package directory is `data\generated\lp104\txgio-addresses`. If the byte-identical LP130 packages and existing certificates are securely mounted elsewhere, append arguments directly:

```powershell
node tools/lp147/publish-statewide-storage.mjs --plan --package-directory D:\Gridly\certified-addresses
node tools/lp147/publish-statewide-storage.mjs --upload --package-directory D:\Gridly\certified-addresses
node tools/lp147/publish-statewide-storage.mjs --verify-remote --package-directory D:\Gridly\certified-addresses
```

If a run is interrupted, repeat the exact upload command. Do not rebuild artifacts and do not use the replacement flag merely to resume. When finished, remove secrets from the session:

```powershell
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:SUPABASE_URL
```

## Acceptance evidence

Retain `reports/lp147/statewide-storage-publication.json` from the final standalone `--verify-remote` run. Acceptance requires:

* `mode` is `verify-remote` and `outcome` is `STATEWIDE_STORAGE_VERIFIED`;
* `expectedCounties` and `totals.counties` are 254;
* `totals.expectedObjects` and `totals.matching` are 508;
* `totals.missing`, `mismatched`, `inaccessible`, `unverifiable`, and `uploadFailed` are zero;
* there are 254 matching package entries and 254 matching certificate entries;
* `localArtifactsModified` and `runtimeMembershipModified` remain `false`.

Bucket-wide object count is contextual, not an acceptance shortcut: unrelated bucket objects explain why the owner observed 315 total objects even though only 56 were county package/certificate objects. LP147 succeeds only from direct authenticated download and hash verification of all 508 expected county objects.
