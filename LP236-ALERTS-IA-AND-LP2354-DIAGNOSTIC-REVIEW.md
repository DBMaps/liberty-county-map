# LP236 Alerts IA and LP235.4 diagnostic review

## Product architecture

LP236 projects the existing, awareness-filtered Alerts snapshot into **critical
callouts → source → condition type → condition → details / Show me**. Counts and
identity coverage come from snapshot records, never DOM card counts. Empty source
families are omitted. One condition opens directly; small inventories open the
largest source and its groups; larger inventories open only the largest source.

Critical callouts are limited to weather records carrying an existing high,
severe, extreme, or critical severity. A callout does not replace its source row.
No provider fetch, timer, geometry, county union, or new identity authority is
part of LP236.

## LP235.4B–J diagnostic classification

| Addition | Classification | Recommendation |
| --- | --- | --- |
| Passive presentation-completeness / source-semantics audits | **KEEP** | Useful owner-visible truth checks; passive and bounded. |
| Grouped-lineage snapshots on the completed render context | **KEEP** | Retains governed identity evidence needed to detect hidden loss. |
| Canonical-to-presentation mapping and duplicate-pair checks | **KEEP** | Regression and owner audit value; no product decision depends on it. |
| Private/public group object identity checkpoints | **TEST_ONLY** | Valuable boundary regression; do not make UI behavior depend on checkpoint output. |
| Builder-route authority and 4I/4J checkpoint publisher trace | **TEST_ONLY** | Retain while the lineage defect remains open, then remove from production runtime in a separately tested behavior-neutral cleanup. |
| Per-stage investigative accumulation traces | **TEST_ONLY** | Keep bounded and outside product logic; candidate for later removal with dedicated parity tests. |
| Experimental 26 → 12 → 26 acceptance chain | **REMOVE as an acceptance dependency** | LP236 does not invoke or gate on it. Preserve its evidence only as defect history. |

No runtime diagnostic is removed in LP236: mixing cleanup with the Alerts product
redesign would obscure behavioral attribution. The recommended follow-up is a
separate behavior-neutral change that moves the TEST_ONLY instrumentation into
fixtures after the open lineage issue is resolved.

## Preserved unresolved defect

The grouped-lineage/parity finding (including the observed 26 → 12 → 26 chain)
remains unresolved. LP236 neither asserts parity nor conceals missing identities:
the passive audit fails `identityCoveragePass` for unrepresented or duplicate IDs.
Owner browser acceptance remains required before merge.
