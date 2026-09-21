# LP244.43 — Notification architecture

2026-09-21; baseline `647c85a30d042a90276c3915ba92538df78ddf1c`. **Proposed architecture, no implementation or activation.** Current findings below are repository findings; provider consoles, production SQL state and physical-device delivery were not inspected.

## Current delivery boundary (parts 9–11, 17–19, 34–36)

**PARTIALLY IMPLEMENTED** is the correct aggregate classification: local preference UI/storage and diagnostic candidate generation exist; notification **delivery is NOT IMPLEMENTED**. This is not complete-but-disabled push, web-only push, or Android-only push.

`js/app.js:101633` stores routeAlerts, railAlerts, hazardAlerts and communityAlerts under `gridlySettingsV1`. `gridlySmartAlertsV1` is a second legacy opt-in preference model (`getDefaultSmartAlertsPreferences`, 105364). The Settings UI explicitly says delivery is coming soon (120392). `buildGridlyNotificationArchitectureAudit` (105212) builds route/rail/hazard/community candidates; its return explicitly says `diagnosticOnly:true`, `deliveryEnabled:false`, `runtimeLoopsAdded:false`, `schedulerAdded:false` (105333). Freshness windows, issue keys and route-distance helpers are a prototype policy, not an outbox or delivery ledger. Do not turn these stored booleans into native consent automatically.

Repository-wide evidence scan: 6,321 tracked text files examined from 6,664 tracked paths; 681 files matched broad notification concepts; 9 files matched delivery-specific patterns, **none in current js/android/ios/supabase/service-worker source**. Historical docs and test assertions produce the positive matches. Full per-file counts and examples, exclusions and search expressions are in `reports/lp24443-current-capability-inventory.json`. Large data and binary assets are enumerated as excluded, not falsely described as searched implementation. Generated dependencies and untracked owner-local credentials are outside absence claims.

`tests/lp165/statewide-notification-certification.test.mjs` checks fixture copy/relevance and explicitly tests delivery absence. It is not device delivery certification. Existing diagnostic candidate code permits saved-route context as fallback when route geometry is unavailable (105257, 105283, 105311); do **not** promote that fallback into launch targeting. Current 0.8-mile point/vertex relevance is not an ahead/behind push policy.

### Android

`package.json`/lock pin Capacitor core/android/ios/CLI to **8.3.4**, Supabase JS to 2.112.4. No `@capacitor/push-notifications`, local-notifications, app/deep-link plugin or official geolocation plugin is installed. `capacitor.config.json` identifies `com.gridlygo.gridly`, webDir `www`; no push configuration. Android `app/build.gradle` sets minSdk 24, target/compile 36; app plugins are Android application and Kotlin. No Google services plugin/Firebase messaging dependency in application integration; no tracked google-services.json.

`android/app/src/main/AndroidManifest.xml:3` declares INTERNET, network state, coarse/fine foreground location. No POST_NOTIFICATIONS, background location, notification service/channel metadata or URL VIEW/BROWSABLE intent filter. MainActivity registers only the custom one-shot geolocation plugin. No token registration/rotation/reinstall handler, foreground notification listener, background delivery service or tap-to-context dispatcher was found.

Future implementation needs native push package/configuration, Firebase app configuration for the standard Capacitor Android path, Android 13+ runtime notification permission, channels, foreground presentation and tap handling. This **requires a new Android launch candidate build and physical certification**; the separately frozen candidate cannot acquire missing native code/configuration through documentation or a web-only update. Keep API 24–32 behavior and API 33+ permission paths separate. [Capacitor v8 Push API](https://capacitorjs.com/docs/apis/push-notifications), [Android notification permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission).

### iOS

`ios/App/App/Info.plist` has NSLocationWhenInUseUsageDescription. No aps-environment entitlement, push capability, associated-domain entitlement, custom URL scheme or remote-notification background mode found in tracked iOS project. `AppDelegate.swift` has standard ApplicationDelegateProxy URL/open and universal-activity forwarding, but no APNs registration success/failure callbacks. This proxy scaffold alone is not a registered/working link target.

Cross-platform work can define payload schemas, target parsing, context restoration, settings and tests. macOS/Xcode and owner signing access will eventually be required to configure capabilities/provisioning, integrate APNs, compile/sign, and verify foreground/background/terminated tap behavior on physical iPhone. APNs registration and delivery cannot be certified from this Windows repository audit. The usual Capacitor iOS plugin yields APNs tokens; do not send them to FCM as if they were Android FCM tokens. Choose direct APNs server delivery or explicitly integrate an iOS FCM bridge later. [Capacitor v8 Push API](https://capacitorjs.com/docs/apis/push-notifications).

### Background and service worker

Current Route Watch uses foreground `navigator.geolocation.watchPosition` (app.js:54773), JS timers and client source refresh. No Android foreground/background location service or iOS location background mode was found. An active flag cannot guarantee execution while locked, suspended, killed, force-stopped, offline or under power restrictions. Server-driven visible push is the recommended background mechanism. Do not rely on a data-only notification to wake killed JS; standard Capacitor has platform-specific limitations. Apple background updates are discretionary, not continuous execution. [Capacitor delivery limitations](https://capacitorjs.com/docs/apis/push-notifications), [Apple background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app).

Default launch does not need always-on background location. A static active corridor can receive server-evaluated events while the UI is suspended, with “along your trip corridor” wording. Background “near you now” and “ahead now” require fresh location truth that this architecture does not guarantee. Location freshness expiry stops those claims. Reopen refreshes permissions, tokens, watch expiry and source state. Battery design: bounded foreground sampling, no duplicate watch, stop on trip end, no polling for unchanged UI.

`service-worker.js:52` only handles same-origin GETs; navigation is network-first with offline shell fallback and named static/geometry caches. No push/notificationclick/showNotification event path. `manifest.json` and web shell metadata do not establish native push. PWA/web push is not a launch dependency. Native bundle freshness and old service-worker caches should be exercised in future upgrade tests; do not redesign as PWA.

## Backend foundation and missing concepts

Current tracked Edge Function: `supabase/functions/gridly-geocode/index.ts` plus shared geocode/address modules. Report submission/confirmation/edit/clear/cancel use database RPCs from `js/gridly-report-protocol.js`; public report fields include id, created_at, report_type, severity, lat/lng, source, confidence, expires_at. `20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql` provides private device_links, operation digests, replay admission, observation receipts, guarded mutations and retention triggers. `20260916183911_google_play_compliance_closure.sql` adds private moderation/complaint/source suppression/deletion structures. They are report ownership and compliance machinery, **not push delivery**.

`supabase/retention/activate-community-report-retention.sql:7` declares pg_cron and a minute retention job. That file is deployment preparation/evidence, not proof the live job is healthy today. `202607290200_lp1041_texas_address_foundation.sql` declares PostGIS and spatial address/county indexes. `supabase/config.toml` exposes public/graphql_public; private schemas are not exposed. No tracked device-push registry, notification subscription/watch-route table, preferences service, outbox, dedupe/delivery receipt ledger, notification send Edge Function or server-side NWS/DriveTexas notification ingestion loop was identified. Current weather/roadway ingestion is client connector work; server fan-out needs ingestion ownership and feed freshness, not a timer that scrapes each device's current screen.

Server report device identity exists; Home Area and notification preferences are currently local. Do not say “no device concept exists,” and do not treat the public anonymous Supabase API key or report device ID as secure push ownership.

## No-login registration contract (parts 12, 32–33)

Recommended: an installation-scoped random identifier plus a separate high-entropy registration credential, stored with native secure-storage protection where available. No mandatory account, advertising identifier, IMEI or cross-app fingerprint. A random public device ID or push token alone is not authorization. Keep report ownership identity separate to avoid joining travel subscriptions with public report activity.

Enrollment is explicit after value explanation and OS permission; server issues/validates installation ownership, rate-limits enrollment, and verifies token binding (challenge/attestation where practical). Token possession should not permit stealing another installation's subscriptions. Device owner authenticates every preference/watch mutation with the credential; use nonce/timestamp replay checks and TLS, bounded request sizes, rate limits and platform/environment validation. Auth anonymous sign-in is an alternative if deliberately selected; it still requires per-owner policy and session handling, not `TO authenticated` alone. No current runtime change is assumed.

On token rotation, atomically replace/revoke the old token for that installation/platform/environment, retaining only bounded operational tombstones. Retry registration idempotently after network failures and on resume. Credential rotation revokes old credentials and outstanding sessions. New install gets new identity and no old Home/route subscriptions automatically. Uninstall callbacks are not reliable: expire inactive registrations, process invalid-token responses, and age out unattested/unused subscriptions. Explicit Reset/Delete alerts deletes watch/prefs/token/delivery linkage, cancels queued work and clears local credentials. If credentials were erased first, do not identify a person from an arbitrary supplied token; support existing privacy-request workflow and automatic expiry.

### Proposed schema (documentation only; no SQL/migrations)

All tables below private by default. IDs UUIDs, timestamps UTC, schemaVersion explicit. Retention figures are proposed maxima pending operational/product review.

| Entity | Minimum fields and constraints | Retention/access |
|---|---|---|
| notification_installations | id PK, credential_digest, credential_version, platform, app_version, environment, created_at, last_seen_at, revoked_at | Owner through authenticated endpoint only; no public reads; expire idle registrations (proposed 90 days) |
| notification_tokens | installation_id FK, provider, environment, token_ciphertext, token_digest, rotated_at, invalidated_at | Unique active provider/environment/token_digest; server send only; delete revoked token material |
| notification_preferences | installation_id PK/FK, enabled, contexts, weather/hazards/community/routine flags, quiet_start/end, timezone, schema_version | Versioned owner updates; delete with installation |
| watch_subscriptions | id PK, installation_id FK, kind HOME/AROUND_ME/DESTINATION/ROUTE, place_id, memberships, geometry_ref, created_at, expires_at, revision, state | HOME persistent opt-in; transient current/destination explicit TTL; revoke atomically |
| route_watches | watch_id PK/FK, geometry, geometry_hash, origin/destination refs, provider, route_fetched_at, started_at, expires_at, ended_reason | No public spatial query; proposed 12h max; delete geometry on end/expiry |
| watch_progress | watch_id PK/FK, coarse chainage or minimal last fix, accuracy, observed_at, expires_at | Optional; replace in place, no append history; proposed 2-minute relevance lifetime; no numeric ahead after expiry |
| notification_events | canonical_event_id PK, source, source_event_id, source_revision, condition/subtype, severity, advisory, authority, geometry_ref/precision, effective/expires/resolved times, last_source_success, projection_version | Public-safe normalized event only; preserve provider provenance and lifecycle separately |
| notification_event_aliases | source/source_id unique → canonical event | Link only proven equivalent identities/official replacements; avoid fuzzy merges of nearby hazards |
| notification_outbox | id PK, installation_id, event_id, semantic_revision, generation, state, not_before, expires_at, lease_until, attempts, collapse_key, target_json | Unique installation/event/semantic_revision/notification_kind; private transactional enqueue, bounded lease/retry |
| notification_delivery_ledger | installation_id, event_id, semantic_revision, kind, submitted_at, provider_message_id, result, dedupe_until | Provider accepted ≠ device delivered/read; proposed 7-day bounded dedupe, no content/location trail |
| notification_deletion_tombstones | irreversible operation digest, completed_at | No token/route/device linkage after deletion; short replay protection only |

Target JSON: `{v:1,kind,eventId?,placeId?,watchId?,contextMode,expiresAt}`. Opaque IDs only, no credentials/precise GPS. Installation deletion cascades owned rows; public event retention is independent. A worker must recheck owner revocation and watch generation immediately before send so queued retries cannot resurrect cancelled subscriptions. These entities may be consolidated where simpler, but their authorization/retention roles must remain explicit.

### Security gates

No `anon` SELECT on tokens, subscriptions, routes or delivery logs; revoke default grants, use private schemas and defense-in-depth RLS. An endpoint running with service role must perform ownership checks itself; service role bypasses RLS. Bind owner IDs server-side, never trust an installation_id in an arbitrary body. Deny cross-owner SELECT/INSERT/UPDATE/DELETE, FK probing, guessed watch IDs and token replay. Security-definer functions require fixed search_path, least execute grants and narrow privileged work. Views must not accidentally bypass owner policies. Do not use user-editable metadata for ownership.

Do not log tokens, request bodies, raw GPS, credentials or route endpoints; record bounded reason codes/counters. Encrypt token material at rest where operationally supportable; hash it for matching. Keep provider credentials solely server-side. Follow suppression, withdrawn source capability and moderation decisions before fan-out, including events previously public. Existing report replay/deletion patterns are reusable concepts, not authority to expose their private links. [Supabase RLS/grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Categories, priority and consent (parts 13–14, 17, 31)

Separate **where** (Home, Around Me, active Route Watch, optional destination) from **what** (official severe weather, roads/significant hazards, community, routine). Do not expose the Cartesian product as dozens of switches. Settings: master status; Home switch; Around Me switch; Route Watch switch; severe weather; significant roads/hazards; community updates; routine updates collapsed/default off; quiet hours. Destination watch is a time-limited action on its card, not always-on surveillance of every search. Railroad infrastructure is KBYG content; only timely qualifying reported conditions should alert.

Defaults proposed: explain value after user intent (“Get alerts about important conditions near home or during a trip.”); allow Not now. Then request native permission after opt-in. No first-launch permission prompt. Existing true preference defaults are not evidence of consent. Show distinct states: permission denied, delivery setup failed, alerts enabled, and last synchronization time. OS Settings link when denied; don't repeatedly prompt. Location and notification permissions are independent; Home alerts need no current GPS permission.

High-awareness candidates: official severe warnings, source-confirmed closure/impassability, high water/ice, serious directly relevant blockage/crash and official emergency notices. Community events stay explicitly reported and require confidence/recency/impact policy; high severity never grants official authority. Routine: construction/planned work, minor reports, ordinary community updates. Initial high-awareness output should be limited to relevant new hazards or material escalation; routine batching/digest, cooldown and per-device cap (candidate 3 routine/day) require product validation. No automatic privileged Apple Critical Alert entitlement, guaranteed delivery, or bypass of system mute is implied by the internal high-awareness label.

Quiet hours are not implemented today. Propose device-selected timezone and overnight/DST-safe intervals; routine defers only until event expiry, then drops. High-awareness bypass of **app** quiet hours must be explicit user choice and remains subject to OS settings. Do not silently wake users for every official advisory.

## Dedupe, expiration and cancellation (parts 15–16)

Current event identity: NWS provider normalizer uses id/__sourceId/event_id/eventId/identifier; missing IDs fall back to weather-foundation-index. DriveTexas uses GLOBALID/globalId/id/event_id/eventId with index fallback (`gridlyDriveTexasProvider.js:194`). Community reports have database id and operation identity, plus client cluster keys; crossing ID identifies infrastructure, not each blockage occurrence. Index fallback is unstable across fetch order and must not become a push identity. Existing `gridlyNotificationStableIssueKey` (105124), source normalization and route dedupe are inputs to review, not a durable delivery record.

Canonical event key = source namespace + stable provider event ID; report UUID for community; preserve explicit NWS references/replacement chains when ingesting full payload. Cross-source merging requires demonstrable same incident, not merely same type/county/nearby coordinates. Maintain source aliases and conservative human-readable grouping where identity is uncertain.

Unique send key = installation + canonical event + material semantic revision + notification kind. **Context is not part of the uniqueness key**: Home + route + current-area matches aggregate into one candidate with the most relevant tap target. Refetch time, changed sort order, typo fix or more context matches do not constitute a material revision. Severity escalation, official closure/reopen, changed affected geometry that newly intersects a watch, or important source instruction change can create one bounded update. Transactional outbox uniqueness handles racing ingestion workers; provider collapse IDs assist presentation but are not exactly-once guarantees. Store provider acceptance separately from confirmed interaction.

Before enqueue and again before send: active source and capability, event effective time, expiration, report lifecycle, moderation visibility, watch TTL/generation, preferences and quiet hours must all pass. Expired/resolved/cancelled/reopened events remove unsent active alerts; expiration alone is not proof road reopened. A new recurrence after a terminal state needs a distinct source occurrence/revision. For existing sent items, supported local removal/collapse is best effort: no promise of recalling an already displayed OS notification.

Route ended or event behind/outside validated remaining corridor → cancel queued route-only match, retain Home match if independently relevant, no duplicate send. User moved outside current-area watch or fix expires → revoke that ephemeral context, no covert GPS refresh. Weather cancel/expiry drops pending warning; source outage marks unknown, not all clear. Source withdrawal/suppression invalidates cached eligibility regardless of unexpired nominal timestamp.

Expiration truth already exists in report `expires_at`, clear/retention RPCs, local `getIncidentLifecycleState`, recent-clear indexes, NWS effective/expiration/messageType filters (`gridlyWeatherLiveConnector.js:54`) and DriveTexas endTime plus connector freshness. Maximum legal/data retention is **not** an alert active lifetime. Feed disappearance means resolved only after complete successful authoritative refresh semantics, not after a timeout or partial page failure.

## Deep links (part 18)

No current notification-target router found. `focusAlertLocation` (app.js:110429), destination selection, KBYG/portrait panels and event identity are reuse targets. The app's URLSearchParams usage includes provider request parameters (97077) and `review=1` mode (116305), not an event/place target dispatcher; no pushState/popstate/hashchange routing path was found in app.js. iOS delegate forwarding is not a validated cold-start notification route. Android has only launcher intent filter. No runtime appUrlOpen handler or installed Capacitor App plugin; no universal/app-link association infrastructure found.

Design one versioned internal dispatcher for PLACE, REPORT/HAZARD, ROAD_CONDITION, WEATHER_ALERT, TRAVEL_BRIEF, CURRENT_AREA and ROUTE_WATCH. Push action callback and approved URL links feed the same parser. Validate scheme/host/type/version/identifier and timestamp; never eval arbitrary URLs, set Home or create a route automatically. Await native boot, storage validation and source/context readiness, then fetch target and apply temporary context atomically. Deduplicate repeated taps and cancel old target loads. Warm and terminated launch must produce the same result.

A current-area tap refers to the alert's captured area; do not silently prompt GPS or claim it is current position now. Expired/removed target opens a small “This update is no longer active” state plus current awareness for that area. Missing route watch opens trip ended status, not automatic restart. Offline opens captured safe metadata with last-updated/unknown status; retry resolves live source before showing active severity. Strict object authorization still applies to private watch IDs. Keep notification lock-screen text useful without home address or precise location.

## Delivery degraded modes (part 38)

| Failure | Required behavior |
|---|---|
| Location denied/revoked/unavailable | Home/manual search still work; Around Me unavailable; stale fix expires |
| Push permission denied or registration failed | Distinguish OS permission from server setup; preserve voluntary preferences; no false enabled state |
| NWS or DriveTexas fails | Last success/unknown coverage; no clear-road/all-clear inference; no stale queued warning |
| No valid route geometry | Destination awareness remains; route-specific claims and activation disabled; no straight line substitute |
| Destination unresolved | Ask for qualified result/manual pin; no automatic Home change or guessed exact address |
| Offline | Cached data visibly dated; no new near-now claims; queue preference edits with generation/idempotency, not stale alert sends |
| Watch cannot update | “Trip updates paused/unavailable”; stale progress loses ahead claims; stop remains available |
| Expired event/tap | Terminal target state; never resurrect active warning from cache |

## Costs/external dependencies (part 42)

Current OSRM public endpoint is a real dependency, not an absent provider. Do not assume its demo/public capacity is production SLA. Assess self-hosted OSRM or a suitable hosted endpoint with measured trip volume before paying for a new API. No new map provider is intrinsically needed. Existing governed geocoder uses Nominatim/default configurable provider; public service policy limits require attention to rate limits, attribution and permitted request patterns. [OSRM API](https://project-osrm.org/docs/v5.24.0/api/), [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/).

Standard Android push path requires Firebase project/app setup; iOS requires Apple APNs/signing capability setup. A paid third-party push aggregator is not technically required. Cloud messaging transport and backend hosting are separate cost categories; do not promise total zero cost. New Supabase reads/writes, workers, source polling, spatial intersections, dedupe and egress incur usage. Budget by active installations × subscriptions, source update volume, relevant matches and retries—not one poll per device. Apple program/account terms and service quotas must be checked by owner before activation; no purchase or signup was performed.

## Documentation/privacy implications (part 43)

Existing `legal/privacy.html` already discusses foreground location, provider transmissions and local device/report identity; it does not describe this proposed push registry, token lifecycle or server-held trip geometry. Review Privacy Policy, Terms (awareness and delivery limits), Delete Data workflow, Community Guidelines (observations vs authorized instructions), App Store privacy disclosures, Google Play Data Safety, location purpose strings and in-app notification explanations. Include precise recipients, purposes, retention, deletion/reinstall behavior and background scope actually implemented. No legal documents changed and no legal approval claimed. Relevant platform documentation was consulted only for technical constraints.
