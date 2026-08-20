# LP214 Phase 2.2C — DriveTexas canonical record identity / deduplication audit

## 1. Quick summary

**Primary classification: `DIAGNOSTIC_ONLY_ID_MASKING`. Secondary classification:
`UNKNOWN` (the actual governed rejection was not captured).**

The value `providerId: "drivetexas"` on a connector-normalized record is expected:
it names the provider, not the incident. The owner expression
`record.providerId ?? record.id ?? record.sourceId ?? record.stableId` therefore
always stops at the non-null provider name and cannot report the incident identity.
The normalizer independently puts the raw DriveTexas `GLOBALID`, `globalId`, `id`,
`event_id`, or `eventId` into `id`, and repeats it in `sourceTrace.sourceId`.

No repository identity path turns eight records whose normalized `id` values are
distinct into the single canonical ID `drivetexas`. LP039.2 explicitly moves the
connector provider name to `sourceProviderId`, replaces authority `providerId` and
`sourceId` with `provider:<normalized id>` (or `event:<event id>`), and deduplicates
on that canonical authority identity. Thus the reported eight `drivetexas` values
do **not** prove an identity collision.

The null `freshnessStatus`, `ownershipMethod`, `geometryQualified`, and `duplicate`
values and empty reason arrays also do not describe LP039 proof. LP039 creates one
`recordProof` entry for every adapted record, including rejected and duplicate
records. The null pattern can only result from the diagnostic failing to associate
the connector rows with those proof entries (and then reading an empty/default
object), or from reading a projection that is not `recordProof`. In particular,
using connector `providerId` (`drivetexas`) to look up proof keyed by
`provider:<incident-id>` misses every row.

The supplied browser capture therefore establishes **8 connector-awareness rows →
0 consumer rows**, but it does not expose the intervening LP039 proof and cannot
establish the first governed rejection stage. It is not technically honest to
invent the requested intermediate counts or an exact rejection reason. The
read-only block in section 12 performs the missing, index-preserving trace. Until
its output is preserved, `HEALTHY_EMPTY` is an observed runtime classification but
is **not certified truthful**.

No production file was changed. No repair is authorized by this audit.

## 2. All DriveTexas identity fields

### Stage-by-stage identity trace

| Stage | Provider identity | Incident identity | Canonical/dedupe identity | Loss? |
|---|---|---|---|---|
| Raw GeoJSON feature | Not created by Gridly | First nonblank of `properties.GLOBALID`, `globalId`, `id`, `event_id`, `eventId`; `OBJECTID` is inventoried but is not a normalizer identity fallback | None | A raw feature without all accepted incident fields receives an index fallback later; supplied live raw values were not captured |
| Provider normalizer | `provider = "DriveTexas"`; `providerId = "drivetexas"` | `id = raw source ID` or `drivetexas-foundation-<index>`; `sourceTrace.sourceId = raw source ID` or null | None | No, when an accepted raw ID exists |
| Connector complete store | Preserved | Preserved by JSON clone | None | No |
| Connector awareness view | Preserved | Preserved by filter and JSON clone | None | No |
| LP039.2 adapter | Original connector `providerId` is preserved as `sourceProviderId` | `sourceProviderRecordId` captures the first of `sourceId`, `providerSourceId`, `id`, `incidentId`, then `globalId`, then `eventId`; original `id` remains on the spread record | `authorityIdentity`, authority `providerId`, and authority `sourceId` all become `event:<eventId>` or `provider:<stable source ID>` | No for a distinct normalized `id` |
| LP039 proof | Provider name is not used | Proof `sourceId` is the adapted canonical source ID | `authorityIdentity`; this is the `seen`-set key | No |
| LP039.3 projection | Consumer `providerId` is the canonical authority identity (despite the confusing field name) | Adapted record remains the source | `consumerSituationId = drivetexas:<canonical authority identity>` | No |

### Representative Dallas rows

The evidence supplied to this repository does not contain the eight raw incident
IDs, so their exact values cannot be reported without fabricating evidence. What is
proven for each row at the connector boundary is:

| Field | Value/status |
|---|---|
| `providerId` | `drivetexas` (expected provider name) |
| `id` | Not captured by the prior diagnostic; normalizer contract says raw accepted incident ID or index fallback |
| `sourceId` | Not a top-level connector-normalized field |
| `stableId` | Not created by the DriveTexas normalizer or LP039.2 adapter |
| `canonicalId` | Not a named field in this pipeline |
| raw/source event ID | `sourceTrace.sourceId`; exact live value not captured |
| LP039 canonical identity | `authorityIdentity`, also copied to adapted `sourceId` and `providerId`; exact live value not captured |
| dedupe key | `authorityIdentity`; exact live value not captured |

The absence of top-level `sourceId`, `stableId`, or `canonicalId` on connector rows
is not loss: the normalizer's supported incident field is `id`, with raw lineage at
`sourceTrace.sourceId`.

## 3. Whether `providerId = drivetexas` is expected

Yes—**at the provider and connector stages**. `PROVIDER_ID` is the constant
`drivetexas`, and every normalized record receives it. The prior diagnostic placed
this expected, always-present provider field before `id`; consequently it masked
the incident ID on all eight rows.

At the LP039.2 adapted-record stage, the semantics change: `sourceProviderId`
becomes `drivetexas`, while `providerId`, `sourceId`, and `authorityIdentity` become
the canonical incident identity. A diagnostic must label the stage and print each
field independently, because `providerId` does not have the same semantics on both
objects.

## 4. First stage where 8 becomes 0

### What can be reconciled from current evidence

| Stage | Count | Evidence status |
|---|---:|---|
| Connector statewide | 623 | Supplied browser observation |
| Connector awareness | 8 | Supplied browser observation |
| Authority adapter input | 8 | Required by the LP214 source-status envelope path, which passes current awareness `records` explicitly; not printed by the supplied capture |
| Normalized authority | 8 | Adapter is a map/filter whose `adaptOne` returns an object for every object record; not printed by supplied capture |
| Canonical identity valid | 8 | LP039 always constructs event/provider/fallback identity; distinctness is not yet live-proven |
| Post-deduplication unique | **unknown (1–8)** | Exact normalized IDs were masked; adapter telemetry/proof was not captured |
| Post-category | **unknown** | Categories are permitted, but LP039 does not expose a separately materialized category-stage array |
| Post-geography | **unknown** | Connector qualification is not proof of LP039 shared geometry qualification; LP039 proof was missed |
| Post-freshness | **unknown** | Supplied intervals are active at audit time, but provider/fetch lifecycle and exact parsed values were not preserved |
| Final eligible | 0 | Supplied browser observation |
| Consumer projection | 0 | Supplied browser observation |

LP039 does not execute category, geography, and freshness as destructive sequential
filters. `buildEligibilityProof` evaluates all predicates for all eight adapted
records, records all reasons, and only then filters proofs on `finalEligibility`.
Accordingly, the only exact first count change supported by the capture is **the
final-eligibility selection: 8 evaluated candidates to 0 eligible proofs**. Which
predicate caused it remains unknown because the diagnostic failed proof
association. It is not proven that the count changed during identity validation or
deduplication.

## 5. Deduplication findings

LP039.2 constructs identity in this order:

1. nonblank `eventId`/`event_id` → `event:<value>`;
2. otherwise nonblank `sourceId`, `providerSourceId`, `globalId`, `GLOBALID`, `id`,
   or `incidentId` → `provider:<value>`;
3. otherwise a deterministic fallback from category, headline/title, route,
   latitude, longitude, and start time.

The adapter's duplicate telemetry and `buildEligibilityProof` both use
`authorityIdentity`. Provider identity `drivetexas` does not participate after it
has been moved to `sourceProviderId`. Category, geometry, and time do not
participate when an event/stable source ID exists; they participate only in the
last-resort fallback. The proof marks later occurrences `duplicateStatus:
"duplicate"` and includes `duplicate_identity` in `ineligibilityReasons`.

There is a second defensive `usedEligibleIds` set while building
`consumerEligibleSituations`, but it cannot silently remove a unique eligible
proof. Every duplicate still receives `recordProof` before either eligible
selection occurs.

**Collision conclusion:** the code proves no provider-name collision. Whether all
eight live normalized `id` values are distinct is not in the supplied evidence, so
the live post-dedupe cardinality and exact duplicate rejection evidence remain
unproven. Classification for the alleged collision is `NO_IDENTITY_COLLISION`
at the code-contract level and `DIAGNOSTIC_ONLY_ID_MASKING` for the browser ID
column—not `PROVIDER_ID_USED_AS_EVENT_ID`.

## 6. Why `recordProof` appeared absent

It was not removed before proof construction. The authority path adapts all input
records, invokes `buildEligibilityProof(adapted.records, ...)`, and returns both
`recordProof` (all records) and `eligibleRecordProof` (passing records). Rejected
identities and duplicates remain in the former with populated freshness,
ownership, duplicate status, final eligibility, and reasons.

The observed shape—`finalEligibility: false` accompanied by null proof fields and
an empty reason list—is impossible for an actual rejected LP039 proof: the proof
always supplies `freshnessStatus`, `geographicOwnershipMethod`, `duplicateStatus`,
and at least one reason whenever `finalEligibility` is false. It is the signature
of a diagnostic fallback such as `p || {}`. The likely failed join was connector
`providerId = drivetexas` against proof `authorityIdentity =
provider:<incident-id>`.

Thus `NO_EXPOSED_REASON: 8` means **no proof was associated**, not “LP039 rejected
eight records without reasons.”

## 7. Freshness / missing `updatedTime` findings

Audit time is 2026-08-17 UTC. All supplied windows contain that date, including the
short SS0366 lane closure (2026-08-16 through 2026-08-21). Under LP039.2:

* provider unavailable, connector unavailable, or fetch failure rejects first;
* all of update/start/end absent rejects as `freshness_missing_timestamp`;
* a future start rejects as `freshness_future_effective`;
* `endTime <= now` rejects as `freshness_expired`;
* an update older than six hours rejects as `freshness_stale`;
* otherwise the record is `active`.

Missing `updatedTime` **alone is accepted** when a parseable active start/end
interval exists. The six-hour stale rule is evaluated only when `updatedTime` is
present. Therefore the supplied `updatedTime: null` values do not establish
`MISSING_UPDATE_FRESHNESS_REJECTION`, and the policy must not be weakened.

## 8. Primary classification

* **Primary:** `DIAGNOSTIC_ONLY_ID_MASKING`.
* **Secondary:** `UNKNOWN` governed rejection, pending correctly joined live
  `recordProof`.
* **Not proven:** `PROVIDER_ID_USED_AS_EVENT_ID`,
  `SOURCE_ID_LOST_DURING_NORMALIZATION`, `CANONICAL_ID_COLLISION`,
  `DEDUPE_KEY_COLLISION`, or `MISSING_UPDATE_FRESHNESS_REJECTION`.

## 9. Whether `HEALTHY_EMPTY` is currently truthful

It is **operationally emitted but not audit-certified truthful**. Connected/healthy
plus zero governed consumer rows is the designed meaning of `HEALTHY_EMPTY`, but
the supplied evidence did not preserve the governed reasons explaining why eight
current candidates produced zero. Certification requires the corrected block
below to show eight proof rows and reconciled reason counts.

## 10. Whether production repair is required

No production repair is proven or authorized. The proven defect is in the prior
owner diagnostic, not the connector/provider/authority/consumer implementation.
Run the corrected diagnostic before opening a repair boundary.

## 11. Minimum repair boundary if later required

None now. If corrected proof later shows a real identity collision, the minimum
boundary would be `identityFor`/`adaptOne` in
`js/gridlyDriveTexasAuthoritySourceIntegration.js`, with tests proving eight
distinct raw IDs remain eight distinct `authorityIdentity` values, no
`duplicate_identity` reasons, eight all-record proofs, and one-to-one LP039.3
projection. If it instead shows normalization loss, the boundary would be
`normalizeRecord` in `js/gridlyDriveTexasProvider.js` and tests for every supported
raw ID spelling. Those are conditional repair plans, not findings or authorization.

## 12. Exact owner console block

This is one read-only block. It performs no fetch, write, storage operation,
mutation, polling change, or map movement. It uses the existing awareness records,
injects them into the existing authority snapshot, keeps index identity so a join
cannot be masked by a bad key, and also reports canonical-key joins as an audit.

```js
(() => {
  const connector = window.gridlyDriveTexasConnector;
  const area = window.getGridlySelectedAwarenessArea();
  const awareness = connector.getAwarenessRecords();
  const snapshot = window.gridlyGetDriveTexasAuthoritySnapshot({
    records: awareness,
    selectedAwarenessArea: area
  });
  const authority = snapshot.authority;
  const adapted = authority.records || [];
  const proof = authority.recordProof || snapshot.recordProof || [];
  const eligible = authority.consumerEligibleSituations || [];
  const consumer = window.gridlySelectConsumerVisibleDriveTexasSituations({
    records: awareness,
    selectedAwarenessArea: area
  });

  const rawEventId = record => ({
    GLOBALID: record?.GLOBALID,
    globalId: record?.globalId,
    event_id: record?.event_id,
    eventId: record?.eventId,
    sourceTraceSourceId: record?.sourceTrace?.sourceId
  });
  const rows = awareness.map((record, index) => {
    const adaptedRecord = adapted[index];
    const recordProof = proof[index];
    return {
      index,
      providerId: record?.providerId,
      id: record?.id,
      sourceId: record?.sourceId,
      stableId: record?.stableId,
      canonicalId: record?.canonicalId,
      rawEventId: rawEventId(record),
      adaptedProviderId: adaptedRecord?.providerId,
      adaptedSourceProviderId: adaptedRecord?.sourceProviderId,
      adaptedSourceProviderRecordId: adaptedRecord?.sourceProviderRecordId,
      adaptedSourceId: adaptedRecord?.sourceId,
      authorityIdentity: adaptedRecord?.authorityIdentity,
      dedupeKey: adaptedRecord?.authorityIdentity,
      proofAuthorityIdentity: recordProof?.authorityIdentity,
      identityMethod: adaptedRecord?.identityMethod,
      category: record?.category,
      startTime: record?.startTime,
      updatedTime: record?.updatedTime,
      updateTime: record?.updateTime,
      updatedAt: record?.updatedAt,
      endTime: record?.endTime,
      freshnessStatus: recordProof?.freshnessStatus,
      ownershipMethod: recordProof?.geographicOwnershipMethod,
      geometryQualified: recordProof?.selectedAwarenessMatch,
      duplicateStatus: recordProof?.duplicateStatus,
      finalEligibility: recordProof?.finalEligibility,
      ineligibilityReasons: recordProof?.ineligibilityReasons
    };
  });

  const proofKeyCounts = proof.reduce((out, item) => {
    const key = item.authorityIdentity;
    out[key] = (out[key] || 0) + 1;
    return out;
  }, {});
  const duplicateProof = proof.filter(item => item.duplicateStatus === "duplicate");
  const result = {
    selectedAwarenessArea: area,
    counts: {
      connectorStatewide: connector.getAllNormalizedRecords().length,
      connectorAwareness: awareness.length,
      authorityAdapterInput: authority.rawRecordCount,
      normalizedAuthority: authority.normalizedRecordCount,
      canonicalIdentityValid: adapted.filter(r => Boolean(r.authorityIdentity)).length,
      postDeduplication: authority.uniqueProviderRecordCount,
      duplicateProofCount: duplicateProof.length,
      recordProof: proof.length,
      postCategory: proof.filter(p => p.consumerMeaningfulCategory === true).length,
      postGeography: proof.filter(p => p.selectedAwarenessMatch === true).length,
      postFreshness: proof.filter(p => p.freshnessStatus === "active").length,
      finalEligible: proof.filter(p => p.finalEligibility === true).length,
      authorityEligible: authority.authorityEligibleRecordCount,
      consumerProjection: consumer.consumerVisibleSituationCount
    },
    proofKeyCounts,
    duplicateProof,
    rows
  };
  console.table(rows);
  console.log("LP214 Phase 2.2C identity/count trace", result);
  return result;
})();
```

No null-coalescing chain is used to collapse identity fields. Optional chaining is
used only to read each field independently and safely.

## 13. Test results

The focused LP039.2, LP039.3, LP044 shared-geometry, and LP214 source-health checks
pass. The LP043 fixture suite has one time-dependent failure at the 2026-08-17
audit date: its fixed fixture window has already expired when evaluated against
the wall clock, although the test expects final eligibility. That pre-existing
fixture limitation does not contradict the identity assertions and was not
patched in this audit. These repository checks do not manufacture the missing live
Dallas IDs or certify the live zero.

## 14. Files created

Only this audit report was created. No production surface or test fixture changed.

## 15. Git status

The repository already contained ignored/untracked build dependency directories
(`android/.gradle`, `android/build`, and `node_modules`). They are not part of this
audit or commit. The only intentional tracked change is this report.

## 16. Recommendation

Run section 12 in the same connected Dallas session and preserve its returned
object. Require `authorityAdapterInput === normalizedAuthority === recordProof ===
8`. Then classify the real zero from populated `ineligibilityReasons` and only
open a separately authorized repair if those reasons prove a production defect.
Do not merge LP214, change freshness policy, patch a protected surface, or begin
weather/NWS work on the current incomplete evidence.

**Stop condition:** the current evidence does not prove that identity or dedupe
turns eight into zero. It proves that the owner diagnostic masked eight incident
IDs with the provider name and then failed to expose their LP039 proofs. The
governed selector did return zero, but its exact rejecting predicate is unavailable
until the corrected, index-preserving proof capture is run.
