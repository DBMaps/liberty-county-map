# LP076 — Historical Intelligence Learning Foundation Handoff

## 1. Executive Summary

LP076 adds an isolated qualification and archive boundary between community observations and LP067. Valid, supported, complete, geographically grounded observations can become immutable, versioned historical records; rejected evidence retains transparent reason codes. The foundation is deterministic, non-predictive, append-oriented, and absent from production runtime. Current alerts remain authoritative.

The milestone does not change submission, production report storage, synchronization, LP067–LP075, `index.html`, or `js/app.js`. It does not activate Historical Intelligence.

## 2. Learning architecture

The internal flow is **community observation → qualification → historical archive → incremental learning → unchanged LP067 input**. `qualifyObservation` only decides learning eligibility. `archiveObservation` produces a durable record without mutating its source. `ingestIncrementally` appends unseen records to an existing archive. `toLP067Observations` exposes only qualified normalized records to the pre-existing pattern engine.

The module performs no I/O, storage writes, network requests, timers, DOM operations, report validation, or production registration. A future adapter may persist its output, but that is outside LP076.

## 3. Observation qualification model

Qualification requires a valid object and validation state, parseable timestamp, supported hazard or event type, awareness area, community and county context, and a roadway or crossing. Optional allowlists certify awareness-area and county validity. The result is `{ eligible, status, reasons, evaluatedAt }`, making every rejection auditable.

Reason codes include `invalid_observation`, `invalid_timestamp`, `unsupported_event_type`, `missing_awareness_area`, `incomplete_geography`, `missing_historical_subject`, and `geographically_invalid`. These rules govern historical usefulness only; they neither replace nor alter report-submission validation.

## 4. Historical archive model

Each immutable archive record contains awareness area, community, county, roadway, crossing, hazard and event types, canonical observation timestamp, local date/day/time, optional duration, observation source, qualification status, and archive version. It also carries deterministic subject, area, behavior, and fingerprint fields required for deduplication and LP067 compatibility.

The source timestamp is canonical UTC. Local values use an explicitly supplied UTC offset (defaulting deterministically to zero); LP076 does not infer location timezones. `archiveVersion: 1` enables future migrations without rewriting the meaning of existing evidence. The archive is internal and has no consumer DTO or presentation path.

## 5. Incremental learning model

`ingestIncrementally(existingArchive, observations)` builds a fingerprint set once, qualifies each new observation, and appends only new qualified records. Its result separately reports `added`, `rejected`, and `duplicates`, and declares `incremental: true` and `rebuildRequired: false`. Existing records remain intact and LP067 may recompute only from the supplied normalized collection when an internal caller chooses; no production scheduling is introduced.

Fingerprint identity combines awareness area, community, subject, hazard, event, and exact observation instant. A repeated submission therefore cannot strengthen evidence merely through duplicate volume, while genuinely separate observations remain available to strengthen recurring-pattern evidence.

## 6. Observation aging governance

Aging is descriptive metadata, not deletion or predictive weighting:

- **Recent:** 0–30 days; newly available evidence.
- **Established:** 31–180 days; durable evidence with continuing historical relevance.
- **Aging:** 181–365 days; evidence that should be interpreted with additional temporal context.
- **Inactive:** more than 365 days, or an unusable timestamp; retained but not asserted as current evidence.

LP076 deletes nothing, defines no retention policy, and does not mutate archived records when their derived age class changes. Classification is deterministic relative to an explicit evaluation time.

## 7. Learning quality rules

- Duplicate fingerprints are reported and not appended.
- Incomplete timestamps, geography, or historical subjects are rejected.
- Unsupported hazard/event evidence is rejected against a transparent supported-type registry.
- Optional geographic allowlists reject observations outside known awareness areas or counties.
- Invalid upstream validation state is honored without redesigning submission validation.
- Qualification reason codes preserve explainability; no score, forecast, or probability is created.
- Archive immutability and explicit versioning protect historical durability.

LP067's contract remains unchanged: it receives normalized observations containing its existing geography, subject, day/time, duration, timestamp, area key, and behavior key fields. LP076 does not edit LP067 and does not pass rejected archive candidates to it.

## 8. Browser certification instructions

1. From the repository root run `python3 -m http.server 4173`.
2. Open `http://localhost:4173/tests/lp076-browser-certification.html` in a supported browser.
3. Confirm all eight checks show **PASS** and `document.body.dataset.certification` is `pass`.
4. Inspect `window.__LP076_CERTIFICATION__`; confirm `passed`, `learningFoundationComplete`, `archiveModelComplete`, `qualificationModelComplete`, and `productionIsolationPreserved` are `true`.
5. Confirm `activationRemainsDisabled` is `true` and the activation object is `productionIntegration: false`, `consumerVisible: false`, `activationAuthorized: false`, `explicitOptInRequired: true`.
6. In the Network panel confirm only the certification page, learning module, and unchanged LP067 module load. Production `index.html` and `js/app.js` must not load.
7. Run `npm run test:lp076`, then the LP067–LP075 regression scripts.

## 9. Merge recommendation

**Recommend merge** when the automated LP076 test and LP067–LP075 regressions pass and the isolated browser page shows eight passing checks. The change is additive and preserves production behavior, consumer invisibility, current-alert authority, and all activation locks.

## 10. Recommended LP077

LP077 should define an internal, read-only persistence adapter and replay/idempotency protocol for qualified archive records. It should specify authoritative timezone and geography registries, migration governance, operational observability, and controlled backfill behavior without activating presentation or changing report storage and synchronization.

## Updated next-chat handoff

Begin with this handoff and treat LP076 as an inactive learning contract, not a deployed ingestion job. Preserve the four activation flags. Do not connect community submission or Supabase directly to this module until a separately reviewed adapter contract exists. Keep LP067 input fields unchanged, retain qualification reason visibility for operators, and add no deletion or retention policy without explicit governance. Validate LP077 against duplicate delivery, replay, partial failure, archive-version migration, timezone authority, geographic registry drift, and production isolation.
