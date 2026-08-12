# LP190 — 11-County LP130 Governed Payload Recovery Audit

## 1. Executive classification

**`OWNER_LOCAL_EVIDENCE_REQUIRED` for all 11 counties.** Zero exact payloads are present in the current repository, and zero are recoverable from reachable Git history. Existing LP188.1 evidence records that all 11 objects matched governed length and SHA-256 in Supabase Storage during LP147, but it also requires a fresh credentialed read-only existence check. Historical matching metadata is a recovery lead, not proof of bytes available today. The audit therefore remains fail-closed.

Counts: current repository **0**; Git history **0**; owner-local evidence **11**; external recovery **0 at present** (becomes necessary only for any missing or mismatched remote object). No county was activated; runtime remains **243 operational / 11 restricted / 254 total**.

## 2. Original LP130 governed contract

| Field | Governed finding |
|---|---|
| Canonical path | `data/generated/lp104/txgio-addresses/<county>-<FIPS>.addresses.jsonl.gz` |
| Manifest | `data/generated/lp104/txgio-addresses/manifest.json` |
| Schema/version | `gridly.lp104.txgio-addresses.manifest.v1` |
| County identity | County name/slug bound to five-digit Texas county FIPS |
| Payload type | Deterministic gzip JSONL compact address rows |
| Source/provenance | TxGIO 2026 Statewide Address Points through LP104/LP130 deterministic county manufacture |
| Length/hash | County-specific governed byte length and SHA-256 in the matrix below |
| Certification | Original LP130 result is `BLOCKED` for these 11; LP135 later records `LOCAL_PACKAGE_UNAVAILABLE` |
| Exactness | Exact immutable payload bytes, governed length, and SHA-256 are required |
| Semantic reconstruction | Forbidden by the evidenced restoration policy; no permission to substitute equivalent/new bytes was found |
| Downstream dependencies | Unchanged LP134 twice, LP135 restriction authority, LP186–LP189 activation governance, and the certified `gridly-geocode` reader |
| UNKNOWN | Present-day remote existence/identity; a reachable Git blob for payload bytes; owner credential/current object version metadata |

## 3. Why the counties remain restricted

All 11 share `LOCAL_PACKAGE_UNAVAILABLE`: governance retains the manifests, expected hashes and sizes, and blocked certificates, but the exact gzip bytes are not locally mounted. LP187 and LP188.8 require exact restoration, hash/length verification, two unchanged LP134 PASS runs, and downstream reconciliation. Recovery cannot itself imply activation authorization.

## 4. County-by-county recovery matrix

| FIPS | County | Expected artifact | Bytes | SHA-256 | Current repo | Git history | Certification / manifest | Classification | Next action |
|---|---|---|---:|---|---|---|---|---|---|
| 48061 | Cameron | `data/generated/lp104/txgio-addresses/cameron-48061.addresses.jsonl.gz` | 5373433 | `24ec5d503dd9b9d370b8f6d40116e1ee37d10c48b26354d14f3621793bc7490b` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48073 | Cherokee | `data/generated/lp104/txgio-addresses/cherokee-48073.addresses.jsonl.gz` | 1066374 | `1a92af50ff47ba5c1f7d7555c96c844ef0e39349473d043c138ff30b10829f2d` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48113 | Dallas | `data/generated/lp104/txgio-addresses/dallas-48113.addresses.jsonl.gz` | 32972921 | `354653cea266e863b13f49f28bd4ae76a17ac84b84ae804f50110a8c1ef48953` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48121 | Denton | `data/generated/lp104/txgio-addresses/denton-48121.addresses.jsonl.gz` | 11819588 | `15e99627ae0a0698536881db9499d18b3c324ed7d5d20cbbf02875da99da7b17` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48135 | Ector | `data/generated/lp104/txgio-addresses/ector-48135.addresses.jsonl.gz` | 2044691 | `a1a74ead55eb8e50fa0ebf52fbb664f18ec7b3b55d847a0607d2bc31e14293f9` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48229 | Hudspeth | `data/generated/lp104/txgio-addresses/hudspeth-48229.addresses.jsonl.gz` | 166512 | `b8010daa4a0615780e91c4b5c91871808f7328bb6e91e63163553aa729ce92fe` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48329 | Midland | `data/generated/lp104/txgio-addresses/midland-48329.addresses.jsonl.gz` | 2879318 | `88ee7296cce7c9dbd729a2709426a9e5dcc8b3857d567c2c7ba0c2b3c8899600` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48377 | Presidio | `data/generated/lp104/txgio-addresses/presidio-48377.addresses.jsonl.gz` | 183109 | `adc34e30fb7c83338e25c04421c3bda0ef73ec809f716b813fbad53305206cce` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48401 | Rusk | `data/generated/lp104/txgio-addresses/rusk-48401.addresses.jsonl.gz` | 782267 | `1f13a56fe4f95fd45825f81c0011de2e86bc2d6788f020efed92049429782e74` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48425 | Somervell | `data/generated/lp104/txgio-addresses/somervell-48425.addresses.jsonl.gz` | 164537 | `f0c9536c27942ad01390d7a65fe0cb5b5efa22feef63669ee691e6225f1c3ad1` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |
| 48441 | Taylor | `data/generated/lp104/txgio-addresses/taylor-48441.addresses.jsonl.gz` | 2563385 | `aaaba945f9368feeabc05c10237331039084d162f69249d8ad33938eb81aafff` | no | no | BLOCKED / found | `OWNER_LOCAL_EVIDENCE_REQUIRED` | Credentialed read-only remote check; exact quarantined recovery; LP134 twice; reconcile; no activation |

## 5. Repository recovery findings

The current tree has all 11 identity records in the 254-county manifest, LP130 batch hashes, blocked certifications/runtime certificates, and later governance evidence. It has none of the 11 `.addresses.jsonl.gz` payloads. Evidence is sufficient to validate recovered bytes but not to claim that bytes have been recovered.

## 6. Git-history recovery findings

An all-reachable-ref path/name search found no commit containing any of the 11 gzip paths. This clone was introduced through root commit `61d66fb9eb63fb217504880acb569d59d217d650`; it has no parent from which payloads can be restored. LP130 records authoritative manufacturing commit `de3ce54ade60583e4c61e0378b8175d7a91e44c6`, but that object is absent from this clone. Consequently no commit SHA/path/blob identity can honestly support a Git-history recovery classification.

## 7. Shared failure-mode analysis

**B — one common historical packaging/restoration defect**, plus county-specific certification work after restoration. All 11 exact payloads are absent locally despite retained identities and historically matching LP147 remote objects. One deterministic, credentialed remote verification and quarantine-download mechanism can recover multiple exact artifacts. It was not executed in LP190.

## 8. Exact evidence still missing

1. Fresh credentialed proof that each `certified-addresses/lp104/txgio-addresses/...` object exists.
2. Recovered bytes matching every governed byte length and SHA-256.
3. A concrete repository/Git blob identity (none is currently reachable), or accepted owner recovery artifact identity.
4. Two unchanged LP134 PASS executions per recovered county.
5. Downstream restriction reconciliation and explicit authorization; neither may be inferred.

## 9. Safest recovery path

1. Owner runs an LP147-style **read-only** identity verification for all 11 remote objects.
2. If identities match, LP190.1 downloads only to a governed quarantine and checks exact byte length and SHA-256 before acceptance.
3. Run unchanged LP134 twice per county and require PASS both times.
4. Rebuild downstream governance inputs without clearing restrictions or inferring authorization.
5. Treat any unavailable/mismatched object as fail-closed and require owner archive or external exact-artifact recovery; do not manufacture.

## 10. Can LP190.1 be repository-only?

**No under current evidence.** Owner credentials/current remote evidence are required. Once the owner supplies governed access or verified recovery inputs, LP190.1's tooling and reconciliation changes can be repository-only, but the exact payload source cannot be invented by the repository.

## 11. Owner action

**Required for all 11:** credentialed current remote verification and, if matching, exact byte retrieval. No external-source acquisition is presently justified because historical LP147 matching evidence provides the shortest lead; external recovery is only the fallback for a failed remote check.

## 12. Production protection and activation confirmation

LP190 changes only this report, its JSON twin, a focused verifier/test, and package scripts. It makes zero changes to `js/app.js`, runtime package registry, generated registry, authoritative runtime geometry/manifest, crossing packages/manifests, Supabase, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, or Shared Reports. **No restricted county was activated. Operational count remains 243 and restricted count remains 11.**

Protected-production identity is pinned to LP189 merge commit `7d7eeda31e6eff7db8ef89d9502d908a4a8dec71`. For every protected path, the verifier resolves the canonical Git blob object identity at that baseline and at `HEAD`, and requires the object IDs to match. `HEAD` is deliberately resolved at verification time. Checkout-materialized bytes are ignored, so Git configuration or CRLF/LF conversion cannot create false drift. The JSON records expected and actual Git blob IDs, per-file pass/fail, and separately labelled SHA-256 digests of canonical blob content; those SHA-256 values are not represented as Git object identities.

The original LP190 report hashes were SHA-256 digests of the baseline canonical blob content (and therefore of an LF checkout), but the original verifier recomputed SHA-256 from working-tree files. On the owner checkout, `js/app.js` was materialized with CRLF: its working-tree digest was `3d2061b67d545ac2e49c12649632f498e5b9c9c76eff896b93dd7fabad4f940e`, while the canonical blob-content digest was `70f937f0f319efcf4445897cc3bfcbd8f728ec7f5efd361486ca71396e70517f`. The canonical Git blob ID at both baseline and LP190 `HEAD` is `0daeacc4b81180d6c417104bb17455bfd7ea7859`; `js/app.js` did not change. LP189 passes because its verifier governs committed repository identity rather than LP190's former checkout-byte comparison.
