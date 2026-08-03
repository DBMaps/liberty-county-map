# LP113 — Statewide certification generalization

## 1. Startup verification

LP113 started on branch `work` at commit `b46fc4c94b80684cb862aab4eb3764a63036747c`. `git status --short --branch` reported only the permitted untracked `android/.gradle/`, `android/build/`, and `node_modules/` directories. There were no modified or deleted tracked files. `find .. -name AGENTS.md -print` found no applicable repository instructions. Work therefore continued on the existing branch.

## 2. Root cause and demonstrated failure mechanism

The old LP104.6 harness selected the first `sampleSize` physical rows, regardless of whether its own query parser could represent their house number. That parser accepts only digits plus an optional trailing letter. A syntactically authentic package row outside that narrower query grammar (for example, the controlled range fixture `12-14`) was therefore counted as an exact failure even though package integrity and runtime-certificate generation were valid. Because alias checks reused the same unsuitable row, every alias lookup also failed and produced the observed paired messages `exact address sample failed` and `canonical road alias failed`.

Alias selection had a second contract defect: every sampled row was sent through alias testing, and a road outside the four supported production transformations was returned as its own one-item “alias.” That neither proved a canonical transformation nor truthfully represented the absence of eligible alias evidence. Package order, rather than eligibility for the check, controlled both outcomes.

The LP113 regression test demonstrates the precise paired-failure class without representing its controlled data as an owner TxGIO artifact: an unsuitable first row is followed by an eligible county-road row. The generalized harness skips the unrepresentable exact row, finds the later alias-bearing row deterministically, and passes both independently. A Victoria-like controlled fixture containing only ordinary road names demonstrates the former false alias premise and now produces `NOT_APPLICABLE` while exact certification continues to pass.

The owner’s authentic packages are not available in this workspace, so this change does **not** claim which particular authentic row spelling triggered either county. It establishes the code path capable of producing the reported paired failures and removes the order- and eligibility-dependent harness assumption. Burleson and Victoria remain subject to the owner-local commands below.

## 3. Files inspected

The audit inspected:

* `tools/lp104/certify-texas-address-package.mjs` — package parsing, normalized keys, sampling, aliases, containment, report output, and CLI;
* `tests/lp1046-texas-address-certification.test.mjs` — existing exact, alias, integrity, and certificate fixtures;
* `tools/lp104/build-txgio-address-packages.mjs` and its LP104.4 tests — emitted compact record fields and package/certificate behavior;
* `tools/lp1051/manufacture-gridly-28-address-counties.mjs` and its tests — candidate certificate/manifest creation and the call into `certifyCountyPackage`;
* `tools/lp107/generate-runtime-certificates.mjs` and its tests — governed 28-county certificate verification;
* `tools/lp108/certify-remote-runtime.mjs`, `tools/lp108/lp108-core.mjs`, and LP108 tests — representative complete-address membership, city/ZIP/FIPS evidence, and negative controls;
* LP104.7 and LP105 tests — production-manifest activation and statewide governance boundaries;
* `tests/lp112-governed-cohort-expansion-pilot.test.mjs` and `docs/LP112-GOVERNED-COHORT-EXPANSION-PILOT.md` — three-county fixture orchestration and owner boundary.

## 4. Certification contract: before and after

Before LP113, exact and alias evidence came from the same first-N physical rows. The index omitted city and ZIP, success required the specifically sampled identity, unsupported roads masqueraded as one “alias,” and the report had no truthful not-applicable state or explicit road-only control.

After LP113:

* integrity validation still scans every row and still rejects duplicate provider identities, cross-FIPS records, invalid coordinates, empty house/road values, altered bytes, or weakened certificate acceptance policy;
* exact evidence is selected from package rows that the certification query grammar can represent and is deterministically ordered by complete normalized address and identity;
* lookup keys include exact house, canonical road, represented city, and represented ZIP;
* alias evidence is selected independently from all eligible exact rows, not merely the first package rows;
* only existing `CR`, `FM`, `SH`, and `US` production normalization transformations generate aliases;
* absence of any eligible alias produces `normalizationStatistics.status: NOT_APPLICABLE`, while an eligible alias failure remains blocking;
* complete-address duplicate representatives are accepted only through governed package/FIPS membership;
* nearby-number, invalid-query, and explicit road-only controls all require truthful no-result.

No runtime normalization or matching code changed. These rules alter only how the read-only certifier chooses and judges evidence.

## 5. Exact-address sample-selection rules

An exact candidate must be an authentic row read from the gzip package, have a nonempty identity, have a house/road pair representable by the existing certification parser, carry the certified FIPS, and have finite coordinates. Eligible rows are sorted by normalized house, canonical road, represented city, represented ZIP, and identity before applying `sampleSize`. Thus repeated runs are stable and package ordering cannot choose an unsuitable representative. No eligible exact row is a blocking failure.

The query evidence preserves the row’s house number and road verbatim, includes its city only when present, includes its ZIP only when present, and records county/FIPS separately. The lookup requires the same exact normalized house, canonical road, city, and ZIP. It does not interpolate, substitute a nearby number, relax locality, or promote a road-only query.

## 6. Canonical-alias eligibility rules

A row is alias-eligible only when canonical production normalization identifies a leading numbered `CR`, `FM`, `SH`, or `US` road. The certifier derives only the already-supported long and abbreviated variants for that family. It never guesses an alias for an ordinary street or private road. Alias rows are independently, deterministically selected from the full eligible set. All derived variants must resolve to the same governed complete-address match set. If the package has supported alias-bearing rows, failure remains blocking; only a genuine zero-eligible package is `NOT_APPLICABLE`.

## 7. Representative identity membership

The complete normalized key is house plus canonical road plus city plus ZIP. Multiple unique provider identities may legitimately occupy that key. A returned identity is acceptable only when it is a member of that complete-address set and its record has the certified county FIPS. An unrelated package identity, a member from another complete address, or a cross-FIPS identity fails. This mirrors LP108’s governed representative-membership principle without changing runtime matching.

## 8. Blank-city behavior

Blank city remains an empty value in the sample and key; no county name, `TX`, or other locality is inserted into the city field. The evidence query omits the empty component, retains ZIP when supplied, and carries county/FIPS governance separately. Consequently a blank-city row is distinguishable from a row with a populated city and remains subject to exact ZIP and county/FIPS gates.

## 9. Tests added

`tests/lp113-statewide-certification-generalization.test.mjs` covers:

1. a Burleson-like unsuitable first row followed by a valid alias-bearing row, deterministic reselection, exact pass, and alias pass;
2. a Victoria-like package with no supported alias, exact pass, and truthful `NOT_APPLICABLE`;
3. two governed identities at the same complete address, acceptance of either member, rejection of unrelated and cross-FIPS identities;
4. blank-city preservation, unambiguous query construction, FIPS evidence, nearby-number rejection, and road-only rejection;
5. direct existing-package certification with required package, county, FIPS, and runtime certificate inputs.

Existing LP104.6 tests continue to exercise 3,000 deterministic samples, all four Texas numbered-road families, package/certificate hashing, containment, and identity integrity. LP112 continues to exercise all three pilot identities through LP105.1 and LP104.6.

## 10. Regression results

The required consolidated LP104.4, LP104.6, LP104.7, LP105, LP105.1, LP107, LP108, LP112, and LP113 test command passed. LP107 `--verify-only` reported all 28 existing counties ready for upload. The exact command results are recorded in the completion response. No generated report is certification of unavailable owner artifacts.

## 11. Owner-local certification of existing packages

Run the following from the repository root in PowerShell. It reads existing packages and runtime certificates, creates only `reports/lp113/*.certification.json`, and performs no build, upload, activation, or manifest write. Adjust `$Certificates` only if the LP112 `--reports` directory used during manufacture had a different name.

```powershell
$Repo = 'C:\GitHub\liberty-county-map'
$Packages = Join-Path $Repo 'data\generated\lp104\txgio-addresses'
$Certificates = Join-Path $Repo 'reports\lp112\certificates'
$Reports = Join-Path $Repo 'reports\lp113'
Set-Location $Repo
New-Item -ItemType Directory -Force -Path $Reports | Out-Null

$Counties = @(
  @{ Slug = 'burleson'; Fips = '48051'; County = 'Burleson County' },
  @{ Slug = 'trinity';  Fips = '48455'; County = 'Trinity County'  },
  @{ Slug = 'victoria'; Fips = '48469'; County = 'Victoria County' }
)

foreach ($Item in $Counties) {
  $Package = Join-Path $Packages "$($Item.Slug)-$($Item.Fips).addresses.jsonl.gz"
  $Certificate = Join-Path $Certificates "$($Item.Slug)-$($Item.Fips).runtime-certificate.json"
  $Report = Join-Path $Reports "$($Item.Slug)-$($Item.Fips).certification.json"
  if (-not (Test-Path -LiteralPath $Package -PathType Leaf)) { throw "Missing owner package: $Package" }
  if (-not (Test-Path -LiteralPath $Certificate -PathType Leaf)) { throw "Missing runtime certificate: $Certificate" }
  node .\tools\lp104\certify-texas-address-package.mjs --package $Package --certificate $Certificate --fips $Item.Fips --county $Item.County --report $Report
  if ($LASTEXITCODE -ne 0) { throw "LP113 certification failed for $($Item.County); inspect $Report" }
  $Evidence = Get-Content -LiteralPath $Report -Raw | ConvertFrom-Json
  [pscustomobject]@{
    County = $Evidence.county
    Fips = $Evidence.countyFips
    Exact = "$($Evidence.exactMatchStatistics.passed)/$($Evidence.exactMatchStatistics.sampled)"
    Alias = $Evidence.normalizationStatistics.status
    AliasVariants = "$($Evidence.normalizationStatistics.variantsPassed)/$($Evidence.normalizationStatistics.variantsTested)"
    NearbyNumberTruthfulMisses = $Evidence.rejectionStatistics.truthfulNoResults
    RoadOnlyPromotions = $Evidence.rejectionStatistics.roadOnlyResidentialPromotions
    CompleteAddressMatchCount = $Evidence.exactSample.completeAddressMatchCount
    Status = $Evidence.certificationStatus
  }
}
```

## 12. Remaining production boundary and merge recommendation

The generalized local harness does not authorize Burleson, Trinity, or Victoria for production. Their authentic owner bytes must be revalidated with the block above and the resulting exact, alias/not-applicable, negative-control, FIPS, and match-set evidence reviewed. Any upload, Storage verification, deployed runtime test, cohort admission, production-manifest change, or activation remains a separately governed milestone.

**Merge recommendation:** merge LP113’s bounded certification-tool and regression-test changes after reviewing the green required suite. Do not interpret merge as county activation. No package generation, package mutation, upload, deployment, production-manifest edit, or runtime-cohort change occurred in LP113.
