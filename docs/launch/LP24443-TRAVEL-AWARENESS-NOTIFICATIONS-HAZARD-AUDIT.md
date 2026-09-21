# LP244.43 — Travel awareness, notifications and hazard launch audit

## Starting state and executive finding

Repository: `C:\GitHub\liberty-county-map`. Branch at start: `LP244.43-travel-awareness-notifications-hazard-audit`. Starting HEAD: `647c85a30d042a90276c3915ba92538df78ddf1c`. Starting working tree clean. Audit date: 2026-09-21. No applicable AGENTS.md found in the repository or checked ancestor paths. Supabase skill used for backend/security assessment. No delegation performed.

The existing Git directory is spelled `docs/launch`; on this Windows workspace the requested `docs/LAUNCH` resolves to the same directory. All six requested filenames are preserved without renaming unrelated documentation.

**Gridly has substantial travel foundations, but the requested launch feature cluster is not complete.** OSRM routing, Route Watch activation/stop, route-aware report hydration, moving foreground proximity, saved destinations, canonical Home identity and official source adapters exist. Notification preferences and diagnostic candidate generation exist; native/web delivery and a notification backend do not. Temporary search does not save Home, but selected-awareness/weather still derive from persistent Home, so a complete Crosby Quick Check or Beaumont Around Me requires a coherent temporary context. Ice exists internally but has consumer picker/filter/icon gaps. Full NWS geometry is not preserved through the current normalized weather path.

This is **AUDIT + ARCHITECTURE + IMPLEMENTATION PLAN ONLY**. No consumer behavior, production, native configuration, migrations, legal text, website or Dispatch was modified. No build, deploy, push or merge. The local commit requested by the owner contains audit artifacts only. Final commit identity is reported in the task response; use `git log -1` for the enclosing commit rather than embedding a self-referential hash here.

## Reading map

| Artifact | Contents |
|---|---|
| [Travel context](LP24443-TRAVEL-CONTEXT-MODEL.md) | Home/search/current location, privacy, routing evidence, relevance and portrait UX |
| [Notification architecture](LP24443-NOTIFICATION-ARCHITECTURE.md) | Native/backend/no-login security, schema, dedupe, permissions, deep links, background and failure modes |
| [Taxonomy](LP24443-HAZARD-ADVISORY-TAXONOMY.md) | Current categories/aliases/icons/source vocabularies and proposed condition/severity/advisory authority |
| [Winter readiness](LP24443-WINTER-HAZARD-READINESS.md) | Existing ice/weather gaps, compact candidate set, source truth and acceptance tests |
| [Implementation sequence](LP24443-IMPLEMENTATION-SEQUENCE.md) | Launch gap matrix, must/should/post-launch, dependencies and future test strategy |
| [Capability inventory](../../reports/lp24443-current-capability-inventory.json) | Exact scan scope, patterns, per-file matches, complete hazard metadata and aliases |
| [Launch gap matrix](../../reports/lp24443-launch-gap-matrix.json) | Machine-readable feature classifications, blockers, evidence and acceptance gates |
| [Existing test output](../../reports/lp24443-existing-tests.txt) | Recorded baseline tests, including the historical LP165 failure |
| [Audit script](../../tools/lp24443/audit-current-capabilities.mjs) | Reproducible tracked-source inventory; writes only its report |
| [Artifact validation](../../reports/lp24443-audit-validation.json) | Exact test command, 45-part coverage, evidence-path and audit-only scope checks |
| [Validation script](../../tools/lp24443/verify-audit.mjs) | Repeatable document/link/JSON/scope verification |

## Scope and proof limits

Scanned **6,321 tracked text files** out of **6,664 tracked paths** before these artifacts were added. The script enumerates 343 excluded paths (non-text extensions or data >12MB), covers code, tests, docs, historic prototypes, native manifests/configs, migration SQL, package/lock files and service worker. Broad route concepts matched 2,311 files, notifications 681, winter 458, privacy-related storage/log concepts 952. Broad matches include historical claims and debug scaffolding; findings below are based on current code inspection, not match counts alone. No delivery-specific pattern matched current js/android/ios/supabase/service-worker source; the nine matched tracked files are historical docs/tools/tests.

These are repository absence claims. Untracked credentials, installed/generated dependency contents, external Dispatch repositories, live Supabase schemas/cron job health, FCM/APNs consoles, server access logs and actual device notification state were not inspected. Binary packs are data, not proof of a routing engine. Existing tests execute extracted functions/mocks and source contracts; they do not prove all-screen physical behavior. This bounded scope is sufficient to identify implementation gaps but not to authorize launch or assert provider uptime.

Current public platform documentation was consulted for Capacitor v8 push, Android runtime permission, Apple background updates, Supabase RLS/PostGIS, OSRM and NWS. Sources are linked in the notification document and below. The requested Supabase changelog `.md` fetch returned unsupported content type; no implementation relied on an unverified changelog change. This audit did not connect to or alter a Supabase project.

## Principal findings and priority

| ID | Finding | Consequence / next implementation gate |
|---|---|---|
| F01 | Selected-awareness getter prioritizes persisted canonical Home (`app.js:48555`); weather resolves it (`48524`) | Add explicit ephemeral context; never save Home to inspect another city |
| F02 | Search selection stores temporary destination/marker, not Home (`46335`) | Reuse search instead of rebuilding; integrate full community awareness |
| F03 | One-shot custom Android plugin exists, while location control/watch call browser geolocation (`54444`, `54773`, `87497`) | Unify foreground provider/error/age/accuracy behavior and certify physical devices |
| F04 | Route Watch/OSRM/remote corridor hydration/live proximity already exist (`19558`, `78587`, `101410`) | Harden existing system; don't classify as net new or promise navigation |
| F05 | Diagnostic notification candidate generator explicitly disables delivery (`105333`) | Backend + native registration + permission + target dispatcher required |
| F06 | Current notification diagnostic geometry fallback accepts saved context without route geometry (`105257`, `105283`) | Reject this fallback for any future push eligibility |
| F07 | NWS normalized weather drops full polygon; current fetch is selected-point (`gridlyWeatherProvider.js:196`, connector:9) | Route weather needs full geometry/catalog, identity and lifecycle preservation |
| F08 | Ice missing primary picker and display set; ice PNG maps to water (`app.js:10251`, `106668`, `12310`) | Winter user-facing path and parity need bounded implementation |
| F09 | Community “Road Closed” mixes observed condition with official action (`10178`, label owner:18) | Separate condition/severity/advisory and issuer authority |
| F10 | Saved precise endpoints, report payloads and external coordinate requests already exist | No claim of purely local GPS privacy; minimize new retention and disclose subscriptions |
| F11 | No push registry/outbox/server source ingestion found in backend | Report device identity/cron patterns are foundations, not push readiness |
| F12 | Historical LP165 protected-hash certification drifts from current baseline | Do not cite old PASS as current certification; record failure without rewriting evidence |

## Complete 45-part disposition

| Requested part | Audit result and detailed owner document |
|---|---|
| 1 Home Area | Canonical Home + compatibility settings/profile keys, rehydration and county projection documented in Travel §1 |
| 2 Destination Quick Check | Home-preserving search exists; complete temporary local awareness partial, Travel §2 |
| 3 Around Me | In-memory fix and nearest context exist; native/browser split and weather coupling, Travel §3 |
| 4 Location privacy | External URL/RPC transmissions, saved/pending storage, debug/cache boundaries, Travel §6 |
| 5 Route Watch current capability | Existing live foreground route/watch, remote report source, tests and prototypes, Travel §5 |
| 6 Routing data | OSRM present; local geometry not certified statewide graph; A–D comparison, Travel §5 |
| 7 Product boundary | Awareness-first; Preview/Active/Ended with bounded lifetime; optional Pause, Travel §5 |
| 8 Relevance | Full geometry, signed segment chainage, source/freshness/severity gates and proposed bounded thresholds, Travel §5 |
| 9 Notifications | PARTIALLY IMPLEMENTED foundation; delivery NOT IMPLEMENTED, Notification current boundary |
| 10 Native push | Android Capacitor 8.3.4/API24+/FCM gaps and separate iOS APNs gaps, Notification Android/iOS |
| 11 Backend | Geocode Edge Function and report/retention/moderation RPCs; no push schema/workers, Notification backend |
| 12 No login | Installation credential + private token registry, rotation/reset/delete and no mandatory account, Notification registration |
| 13 Categories | Where vs what; Home/current/route/destination and weather/roads/community/rail truth, Notification categories |
| 14 Priority | High-awareness vs routine; impact/authority/OS limitations, Notification categories |
| 15 Dedupe | Stable event identity + installation/semantic revision, aggregate contexts, Notification dedupe |
| 16 Staleness/cancellation | Recheck on enqueue/send; expiry/clear/stop/withdrawal and best-effort removal, Notification dedupe |
| 17 Permission UX | Value explanation after intent; independent location and push consent; quiet hours, Notification categories |
| 18 Deep linking | iOS proxy scaffold only; versioned target dispatcher missing, Notification deep links |
| 19 Background | JS cannot be continuous monitor; server visible push/static corridor, Notification background |
| 20 Existing taxonomy | Full metadata/aliases, subtype/source/group vocabulary, protocol/markers/lifecycle, Taxonomy inventory |
| 21 Condition/severity/advisory | Additive projection model and impact on every surface, Taxonomy contract/migration |
| 22 Community vs authority | Observation wording, no official powers from severity/votes, Taxonomy matrix |
| 23 Operational advisories | Nine candidate advisories with public/private/share gates, Taxonomy matrix |
| 24 Winter | Existing ice and official source winter support plus eight requested concepts, Winter document |
| 25 Winter truth | Weather warning ≠ roadway closure; community observation and governed operational projection, Winter authority |
| 26 Weather/route | Preserve/intersect full polygons/zones, point/county fallback limits, Travel §5 and Winter |
| 27 Road/route | Point/line/road segment geometry and precision-specific relevance, Travel §5 |
| 28 Crossing/route | Infrastructure vs timely reported blockage; no live train claim, Travel §5 |
| 29 Around Me UX | Existing control and single shared context panel; preserve Home, Travel §4 |
| 30 Travel UX | Home/Search/Around Me/Route Watch distinct semantics in portrait, Travel §4 |
| 31 Notification settings | Master/status + context/content groups and quiet hours; avoid dozens of switches, Notification categories |
| 32 Data model | Proposed entities/keys/TTL/delivery targets and additive taxonomy fields, Notification schema + Taxonomy |
| 33 Supabase security | Private schemas/grants/RLS/ownership/replay/deletion, Notification security |
| 34 SW/PWA | Static cache only, stale shell/deep-link upgrade checks, no web-push dependency, Notification background |
| 35 Android nonregression | New native candidate required; frozen candidate untouched; API/permission device matrix, Notification + Sequence |
| 36 iOS nonregression | Cross-platform contract vs macOS signing/APNs/device certification, Notification iOS |
| 37 Test strategy | Unit/contracts/RLS/lifecycle/relevance/deep links/physical devices, Sequence tests |
| 38 Failure/degraded | Explicit stale/unknown/unavailable, manual/Home fallback, no fabricated clear state, Notification table |
| 39 Launch scope | All 12 features classified with multiple blockers where appropriate, Sequence + gap JSON |
| 40 Sequencing | Context/event foundations → foreground → backend/native/targets → Home delivery → trip hardening → certification, Sequence |
| 41 Launch blockers | Notifications/current-area/quick-check/travel utility retained as requirements; winter minimum explicit, Sequence |
| 42 Costs | Existing OSRM/geocode, Firebase/APNs setup and Supabase usage; no paid-provider selection, Notification costs |
| 43 Legal/privacy | Specific future disclosure/terms/deletion/guideline review; existing text untouched, Notification privacy |
| 44 Architecture map | Concrete paths/functions below and machine inventory |
| 45 No implementation | Only audit documents, reports and bounded source-scanning script; verified Git scope |

## Concrete file / architecture map

All line numbers refer to the starting HEAD; code is unchanged by this audit. Search symbol names when later edits move lines.

| Architecture | Current source anchors |
|---|---|
| Home storage/apply | `js/app.js:18600` key; `gridlyReadHomePersonalizationRecord:18667`; `gridlyApplyConfirmedHomePersonalization:18681` |
| Canonical Home/rehydration | `gridlyLp240ResolveGovernedHomeIdentity:18616`; `getGridlySelectedAwarenessArea:48555`; `gridlySaveCanonicalMultiCountyPlaceHome:102415` |
| Home/settings UX | `app.js:101898` Settings area display; `102250` primary Home chooser; `102574` selection; tests/lp2419-home-area-selection-simplification.test.mjs |
| Search/canonical tokens | `app.js:40062`, `40181`, `46335`, `95959`; js/lp097-search-governance.js; js/lp101-search-quality.js |
| POIs | js/gridlyPoiBrowserProvider.js; js/lp24110-poi-search-certification.js; `app.js:95596` runtime POI search |
| Geocoding | js/gridly-geocoding-client.js; supabase/functions/gridly-geocode/index.ts; lib/lp104/address-foundation.js |
| Current location | `app.js:54444` request control; `54738` setGridlyUserLocation vicinity; `54773` watch; `87497` provider; Android plugin |
| Context/geographic projection | `app.js:48524` governed weather point; `48609` governed location context; `48718` Home anchor |
| KBYG / Location Context | `app.js:3275` canonical active revision; `3403` selected-area projection; `114808` portrait location-awareness panel; js/gridlyAlertsPublishedAwareness.js |
| Weather/NWS | js/gridlyWeatherProvider.js; js/gridlyWeatherLiveConnector.js; js/gridlyWeatherAuthorityFoundation.js; js/gridlyWeatherAuthoritySourceIntegration.js; js/gridlyAlertsWeatherAuthorityHandoff.js |
| DriveTexas | js/gridlyDriveTexasProvider.js; js/gridlyDriveTexasLiveConnector.js; js/gridlyDriveTexasGeometryAuthority.js; js/gridlyDriveTexasAuthoritySourceIntegration.js; js/gridlyOfficialRoadwayMarkerPublication.js |
| Community reports | js/gridly-report-protocol.js; js/gridly-ugc-compliance.js; `app.js:90301` createSharedHazardReport; `58531` retrieval types; `115800` lifecycle |
| Crossings | js/gridlyCanonicalCrossingRuntime.js; js/gridlyCrossingPackageAdapter.js; data/runtime/canonical-crossing-records-v1.json; canonical-crossing-memberships-v1.json; Crossing-Packages/production-crossing-manifest.json |
| Route pipeline | `app.js:19558` OSRM; `99240` preview; `101410` start; `100602` stop; `100618` clear; js/gridly-route-publication-ownership.js |
| Route relevance | `app.js:45501` distance profile; `45648` corridor matching vicinity; `62124` hazard assessment; `78587` route source; `78619` live proximity |
| Road geometry/prototypes | assets/directional-intelligence/source/osm/*-major-roads-source.geojson; js/gridlyDirectionalRuntimeCandidatePrototype.js; js/gridlyRouteWatchGeometryShadowScoring.js; docs/doccleanup/GRIDLY-OSM-CORRIDOR-PROTOTYPE-PLANNING-PACKAGE-V676.md |
| Notification foundation | `app.js:101633` defaults; `105124` stable issue key; `105212` diagnostic builder; `120392` coming-soon Settings; tools/lp165/certify-statewide-notifications.mjs |
| Hazard taxonomy | `app.js:10178` metadata; `12256` aliases; `12310` PNG mappings; `13268` severity; `106668` road display set; js/gridlyConditionDisplayLabel.js; js/gridlyAlertSemanticContract.js |
| Service worker | service-worker.js; manifest.json; capacitor.config.json (`www` bundle) |
| Android | android/app/src/main/AndroidManifest.xml; android/app/build.gradle; android/app/src/main/java/com/gridlygo/gridly/MainActivity.kt; GridlyGeolocationPlugin.kt |
| iOS | ios/App/App/Info.plist; ios/App/App/AppDelegate.swift; ios/App/App.xcodeproj/project.pbxproj |
| Supabase | supabase/config.toml; functions/gridly-geocode; migrations/202607290200_lp1041_texas_address_foundation.sql; migrations/20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql; migrations/20260916183911_google_play_compliance_closure.sql; retention/activate-community-report-retention.sql |
| Legal/current privacy | legal/privacy.html; legal/terms.html; legal/community-guidelines.html; js/gridly-ugc-compliance.js |
| Dispatch | No standalone Dispatch application found in this checkout; future operational-sharing policy needs its owner's separate authorization model |

## Validation and audit outcome

Existing suite: **92 tests / 91 pass / 1 fail**. The single failure is LP165's deterministic protected-artifact report drift: `reports/lp165/protected-artifact-hashes.json` contains a crossing manifest hash from an earlier state. The audit's runtime files are byte-unchanged from starting HEAD. Do not regenerate LP165 hashes merely to make the test green. No behavioral test failure was observed in the selected Home/location/route/clear/weather tests; this is not a claim that all repository tests pass.

The inventory script executes only literal hazard metadata extraction and text scanning; no consumer startup, geolocation, database RPC or provider call. JSON syntax, document existence, request coverage, evidence paths and changed-path scope are checked before committing. No production/device/backend certification was attempted. Deployment and credentials remain unchanged.

## External technical references

- [Capacitor v8 native push](https://capacitorjs.com/docs/apis/push-notifications): Android/iOS setup and delivered-action boundaries.
- [Android notification runtime permission](https://developer.android.com/develop/ui/compose/notifications/notification-permission): Android 13+ permission.
- [Apple background updates](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app): background delivery is OS-managed.
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) and [PostGIS](https://supabase.com/docs/guides/database/extensions/postgis): security/spatial building blocks, not evidence of deployed notification tables.
- [OSRM route API](https://project-osrm.org/docs/v5.24.0/api/): route geometry interface already used by Gridly.
- [NWS API](https://www.weather.gov/documentation/services-web-api): official alert/point/zone acquisition basis for future route coverage.

## Verdict

**A. READY FOR IMPLEMENTATION PLANNING**

Audit complete within repository scope. Launch is not certified. The implementation plan preserves Home, portrait, no-login and awareness-first product intent; native push/backend/deep links, temporary context integration, winter parity and physical certification remain explicit launch work.
