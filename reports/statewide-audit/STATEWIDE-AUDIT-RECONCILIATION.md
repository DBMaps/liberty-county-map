# Statewide audit reconciliation

## Decision boundary

This is an audit-only reconciliation. It uses the checked-in JSON/CSV exports and
their LP214/LP215 repository evidence; it does not use an Excel workbook and does
not authorize a production repair. A repository contract and a live observation
are deliberately different claims.

## Certified population

| Measure | Certified result |
| --- | ---: |
| Counties | 254 |
| Canonical communities | 1,859 |
| Governed memberships | 2,058 |
| Multi-county communities | 163 |

All 163 multi-county communities remain single canonical identities, with every
governed membership retained in the machine-readable reconciliation.

## Reconciled classification

| Classification | Result | Interpretation |
| --- | ---: | --- |
| Repository-certified canonical communities | 1,859 | Static identity and declared consumer contracts agree with the checked-in export. |
| Expected-empty roadway conditions | 481 | Governed empty state, not a failure. |
| Expected-empty rail conditions | 155 | Governed `ACTIVE_EMPTY` state, not a failure. |
| Evidence-only gaps | 0 | No missing repository value was found in this export. |
| Live-browser-only gaps | 1,859 communities | Runtime observation is absent and is not inferred. |
| Actual production contradictions | 0 | The checked-in evidence proves no production contradiction. |
| Systemic unresolved classes | 6 | Each is a statewide live-browser certification class, not a proven production defect. |

The six unresolved classes are DriveTexas lifecycle/counts, official-roadway
presentation, Alerts rendered presentation, rail viewport/Leaflet/DOM parity,
Show on map presentation, and stale ownership cleanup. Each affects 1,859
canonical communities across 254 governed counties in the export. They should be
handled as one statewide browser-evidence campaign, not 1,859 special-case fixes.

## Repair decision

**No production repair is authorized.** The export supplies no actual production
contradiction. Expected-empty conditions must remain quiet states. The six
systemic classes require governed live-browser evidence before any item may be
promoted to a proven defect. Missing future values must be classified as
`EVIDENCE_GAP`; they must never be inferred as pass or fail.

The deterministic inventory is
`gridly-statewide-audit-reconciliation.json`. Rebuild it with
`npm run build:statewide-audit-reconciliation` and verify it with
`npm run verify:statewide-audit-reconciliation`.
