# Recovery Repair 002 — main-thread attribution

## Scope and conclusion

This milestone adds observation only. It does not change cadence, coalescing,
publication, rendering, marker policy, provider data, or startup ordering. The
two violation-attributed animation frames now have bounded localhost timing
records, allowing an owner-browser run to distinguish their synchronous work.

The source trace establishes that the filename shown by DevTools is the
**scheduler**, not necessarily the expensive leaf:

* `gridlyOfficialProviderActivation.js` schedules `runNarrowConsumerRefresh`.
  That callback synchronously invokes the unified runtime, Travel Brief,
  interaction render, and `refreshGridlyCommunityPulseSharedModel`. The
  activation/configuration checks and network trigger are outside the frame.
* `gridlyAwarenessOfficialRoadwayPublisherRepair.js` schedules
  `enrichPublishedState`. It reads the governed connector envelope, normalizes
  current-area official records, builds the shared issue contract, and calls
  `gridlyPublishAuthoritativeCommunityAwarenessSummary`. That publisher
  synchronously calls `refreshPortraitV2LocalizedIntelligence`, including the
  Location Context presentation. The frame is therefore a publication and
  portrait-render frame, not a fetch frame.

Without a new owner-browser capture, the exact expensive leaf cannot honestly
be promoted to “proven”. Existing child/phase timers in `app.js` and the new RAF
boundary timers provide the needed distinction.

## Scheduled-work inventory

| Path | Trigger / scheduler / frequency | Reentry and state | Volume, DOM, map, publication |
|---|---|---|---|
| Official activation narrow refresh | configuration-ready or changed provider signature; one RAF, coalesced while pending | cannot overlap on the queue; synchronous descendants can schedule crossing/publication frames; reads provider/area state and writes consumer presentation | unified intelligence and shared model can traverse incident arrays and DOM; may indirectly schedule marker work; idempotence depends on descendants |
| Publisher convergence | each DriveTexas refresh bridge call; one RAF per call, no pending-frame guard | duplicate frames are possible for multiple provider callbacks; increments publication revision even for an unchanged summary | governed current-area official list (typically 0–47), contract lists, Pulse/Microline reference publication, then synchronous portrait/Location Context DOM work |
| Initial connector synchronization | 200 ms interval, at most 50 attempts | interval is cleared on completion; completion uses Promise microtasks after shared refresh | connector record read each attempt; completion rebuilds and republishes once |
| Publisher installation | 50 ms interval, at most 40 attempts | cleared after install; final enrichment runs after install | source envelope and publication/portrait work can run once during installation and again in the interval completion body |
| Report/hazard refresh | state/network/community events; synchronous function plus one coalesced crossing RAF | broad fan-out; calls shared model, portrait, incident markers, DriveTexas markers, alerts and other panels | large incident arrays and extensive DOM/map writes; crossing render is scheduled, not inline |
| Crossing presentation | state change, map move/zoom and other callers; coalesced RAF | queued reasons combine; guards exist for popup and unchanged selection | scans full governed county inventory (176/789/1159), then viewport/policy filtering; marker membership is incremental (reuse/remove/create), not unconditional full replacement |
| Portrait/awareness refresh | shared publication and broad refresh callbacks; synchronous | publication directly invokes it; it does not itself RAF | reads shared awareness/incidents and writes multiple portrait surfaces; Location Context is a child; existing section timing and unchanged-write counters apply |
| Official marker publication | report/hazard refresh | synchronous in broad refresh | iterates official current-area records and mutates Leaflet marker layer; current-area rather than statewide volume |
| Background timer tracker | explicit diagnostic use only | wraps timers only while enabled by its existing caller | records scheduler stacks; no product publication |

Promise microtasks occur after the initial connector shared-model refresh.
Mutation/Resize observers and map events are secondary triggers in the wider
application, but neither named long RAF directly runs from an observer.

## Reentrancy and duplicate scheduling

The activation RAF has a real pending-frame coalescing guard. The publisher RAF
has no equivalent guard: every DriveTexas bridge invocation schedules
`enrichPublishedState`, even when the activation owner has coalesced its own
consumer refresh. Thus a provider callback can create the chain “activation RAF
→ shared-model refresh” plus “publisher RAF → enrichment → authoritative
publication → portrait/Location Context refresh”. Initial synchronization can
also rebuild and enrich via a Promise close to those frames. Publication
revision increments unconditionally in `enrichPublishedState`; there is no
unchanged-revision skip at that boundary. These are attribution findings, not a
repair in this milestone.

## Data, DOM, and marker findings

The publisher operates on governed current-area DriveTexas records, not the
~741-record statewide retained set, so its 0–47 record transforms alone do not
plausibly explain seconds. Crossing visibility starts from the complete active
county inventory; Harris (1159) and Dallas (789) therefore multiply filtering,
signature, distance-sort, and marker membership costs. The renderer reuses
markers by ID/signature and removes stale markers, so it is incremental, though
a community transition naturally has little reusable membership and resembles
a full replacement.

The named publisher frame's downstream portrait code performs DOM queries and
writes. Elsewhere, portrait spatial audits contain many `getBoundingClientRect`
reads, while popup handlers mix class changes, map metrics, computed styles,
and map invalidation. Those are possible forced-layout contributors, but source
inspection does not prove that the spatial audit runs in either named frame.
Leaflet marker creation/removal and popup binding are high-confidence costs when
the broad refresh/crossing frame runs.

## Classification

| Classification | Path | Evidence |
|---|---|---|
| A — proven long-task owner | none yet | DevTools identified scheduler files, not synchronous leaf functions; browser boundary/child timings are required |
| B — high-confidence contributor | authoritative publication → portrait/Location Context | synchronous descendant of the 8.1 s publisher RAF with broad DOM work |
| B — high-confidence contributor | crossing visibility and marker membership | full county input plus hundreds of Leaflet elements; existing phase counters expose it |
| B — high-confidence contributor | broad report/hazard refresh fan-out | synchronously invokes shared model, portrait, incident/official markers, alerts and many panels |
| C — possible contributor | duplicate publisher convergence and initial-sync convergence | no pending/revision guard, but count and timing require owner-browser evidence |
| C — possible contributor | portrait layout reads | forced-layout patterns exist, but their presence in the named frames is not yet proven |
| D — not material | activation/configuration/provider discovery | constant-size work occurs before the activation RAF |
| D — not material | network latency | asynchronous and outside synchronous RAF duration |
| E — diagnostic only | localhost attribution recorder | bounded read-only timing/snapshots |

## Owner-browser retest

1. Serve on `localhost` or `127.0.0.1`, open DevTools Performance, and reload in
   Austin.
2. After hydration, run `gridlyMainThreadAttributionAudit()` and preserve the
   result. Correlate entries by timestamp with Long Animation Frames/long tasks.
3. Record entries for `official-provider-activation:narrow-consumer-refresh` and
   `official-roadway-publisher:enrich-published-state`, plus
   `gridlyRefreshBreakdownAudit()`, `gridlyPortraitIntelligenceBreakdownAudit()`,
   `gridlyCrossingRenderAudit()`, and `gridlyV921RenderPipelineAudit?.()`.
4. Transition Austin → Dallas → Baytown → Liberty; after each settled transition
   repeat the audit calls and record entry-count deltas, duration, before/after
   revisions/counts, crossing marker count, and DOM target count.
5. Classify A only when one timed boundary and its existing child/phase timer
   account for the observed long frame. Do not infer from filename alone.

## Minimum prospective Repair 003

Repair 003 is justified only after that capture. The minimum likely repair is a
single semantic convergence guard for unchanged/pending official publication,
or a targeted marker/portrait repair if child timers instead prove those owners.
Do not combine cadence changes, new throttles, marker-policy changes, and
publication changes in one repair.
