# LP244.43 — Implementation sequence and launch decisions

**Plan only; no implementation authorization is implied.** Baseline `647c85a30d042a90276c3915ba92538df78ddf1c`. Request parts 37–43. The owner identifies notifications, quick community inspection and useful awareness away from home as launch requirements; this audit does not silently defer them.

## Capability / gap matrix

Multiple classifications are allowed where a feature has an existing foundation and separate blocking dependencies. “READY TO IMPLEMENT” means a bounded next step is sufficiently defined, not launch-ready software.

| Feature | Primary classification | Additional blockers / implementation boundary |
|---|---|---|
| Destination Quick Check | PARTIAL FOUNDATION | READY TO IMPLEMENT context integration; existing search preserves Home, full temporary awareness not yet unified |
| Around Me | PARTIAL FOUNDATION | READY TO IMPLEMENT foreground context; native location parity/staleness certification required |
| Route Watch | PARTIAL FOUNDATION | Existing OSRM/foreground watch; BLOCKED BY PRODUCT DECISION for background promise, progress/expiry and provider capacity |
| Home notifications | BLOCKED BY BACKEND | BLOCKED BY NATIVE CONFIG; local preference/candidate foundation exists |
| Around Me notifications | BLOCKED BY BACKEND | BLOCKED BY NATIVE CONFIG and PRODUCT DECISION: explicit foreground freshness vs background expectation |
| Route Watch notifications | BLOCKED BY BACKEND | BLOCKED BY NATIVE CONFIG; signed progress, full-geometry relevance and session lifetime required |
| Severe Weather notifications | BLOCKED BY BACKEND | BLOCKED BY NATIVE CONFIG; server ingestion/full geometry/event identity needed |
| Hazard notifications | BLOCKED BY BACKEND | BLOCKED BY NATIVE CONFIG; shared lifecycle/authority/dedupe contract |
| Condition + Severity + Advisory | PARTIAL FOUNDATION | Advisory registry/authority validation NET NEW; source/model contract READY TO IMPLEMENT after bounded decisions |
| Winter hazards | PARTIAL FOUNDATION | Picker/display/filter gaps, official winter normalization and physical verification |
| Deep linking | PARTIAL FOUNDATION | iOS delegate scaffold; target dispatcher NET NEW; BLOCKED BY NATIVE CONFIG |
| Notification settings | PARTIAL FOUNDATION | Stored preferences exist; consent, delivery status, quiet hours and server synchronization NET NEW |

Machine-readable classification, evidence and gates: `reports/lp24443-launch-gap-matrix.json`.

## Required launch scope

**MUST HAVE:** Home-preserving community Quick Check; explicit foreground Around Me with coherent weather/KBYG/roads context and manual fallback; functioning opted-in Home notifications for official severe weather and significant hazards, exact tap target, secure no-login ownership/deletion, dedupe/expiry, permission handling and device certification. Basic useful foreground Route Watch/trip awareness, truthful static-corridor notification behavior if marketed, and winter ICE observation/authority/readability readiness are launch gates for this requested feature cluster. Notification preferences with no delivery do not meet the owner requirement.

**SHOULD HAVE:** explicit short-lived destination watch; expanded winter observation subtypes; routine digest/quiet-hours polish beyond the minimum default-off routine setting; improved geometry/directional confidence. Quiet-hours correctness is mandatory if the control is shipped. Around Me notifications should support a clear temporary scope; if the owner requires continuous background “near me now,” it becomes an additional must-have native/product gate, not a promise this plan can meet with foreground-only location.

**SAFE POST-LAUNCH:** turn-by-turn navigation (outside launch boundary), automatic rerouting, continuous breadcrumb histories, always-on background location, cross-device account sync, sophisticated commuter predictions and any live-train claim without a real source. These are not substitutes for the requested travel usefulness. Active Route Watch push must be completed before claiming background trip alerts; if shipment without it is proposed later, obtain an explicit owner scope decision.

## Safest sequence

| Phase | Deliverable | Dependency / acceptance gate |
|---|---|---|
| 0. Freeze contracts | Record scope: foreground current-area vs static-corridor background, geometry source, lifetime, severe/community thresholds and advisory authority | Owner can review this concrete audit; no promise of navigation or guaranteed alerts |
| 1. Separate location contexts | Introduce single versioned activeContext publisher, keep Home persistence only in explicit chooser, generation-safe adapters | Cleveland Home + Crosby Search + Beaumont Around Me retains exact Home bytes across reload/late responses; PLACE membership ambiguity preserved |
| 2. Normalize event/projection contract | Stable source identity, lifecycle, condition/severity/advisory authority, winter adapters and geometry provenance | Old report types remain readable/clearable; no official authority from community text; no new enum required simply for every source label |
| 3. Complete foreground travel consumers | Bind KBYG/Location Context/weather/roads/crossings/POIs to activeContext; native provider parity and location expiry | Around Me does not mutate Home; revoked/approximate location and portrait behavior certified; reuse existing Route Watch |
| 4. Build private backend | No-login installation registration, minimal subscriptions, event ingestion, transactional outbox/dedupe/deletion | Cross-device ownership attacks denied; token replay/enumeration mitigated; report retention unchanged; no location trail |
| 5. Add native registration and deep links | Android FCM, iOS APNs integration, tokens/rotation, channels, common target dispatcher, permission UX | Cold/warm/terminated taps resolve exact context; invalid/expired/offline targets safe; new signed candidates |
| 6. Deliver Home alerts | Severe weather/significant hazards, opt-in preferences, source freshness, dedupe and expiry | One unchanged event across repeated fetches produces one delivery decision; outage never means all clear |
| 7. Harden trip relevance and transient alerts | Session TTL, segment-based chainage, complete official geometry, off-route/behind suppression, optional destination/current-area subscriptions | 6.2-mile-ahead claim only with valid fresh progress; 4.8-mile-off-route work suppressed; stop kills queued generation |
| 8. Certify and release separately | Physical Android/iPhone matrix, portrait review, accessibility, battery/background, deletion and disclosure review | New candidate hashes and documented owner release decision; no reuse of frozen candidate as proof |

Identity and event contracts should precede notification UI. Native/provider setup investigation can be planned early, but building UI switches before backend eligibility/consent exists risks repeating the present “preferences only” state. Deep-link contract belongs before enabling any delivery. Winter normalization belongs with event projection, not as a late picker-only patch.

## Future test strategy

| Layer | Required cases |
|---|---|
| Unit | Context state transitions; coordinate validation/age/accuracy; canonical PLACE/multi-county identity; aliases and condition/advisory authority; timezone/DST quiet hours |
| Contract | NWS full Polygon/MultiPolygon/holes, null geometry and zone fallback; DriveTexas points/lines/missing IDs; community old/new protocol; provider replacements, withdrawal and partial fetch |
| Database/RLS | Anonymous/public denial, owner A/B isolation on every CRUD method, malicious owner reassignment, private-view leakage, security-definer search_path, token replay, deletion cascading, outbox lease races |
| Delivery | Token rotation, reinstall, invalid token, permission revoked, retry after timeout, provider accepted vs displayed distinction, duplicate ingestion, Home+Route single event, escalation vs unchanged update |
| Lifecycle | expired/clear/cancel/reopened/source-withdrawn; expiry while quiet-hour queued; stop/delete while worker holds lease; no stale event resurrection |
| Route | Genuine OSRM geometry only; parallel/frontage roads; loops/ambiguous projection; behind/off-route suppression; point/line/polygon; coarse or stale fix; no county-only ahead; crossing infrastructure vs reported condition |
| Context/UI | Cleveland Home, Crosby temporary Search, Beaumont Around Me, multi-county PLACE; late-response discard; Home preserved after tap/stop/restart; one portrait area chooser |
| Deep links | Each target kind, malformed version/host/ID, unauthorized watch, expired/deleted event, cold/warm/background/terminated launch, offline hydration and repeat taps |
| Physical Android | API 24–29 native one-shot compatibility; API 30–32; API 33+ notifications; target 36 behavior; approximate/precise/denied/revoked location; killed app, power saver/Doze, notification channel settings, font scale and portrait |
| Physical iPhone | Signed APNs development/production environments, allow/deny/provisional behavior if used, foreground/locked/suspended/terminated taps, Focus/mute, when-in-use revoked/approximate location, safe areas and portrait |

No test should assert guaranteed delivery despite OS restrictions. Validate stop, privacy deletion and truthful failure messages as rigorously as successful sends. Browser emulation supplements rather than replaces native tests. macOS/Xcode is future certification work; no Mac execution required for this audit.

## Audit-phase verification results

Existing tests only: **92 tests, 91 passed, 1 failed** across Home identity/chooser, native search/geolocation, route publication, geometry/hydration, moving proximity, clear convergence, hazard identity, notification fixture policy and weather startup authority. Command and output: `reports/lp24443-existing-tests.txt`. The failing LP165 deterministic report check compares an old protected-artifact manifest against current files (crossing manifest hash differs). The audit does not refresh unrelated frozen/hash evidence. This is an existing baseline evidence drift, not a new runtime edit; semantic notification tests passed, and it remains a follow-up gate for use of that old certification claim.

No new runtime tests were implemented; the bounded audit script records source evidence only. No APK/AAB/IPA, browser/device launch, production database mutation, provider registration, deployment, push or merge occurred. Repository-only assurance does not certify backend deployment state or installed physical-device behavior.

## Open decisions and release risks

- Define whether initial background Route Watch means static corridor or fresh moving progress. The former needs no continuous background GPS; the latter needs additional native/privacy work.
- Choose sustainable OSRM hosting/capacity; local road geometry is not a substitute statewide router. No paid provider selected.
- Select registration credential protection and enrollment abuse defense, operational key rotation, device inactivity TTL and deletion SLA.
- Set high-awareness thresholds, cooldowns, quiet-hours bypass choice, transient watch lifetime and event update policy with controlled field fixtures.
- Confirm authorized operational/Dispatch public projection with its owner; no external Dispatch authorization system was available here.
- Review winter subtype launch breadth, source coverage and icon/filter parity before winter-aware claims.
- Review privacy/store disclosures after exact data flow is chosen; existing policy already describes some foreground/provider handling, but not the proposed subscription backend.
- Resolve historical LP165 evidence drift separately before citing it as current certification. Preserve frozen candidate and source governance throughout later implementation.

Verdict for this audit: **A. READY FOR IMPLEMENTATION PLANNING**. This is not launch approval; native push, backend, context integration and physical certification remain required work.
