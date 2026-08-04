# LP139 — Approval-bound geometry membership implementation

## Result

LP139 replaces the geometry toolchain's implementation-era fixed numeric membership gate with the exact LP138 `CURRENT_OPERATIONAL_BASELINE`. It changes no county, geometry, operational registry entry, runtime package, manifest, deployment, Storage object, Supabase resource, Edge Function, activation state, or production resolver. The existing runtime package and manifest remain the byte-identical control artifacts.

## Former model and governing authority

The LP036.1C builder formerly selected every `operational: true` registry entry and separately required the result to contain 28 entries. That count detected cardinality drift but could not detect an equal-count substitution and was not approval evidence. LP138 now supplies the governing, canonical, ascending-FIPS sequence of `(countyId, fips)` identities. Its membership hash is SHA-256 over recursively key-sorted, compact canonical JSON for the complete `approvedCounties` records—not merely their count.

## Architecture

```text
LP138 CURRENT_OPERATIONAL_BASELINE
  | validate schema/role/version/order/hash/gates/permissions
  v
exact canonical countyId + FIPS set (ascending FIPS)
  | exact equality
  v
operational registry identities from boundary GEOID/FIPS
  | contract-ordered selection
  v
read-only deterministic builder --------> temporary/in-memory verification
  | package-generation permission gate (false)
  X governed package/manifest write

Explicit browser audit invocation only
  -> fetch contract + committed package + committed manifest
  -> validate contract and canonical membership hash
  -> exact contract/package county sequence equality
  -> report membership, manifest status, and five independent permissions
  -> no loader activation, state write, refresh, or resolver change
```

## Builder flow

The builder loads the baseline contract, requires schema and contract version `1.0.0` and role `CURRENT_OPERATIONAL_BASELINE`, and applies the shared LP138 validator. It extracts each live operational registry member's FIPS from its registered boundary source, requires exact contract/registry equality, and constructs counties in the contract's ascending-FIPS order. Package and manifest expected-count fields are derived from `approvedCounties.length`; the number 28 is historical output data, not implementation authority. Output verification independently requires exact contract/package equality.

Deterministic construction in memory and inspection of committed files are read-only verification and remain available. `writeOutputs` checks `generateRuntimePackage.authorized` before construction or filesystem writes. The current baseline value is false, so the ordinary governed write path fails closed. Historical membership is never reinterpreted as preparation, package generation, upload, deployment, or activation permission.

## Browser audit flow

`gridlyLp0361cRuntimeCountyGeometryPackageAudit` remains dormant until explicitly called. Only that call fetches the LP138 contract alongside the already audited package and manifest. It validates role, schema/version, unique ID/FIPS identities, ascending-FIPS order, declared cardinality, and canonical membership hash. It compares the ordered package county IDs with the contract, derives expected count from the contract, and reports each independent permission plus `fixedCountGovernanceActive: false`.

This audit-only fetch deliberately does not join startup preloading, does not populate the dormant geometry loader cache, and does not change service-worker caching or production county resolution. Consequently, a deployment that does not publish the evidence path reports `contractAvailable: false` and fails closed; it does not fall back to 28.

## Manifest governance metadata outcome

**Outcome A for current verification, with richer metadata deferred:** the unchanged manifest already authenticates package SHA-256 and byte length and records expected/packaged counts and zero blocked, missing, or invalid members. The audit combines those fields with exact membership read from the authenticated package and LP138 contract. The manifest does not embed the LP138 contract hash or member tuples. Adding those fields would change protected manifest bytes, so that enrichment is intentionally deferred to a future explicitly authorized milestone rather than performed by LP139.

## Permissions and no-write behavior

The baseline reports all five permissions independently:

| Permission | LP139 behavior |
| --- | --- |
| Geometry preparation | false; reported without inference |
| Runtime package generation | false; governed package/manifest writes blocked |
| Storage upload | false; no upload path invoked |
| Deployment | false; no deployment path invoked |
| Runtime activation | false; dormant loader and production resolver unchanged |

No earlier permission implies any later permission. Read-only validation does not grant preparation or publication authority.

## Byte identity and regression boundary

LP139 regression coverage snapshots the runtime package, manifest, baseline and draft contracts, operational registry source, both statewide geometry sources, and service worker around audits and deterministic verification. The committed package remains SHA-256 `ba0e44fbaf1a396909f7aad98ace7d55a20f86a23ca9352c980f39116ed32461`, 2,756,121 bytes. No Android/PWA geometry copy is created or refreshed by LP139; copy tooling and delivery configuration remain untouched.

## Rollback

Revert the LP139 implementation commit. That restores the former numeric builder/browser checks and removes the new audit/test/report surfaces. No artifact, registry, remote service, or activation rollback is necessary because LP139 performs none of those mutations.

## Known limitations

- The browser package does not embed FIPS. Browser exact equality therefore compares the package's contract-ordered canonical county IDs; the repository builder/audit performs the stronger ID/FIPS equality using boundary metadata.
- The contract evidence path is fetched only on explicit audit invocation and is not added to service-worker precache. An unavailable deployed evidence path produces a visible blocker.
- The unchanged manifest has no LP138 contract reference or membership hash; its byte-preserving verification is composed with package and contract evidence.
- Source checkout line-ending normalization can make a fresh deterministic in-memory package hash differ from the committed control while preserving deterministic geometry and byte length, as documented by LP137.

## LP140 recommendation

LP140 should remain non-activating unless separately authorized. It may design an authorization-bound manifest schema carrying contract role/version/hash and exact member tuples, define evidence-path deployment/caching policy, and specify controlled temporary-output verification. It must not regenerate or publish the runtime package, upload to Storage, deploy, or activate counties without the corresponding independent permissions.
