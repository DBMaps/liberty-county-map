# LP129 — Texas Address Expansion Wave 3 Preflight

## Decision

**Manufacturing is blocked and no address candidate was fabricated.** The audit established the required `9ae36009` baseline and LP129 branch, then verified the intended Wave 3 cohort as Burleson (48051), Trinity (48455), and Victoria (48469). The repository contains the county definitions and manufacturing tools, but this environment does not contain the owner-controlled TxGIO 2026 file geodatabase.

This is the required **Audit First** result. Inventory evidence is not a substitute for source bytes, and manufacturing empty or synthetic packages would violate the milestone. Work must resume only in an environment where the LP127B-inventoried source is mounted.

## Source audit

The authoritative input remains **TxGIO 2026 Statewide Address Points**, owner-relative path `Texas-Address-Points/Raw/Texas-2026.gdb`. LP127B records the logical geodatabase as 126 components, 1,715,018,101 bytes, and 12,142,647 records, with source CRS EPSG:3857 and output CRS EPSG:4326.

No `Texas-2026.gdb` or other file geodatabase is present in the workspace. The original source is not committed, as required. Therefore, the existing builder cannot truthfully extract the selected county records here. The machine-readable audit is retained at `evidence/lp129/texas-address-expansion-wave-3-preflight.json`.

## Intended candidate cohort

| County | FIPS | Preflight result |
| --- | --- | --- |
| Burleson | 48051 | `NOT_MANUFACTURED` |
| Trinity | 48455 | `NOT_MANUFACTURED` |
| Victoria | 48469 | `NOT_MANUFACTURED` |

There are no LP129 packages, sidecars, runtime certificates, certification reports, manufacturing reports, or candidate manifests. No package count or hash is claimed.

## Controlled resume procedure

From a workspace with the inventoried geodatabase mounted, run only the selected cohort:

```bash
node tools/lp1051/manufacture-gridly-28-address-counties.mjs \
  --fips 48051,48455,48469 \
  --gdb <owner-path>/Texas-2026.gdb \
  --reports reports/lp129-wave-3
```

The completed run must then be independently reconciled. Validate gzip integrity, every JSONL record, county identity, source/accepted/rejected/duplicate counts, sidecars, byte sizes, SHA-256 values, runtime certificates, and LP104.6 certification reports. Run manufacturing twice and compare the governed package bytes. Do not commit the geodatabase or temporary extraction files.

## Production boundary

LP129 has not uploaded, deployed, promoted, approved, authorized, or activated anything. The production runtime manifest remains byte-for-byte unchanged at preflight SHA-256 `9680601f4ecbdcd51f54523ec4b09e6757dc2dfb33a9520e4da0222c4a35963a`. Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, Supabase Sync, runtime behavior, search behavior, address matching, county selection, deployment configuration, and Storage configuration are untouched.

## Merge and rollback

This audit may merge as truthful blocked-state evidence, not as completed candidate manufacturing. It gives the owner an exact, bounded resume procedure and prevents source absence from being disguised as success. Revert the LP129 audit commit to remove only this documentation, evidence, test, and test command; no runtime rollback is needed because runtime was never changed.
