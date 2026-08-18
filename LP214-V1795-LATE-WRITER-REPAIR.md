# LP214 V179.5 late-writer repair

## Root cause and first bad path

The authoritative publisher converged the shared summary, then called
`refreshPortraitV2LocalizedIntelligence`. That portrait path subsequently
called `publishGridlyCommunityPulseAuditState` with a reconstructed
`sourcePulseModel`. Before this repair the generic publisher protected only the
`communityAwarenessSummary` reference; it accepted the reconstructed
`activeAwareness` object unchanged. The first bad write was therefore the
synchronous portrait publication from `refreshPortraitV2LocalizedIntelligence`
to `publishGridlyCommunityPulseAuditState`, after
`gridlyPublishAuthoritativeCommunityAwarenessSummary:post-portrait-convergence`.
Its input was raw V179.5 active report/hazard selection, not the shared count.

The same generic publisher is also reached by Community Pulse renders and copy
synchronization. Scheduled portrait RAF/provider refreshes can trigger those
paths later, but the timer and RAF are triggers rather than independent state
owners. Microline refresh writes its own presentation object and carries the
authoritative summary reference; it does not directly assign Pulse
`activeAwareness`.

## Writer inventory

| Writer/function | Write/trigger | Input | Scheduling/transition classification |
| --- | --- | --- | --- |
| `buildGridlyCommunityPulseModel` | Builds `activeAwareness`, headline, subline, decision presentation | lifecycle-filtered hazards/reports plus shared summary | synchronous; used by initial, map/provider, and transition refreshes |
| `renderGridlyCommunityPulse` | Publishes a newly built model | Pulse model | synchronous render; its callers may be scheduled |
| `syncGridlyCommunityPulseCopyFromModel` | Publishes rendered/visible copy | supplied Pulse model | synchronous portrait-copy refresh |
| `refreshPortraitV2LocalizedIntelligence` | Publishes `sourcePulseModel` and refreshes Location Context/microline | cached/reconstructed portrait presentation model | synchronous body; may be invoked by RAF, provider refresh, portrait refresh, or transition |
| `gridlyPublishAuthoritativeCommunityAwarenessSummary` | Publishes the LP214 summary before and after portrait convergence | governed publisher snapshot | synchronous official/map refresh publication |
| `publishGridlyCommunityPulseAuditState` | The single assignment to `gridlyCommunityPulseAuditState` | patches from all writers above | synchronous ownership boundary; exact late overwrite sink |

No interval, timeout, or RAF callback directly assigns the count. They can only
re-enter one of the publisher paths above. The repaired publication boundary
therefore governs immediate and delayed writes uniformly without changing
script order or provider behavior.

## Ownership rule and diagnostics

V179.5 remains a `SECONDARY_PRESENTATION_MODEL`. When the current summary has a
finite LP214 `sharedActiveIssueContract.activeIssueCount`, the shared count owns
the consumer count, active/quiet state, and narrative. The original V179.5
count remains in `rawLightweightActiveAwarenessCount`. Crossing inventory,
markers, rail presence, or coverage never enter the shared contract and cannot
activate consumer presentation.

Every governed publication records bounded, silent lineage through
`window.gridlyActiveAwarenessWriterAudit()`: timestamp, writer, previous/next
consumer values, canonical identity, shared and raw counts, source type and
identity, revision, and reason. Returned arrays and records are frozen copies.
