# LP112 — Governed cohort expansion pilot

## 1. Executive summary and decision

LP112 evaluated a three-county adjacent expansion and exercised the existing LP104.4 → LP105.1 → LP104.6 manufacturing/certification contract without changing a builder or any runtime code. The recommended pilot is **Burleson (48051), Trinity (48455), and Victoria (48469)**. Each is outside the certified 28, directly joins a different edge of that footprint, and avoids a distant metropolitan jump.

The repository-only deterministic contract pilot passed for all three selected identities: two runs produced identical package SHA-256 identities, all six LP104.6 certifications passed, exact/alias lookups passed, all incorrect-number controls returned no result, and no interpolation, nearby-number substitution, cross-FIPS record, activation, or production-manifest mutation occurred. This test uses minimal synthetic address records and proves orchestration behavior only; it is not source-data or production certification.

**Local production-candidate manufacturing is blocked, accurately and fail-closed.** The immutable owner TxGIO FileGDB and GDAL are absent, and `data/lp105/txgio-license-decision.json` remains `UNRESOLVED_FAIL_CLOSED` with `productionEligible: false`. The attempted real command processed all three identities but excluded all three before certificate generation because the configured FileGDB was unavailable. Consequently LP112 creates no address package, manifest, or certificate in the repository and makes no claim that any new county is certified. No Storage upload, remote certification, runtime activation, production cutover, or production-manifest edit occurred.

**Merge recommendation:** merge the bounded test and this evidence document because they add a repeatable, non-runtime expansion gate. Do **not** approve expansion, upload, activation, or cutover. Re-run the exact owner commands in section 10 only after written license authorization and immutable source access; merge production-candidate evidence only if every gate passes.

## 2. Startup verification

LP112 started on branch `work` at commit `fb3f5373502b466a3fc8f22c91e27de78dc8daa0`. `git status --short --branch` reported only the permitted untracked directories `android/.gradle/`, `android/build/`, and `node_modules/`; no tracked file was modified or deleted. Searches from the repository ancestry and across the container found no applicable `AGENTS.md`. The branch name was accepted unchanged.

## 3. Pilot selection and adjacency rationale

The governed footprint is the exact 28 entries marked `initial28` in `data/lp104/texas-counties.json`. Candidate selection deliberately uses the maintained Texas county identities and does not alter that marker.

| Selected county | FIPS | Existing governed neighbor(s) | Rationale |
|---|---:|---|---|
| Burleson | 48051 | Brazos, Washington | Extends the northwest edge with a non-metropolitan rural county and tests a county identity near two governed packages. |
| Trinity | 48455 | Walker, Polk | Extends the northern/eastern inland edge and provides a second rural profile without jumping over an unsupported county. |
| Victoria | 48469 | Jackson, Calhoun | Extends the coastal/southwestern edge and broadens the pilot geographically while remaining contiguous. |

This is the smallest useful three-front pilot: every county shares a land boundary with the current cohort, each addition preserves contiguous coverage, and none is a distant metropolitan county. Urban outliers are intentionally deferred until owner inventory evidence shows whether the already-proven Harris bounded-bucket pattern is required.

## 4. Files created or changed

* `tests/lp112-governed-cohort-expansion-pilot.test.mjs` adds a deterministic contract test for exactly the three selected statewide identities. It invokes the existing `manufacture()` orchestration and real LP104.6 certifier with isolated fixture packages, runs twice, verifies hashes/certificates/negative controls, and asserts that the production manifest is byte-identical.
* `package.json` adds only `test:lp112`; it creates no new builder.
* This document records selection, exact results, blockers, risks, commands, and the decision boundary.

No generated address artifact is tracked because authentic manufacture did not pass. Temporary contract artifacts were created under the operating-system temporary directory and removed by the test. The attempted source run wrote evidence only to `/tmp/lp112-real-pilot`, outside the repository.

## 5. Manufacturing results

### Authentic source attempt

Command:

```text
node tools/lp1051/manufacture-gridly-28-address-counties.mjs --fips 48051,48455,48469 --reports /tmp/lp112-real-pilot
```

Exact result: exit 1; processed 3; succeeded 0; failed 3. Burleson, Trinity, and Victoria were each `buildStatus: FAIL`, `candidateManifestStatus: EXCLUDED`, `runtimeCertificateStatus: NOT_GENERATED`, and `lp1046CertificationStatus: NOT_RUN`. Each failure was the same missing immutable `Texas-2026.gdb` diagnostic. This is the required fail-closed outcome—not permission to manufacture from an alternate or invented source.

### Isolated manufacturing-contract run

The LP112 test selected the same three canonical FIPS values, generated three deterministic fixture gzip packages through an injected LP104 builder boundary, and passed them through the unchanged LP105.1 hashing/certificate/candidate-manifest orchestration and the real LP104.6 certifier. First run: 3/3 succeeded. Second run: 3/3 succeeded and all three were recognized as resumable. Candidate manifests remained `activated: false`.

Fixture output is deliberately not retained, cannot be uploaded, and must not be described as TxGIO evidence. Its role is to prove that the existing selective-FIPS architecture scales beyond an `initial28` identity without duplicate tooling.

## 6. Certification and runtime validation results

For each fixture county, LP104.6 indexed three records and returned `PASS`. Across the first run the exact totals were:

* 9/9 exact samples passed;
* 9/9 incorrect house-number samples returned truthful no-result;
* 9/9 invalid-address samples were rejected;
* 27/27 canonical county-road aliases passed;
* 0 interpolation acceptances and 0 nearby-house substitutions;
* 0 duplicate identities, 0 outside-county records, and 0 invalid records;
* exactly one package load per county;
* runtime certificates agreed with candidate-manifest size and SHA-256 and retained `houseNumber: exact`, `road: canonical_exact`, `interpolation: false`, and `nearbyHouseSubstitution: false`.

The test also confirms the three counties are outside `initial28`, neither candidate manifest is active, and the SHA-256 of the existing production runtime manifest is unchanged. Runtime acceptance itself was not modified or activated. Existing LP104.7/LP108 regression suites remain the authority for county/FIPS conflicts, city/ZIP governance, road-only rejection, fail-closed behavior, and current-cohort runtime acceptance.

## 7. Deterministic evidence

The contract test manufactures the same three byte streams twice with gzip level 9 and zero mtime, independently hashes the final files, and compares the FIPS-to-SHA map from both candidate manifests. All three pairs matched. The second run independently recognized all three sidecar/package pairs as resumable. Temporary directories prevent existing generated artifacts from satisfying the test accidentally.

Authentic deterministic evidence is still absent. It requires two owner runs against the same immutable FileGDB, comparison of package bytes, sidecars, candidate manifests (excluding nondeterministic report timing fields), runtime certificates, and certifications, followed by `--verify-only`-equivalent local integrity checks. No real hash is recorded until those bytes exist.

## 8. Protected systems and current-cohort regression

LP112 changes no Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, Edge function, address runtime, production manifest, or member of the existing 28-county artifact set. It performs no network or Storage operation. The consolidated LP104.4, LP104.6, LP104.7, LP105, LP105.1, LP107, LP108, LP108.9, and LP108.11 suites are the required regression set before owner manufacture evidence can be accepted.

Repository validation completed with these exact results:

* `npm run test:lp112`: 1 test passed; 0 failed, cancelled, skipped, or todo.
* Consolidated LP104.4/LP104.6/LP104.7/LP105/LP105.1/LP107/LP108/LP108.9/LP108.11/LP112 command: 148 tests passed; 0 failed, cancelled, skipped, or todo.
* `node tools/lp107/generate-runtime-certificates.mjs --verify-only`: 28/28 existing counties ready for upload. The command's untracked local report was removed; no governed artifact changed.
* `git diff --check`: passed with no whitespace errors.
* Authentic LP112 manufacture attempt: expected blocker, exit 1; 0/3 built and 3/3 excluded because the immutable owner FileGDB is absent.

Thus the existing 28-county cohort and manufacturing contracts regress cleanly, while authentic pilot certification remains incomplete. The blocker is an environment/governance limitation, not a test waiver.

## 9. Risks, remaining statewide work, and expansion recommendation

* **License/privacy blocker:** production manufacture remains prohibited while the checked-in decision is unresolved. Record affirmative redistribution, derivative-package, browser-delivery, residential-address, attribution, retention, reviewer, and review-date decisions first.
* **Source blocker:** obtain the immutable owner FileGDB and matching GDAL. Preserve source identity; never use `--force` to conceal drift.
* **Evidence limitation:** synthetic contract success does not establish source coverage, accepted/rejected row counts, address quality, package size, or real runtime latency.
* **Adjacency governance:** retain a reviewed adjacency ledger when subsequent waves are chosen; do not infer runtime eligibility from package existence.
* **Capacity:** benchmark authentic package size/load time. Use the existing Harris bucket architecture only when measurements require it; do not create a parallel general builder.
* **Operational separation:** local certification does not authorize Storage, deployment, identity admission, or activation. Those remain later milestones.

After this pilot passes with owner data, expand in small adjacent waves selected from completed inventory evidence. Require two deterministic builds, independent byte/hash verification, exact LP104.6 certification, original-28 regression parity, explicit license approval, and a separately reviewed runtime-cohort change for every wave. Retain the original 28 as the rollback cohort.

## 10. Exact PowerShell validation commands

Run from a clean repository checkout in PowerShell. These commands are local-only and intentionally contain no upload, remote certification, deployment, or activation step.

```powershell
$Repo = 'C:\GitHub\liberty-county-map'
$Gdb = 'C:\GitHub\Gridly-Source-Data\Texas-Address-Points\Raw\Texas-2026.gdb'
$Gdal = 'C:\Program Files\QGIS 3.44.11\bin'
$Fips = '48051,48455,48469'
Set-Location $Repo

git branch --show-current
git rev-parse HEAD
git status --short --branch
Get-ChildItem -Path .. -Filter AGENTS.md -Recurse -Force -ErrorAction SilentlyContinue

# Confirm the owner-controlled prerequisites and affirmative governance first.
if (-not (Test-Path -LiteralPath $Gdb -PathType Container)) { throw "Missing immutable TxGIO source: $Gdb" }
if (-not (Test-Path -LiteralPath (Join-Path $Gdal 'ogr2ogr.exe') -PathType Leaf)) { throw "Missing GDAL ogr2ogr: $Gdal" }
$License = Get-Content .\data\lp105\txgio-license-decision.json -Raw | ConvertFrom-Json
if ($License.productionEligible -ne $true -or $License.status -match 'UNRESOLVED') { throw 'TxGIO production authorization is not affirmative; stop closed.' }

# Preserve the governed production manifest identity.
$ProductionManifest = '.\data\generated\lp104\txgio-addresses\runtime-manifest.json'
$ProductionBefore = (Get-FileHash $ProductionManifest -Algorithm SHA256).Hash

# Manufacture twice into isolated directories; do not target production artifacts.
Remove-Item .\reports\lp112-run-1, .\reports\lp112-run-2, .\reports\lp112-packages-1, .\reports\lp112-packages-2 -Recurse -Force -ErrorAction SilentlyContinue
node .\tools\lp104\build-txgio-address-packages.mjs --fips $Fips --gdb $Gdb --gdal $Gdal --output .\reports\lp112-packages-1
node .\tools\lp1051\manufacture-gridly-28-address-counties.mjs --fips $Fips --gdb $Gdb --gdal $Gdal --reports .\reports\lp112-run-1
node .\tools\lp104\build-txgio-address-packages.mjs --fips $Fips --gdb $Gdb --gdal $Gdal --output .\reports\lp112-packages-2

# Compare the isolated LP104 package bytes deterministically.
$Run1 = Get-ChildItem .\reports\lp112-packages-1\*.addresses.jsonl.gz | Sort-Object Name
$Run2 = Get-ChildItem .\reports\lp112-packages-2\*.addresses.jsonl.gz | Sort-Object Name
if ($Run1.Count -ne 3 -or $Run2.Count -ne 3) { throw 'Expected exactly three packages per run.' }
for ($i = 0; $i -lt 3; $i++) {
  if ($Run1[$i].Name -ne $Run2[$i].Name) { throw 'Package names differ.' }
  $Hash1 = (Get-FileHash $Run1[$i].FullName -Algorithm SHA256).Hash
  $Hash2 = (Get-FileHash $Run2[$i].FullName -Algorithm SHA256).Hash
  if ($Hash1 -ne $Hash2) { throw "Nondeterministic package: $($Run1[$i].Name)" }
}

# Repository contracts and the unchanged current-28/runtime boundary.
npm run test:lp112
node --test .\tests\lp1044-txgio-address-builder.test.mjs .\tests\lp1046-texas-address-certification.test.mjs .\tests\lp1047-multi-county-runtime-activation.test.mjs .\tests\lp105-texas-statewide-readiness.test.mjs .\tests\lp1051-28-county-manufacturing-orchestrator.test.mjs .\tests\lp107-runtime-certificate-readiness.test.mjs .\tests\lp108-storage-and-runtime-certification.test.mjs .\tests\lp1089-streaming-runtime.test.mjs .\tests\lp10811-harris-sidecar.test.mjs
node .\tools\lp107\generate-runtime-certificates.mjs --verify-only

$ProductionAfter = (Get-FileHash $ProductionManifest -Algorithm SHA256).Hash
if ($ProductionAfter -ne $ProductionBefore) { throw 'Production runtime manifest changed; stop.' }
git status --short
```

The owner must redirect or stage the LP105.1 package directory before treating its reports as authentic pilot evidence; its current CLI writes packages to the established local generated-package directory. Review that operation separately and never use `--force` against a certified original-28 artifact. No command above uploads or activates anything.
