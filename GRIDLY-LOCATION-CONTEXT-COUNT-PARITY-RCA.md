# Gridly Location Context count-authority parity RCA

## Root cause and Dallas discovery case

The owner capture establishes 16 unique active Dallas DriveTexas UUIDs. The
seventeenth Alerts presentation is
`official-situation-official-roadways-Hotel-Street-Bridge-closed…`. It is made
by `buildGridlyOfficialSituationAlert` from an already governed official
roadway record. The builder intentionally assigns a concise presentation ID;
that ID is not independent provider evidence. Alerts then counts the resulting
presentation groups. The presentations remain valid and are not deleted.

The first losing function was
`normalizeGridlyMobileAwarenessPanelSummary`: after
`getGridlyReconciledAwarenessActiveIssueCount` returned 16, it took a second
`Math.max` with `alertsGroupedIssueCount` (17). This contradicted LP219's
defined Location Context authority: unique, current, geographically eligible
evidence whose policy enables Location Context. Presentation groups may be
fewer or greater than evidence records and therefore cannot be count authority.

The shared repair removes Alerts presentation cardinality from that final
decision and routes the decision through
`resolveLocationContextActiveIssueCount`. Alerts count and cards remain
observable and visually unchanged. The repair contains no community, county,
source-family, or subtype exception.

## Audit identity defect

Production auditing also re-prefixed already-qualified `evidenceId` values.
For example, `official_roadway:3E0D04C9…` became
`official_roadway:official_roadway:3E0D04C9…`, explaining the blanket
`UNMATCHED_PRODUCTION_ITEM` result. Identity qualification is now idempotent,
and source recognition includes the normal DriveTexas presentation shape.
This diagnostic repair is separate from the production count repair.

## Deterministic blast-radius result

The locally reproducible matrix examined Dallas, Pecos, Cienegas Terrace,
Laughlin AFB, McAllen, Del Rio, Pearsall, and Rankin: eight communities across
Dallas, Reeves, Val Verde, Hidalgo, Frio, and Upton counties. Seven fixture
communities retain parity; Dallas is the one confirmed overcount (16 governed,
17 presentation-derived), no examined community undercounts, and the maximum
confirmed discrepancy is +1. Exercised source families are official roadway,
generated road incident, active hazard, and community report. Roadway subtypes
include flooding, lane closure, road closure, bridge restriction, travel
advisory, and debris/related incident.

The defect is **runtime-global**: any selected community where Alerts grouping
cardinality exceeds the already reconciled governed count could be inflated by
the same unconditional max. Synthetic/grouped identity is the Dallas trigger,
but it is not required; any presentation-only excess could trigger the same
defect. Only Dallas is confirmed affected by the supplied current/live owner
evidence. A claim that all current statewide communities have been observed is
outside the local boundary because no statewide live browser capture is stored
in this checkout.

## Before/after and protected boundaries

Dallas changes from governed/shared/reconciled/presentation/final
`16/16/16/17/17` to `16/16/16/17/16`; expected DOM and production count are
16, while Alerts presentation remains 17. Zero remains zero, one remains one,
multiple independent governed conditions retain their count, duplicates do
not inflate it, and heterogeneous governed populations still reconcile before
the Location Context authority selection.

No Community Pulse, KBYG, Alerts grouping/rendering, hazards/reports policy,
DriveTexas marker publication, geometry, POI, crossings, weather,
multi-county/PLACE authority, or Supabase path is changed. Production rollout
and a fresh owner browser capture remain outside this commit.

## Exact owner retest

1. Deploy this commit through the normal production boundary and select Dallas
   (`dallas-tx`). Wait for `stableState: true`.
2. Run `window.gridlyGovernedAwarenessAudit()` and
   `window.gridlyLocationContextProductionAudit()`.
3. Confirm governed/shared/reconciled/production/displayed/DOM counts are all
   16, `locationContextCountAgreement: true`, and the 16 UUID-backed production
   rows report `MATCHED_GOVERNED`.
4. Open Alerts and confirm the Hotel Street Bridge presentation and the prior
   grouping design remain visible, with no card or wording regression.
5. Repeat a one-condition community, a quiet community, and a mixed
   official/hazard/report community; retain the two audit objects and DOM copy.

There is no code blocker. Production deployment and owner live replay are the
remaining acceptance boundary. Merge is recommended after that replay confirms
Dallas 16 and the three control populations.
