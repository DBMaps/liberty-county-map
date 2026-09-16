# Gridly Google Play compliance package

Audit date: 2026-09-16

Branch: `LP244.32-play-console-compliance-package`

Audited base: `e0978fbf01ac314567079372061c09858c3aa034`

Application ID: `com.gridlygo.gridly`

Operator: DJ Burns Collective LLC, doing business as Gridly App

Scope: local, read-only compliance audit. No production query, database write, reporting enablement, policy publication, manifest change, or Play submission occurred.

## 1. EXECUTIVE SUMMARY

**Verdict: C — MATERIAL COMPLIANCE BLOCKER.** The Android package itself has a small, understandable permission surface, no ads SDK, no billing SDK, no account/login flow, and no background-location permission. Its release manifest and dependency graph build successfully. The blocking issues are launch-state and policy controls, not an unexplained SDK.

Gridly should not submit a launch build with community reporting enabled until all of these gates are closed:

1. Publish an owner-approved privacy policy at a stable public URL and add a working in-app link. The current policy is explicitly marked proposed/unpublished and says its own publication is blocked.
2. Deploy and certify the report protocol/retention transition, day-149 cleanup schedule, external failure monitor, backup/log/export handling, and production reporting availability. Repository tests prove a design against a disposable fixture, not production operation.
3. Add the Google Play UGC controls: affirmative Terms/user-policy acceptance before posting, clear prohibited-content rules, in-app report-content/report-user and block-user/content controls appropriate to the anonymous model, and an operational moderation/escalation process. Email-only abuse reporting is insufficient for publicly accessible UGC.
4. Make the privacy/data-deletion intake operational and tested. Do not answer that users can request deletion until the public URL, monitored mailbox, identity/record-matching procedure, response workflow, provider escalation, and evidence of completion exist.
5. Resolve the organization-account/D-U-N-S verification and supply the required public developer and store-support contacts.
6. Reconcile launch state: community reporting is part of launch but production reporting is currently disabled. Reviewers must receive the same truthful, testable state described by the listing, policy, Data Safety form, and reviewer instructions.

Current Play-facing conclusions:

- Contains ads: **NO**.
- Account creation/login: **NO**.
- Background location: **NO**.
- Foreground precise/approximate location: **YES, optional**.
- Data collected off device: **YES**.
- Data shared with third parties: **YES (conservative launch declaration)**, because coordinates/search inputs go directly to public providers and community report content is displayed to other users. Narrower service-provider/user-initiated exclusions require documented contracts and prominent disclosure not proven by this repository.
- All app-controlled transmissions encrypted in transit: **YES**, for audited configured endpoints, which are HTTPS. This is not an encryption-at-rest claim.
- User deletion request mechanism: **NO, not operationally proven today**; make it **YES** only after the launch gate is closed.
- Target audience: **Ages 16–17** and **Ages 18 and over**.

This package uses Google’s current definitions: on-device-only processing is not “collected”; pseudonymous data is still data; direct transfer to third parties is sharing unless an enumerated exclusion is actually satisfied. See [Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469), [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937), [target audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159), and [account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

## 2. ANDROID PERMISSIONS

Release configuration is `minSdk 24`, `targetSdk 36`, `versionCode 1`, `versionName 1.0.0`. Evidence: `android/app/build.gradle`, the source manifest, and `android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml` produced by `:app:processReleaseMainManifest`.

| Final permission | Source | Why present / runtime use | Core? | Play declaration | Foreground/background | Works without it? |
|---|---|---|---|---|---|---|
| `android.permission.INTERNET` | Gridly source manifest | HTTPS calls for Supabase, maps, search/geocoding, routing, weather, roadway/crossing data | Required for network-backed awareness | No special restricted-permission declaration | Not a location mode | Shell opens, but live map/data/report/search features degrade or fail |
| `android.permission.ACCESS_NETWORK_STATE` | Gridly source manifest | Connectivity-aware network behavior | Supporting, not independently user-facing | No special declaration | N/A | Yes, but network-state handling degrades |
| `android.permission.ACCESS_COARSE_LOCATION` | Gridly source manifest; requested by `GridlyGeolocationPlugin` | Approximate foreground device location | Optional local-awareness convenience | Location use must match Data Safety/privacy disclosures; no background-location declaration | Foreground only | Yes: select ZIP/town/home area, search, saved place, or tap map manually |
| `android.permission.ACCESS_FINE_LOCATION` | Gridly source manifest; requested with coarse by `GridlyGeolocationPlugin` | Precise foreground current position for “near me,” route origin, nearby/weather context, and report placement | Optional; awareness-first app remains usable without it | No background declaration. Google’s new precise-location minimum-scope declaration is scheduled for enforcement from 2027-01-27; API 37+ transactional precise location may need the Android Location Button instead of persistent fine permission | Foreground only | Yes, with manual location; exact current-location actions are unavailable |
| `com.gridlygo.gridly.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX merged manifest | Signature-only guard for non-exported dynamic receivers | Internal library hardening | No | N/A | It is package-internal, not user-granted |

Runtime proof: the custom plugin requests coarse and fine together and performs a one-shot `LocationManagerCompat.getCurrentLocation`; JS also uses a foreground `watchPosition` only while Route Watch is active and calls `clearWatch` when stopped. There is no service or background request.

Explicitly absent from the final merged manifest and dependency graph:

- `ACCESS_BACKGROUND_LOCATION`
- `POST_NOTIFICATIONS`
- camera
- microphone/audio recording
- contacts
- storage/media/photo/video permissions
- Bluetooth/nearby devices
- phone, SMS, or call-log permissions
- `AD_ID`
- billing permission
- foreground-service/location-service permissions

No Firebase, Google Play services location, AdMob, analytics, crash-reporting, or Play Billing artifact appears in `releaseRuntimeClasspath`. The package does include normal Capacitor/Cordova and AndroidX runtime libraries. Android’s foreground/background distinction is documented at [Android location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions); Play’s background-location review is not triggered because `ACCESS_BACKGROUND_LOCATION` is absent ([Play background location policy](https://support.google.com/googleplay/android-developer/answer/9799150)).

## 3. DATA SAFETY ANSWERS

Use the following as the conservative launch form. “Shared: Yes” intentionally avoids claiming a service-provider or user-initiated-transfer exclusion before contracts and prominent user disclosure are certified. If counsel/owner later documents an exclusion, change only the affected row and preserve the evidence.

| Play category / specific type | Collected | Shared | Ephemeral | Required | Purpose | Retention | Linked | TLS | Deletable today |
|---|---:|---:|---:|---|---|---|---:|---:|---:|
| Location / Precise location | Yes | Yes | No | Optional | App functionality; local awareness; routing; weather; report placement | Public report/content planned for cleanup day 149; max linkage 180 days; provider logs/caches unknown; production control not certified | Yes, to IP/request context and for reports to pseudonymous device link | Yes | No, not operationally proven |
| Location / Approximate location | Yes | Yes | No | Optional | App functionality and personalization (ZIP/area, awareness, viewport, weather, feedback context) | Feedback/provider retention unresolved; local preferences last until reset/uninstall | Potentially | Yes | No, not operationally proven |
| Personal info / Address | Yes, when entered for destination or saved-place lookup | Yes | No | Optional | App functionality (search/geocoding/routing) | Saved result is local; Edge geocode cache has freshness windows, not proven physical deletion; upstream logs unknown | Linked to request/IP; not an account | Yes | No, not operationally proven |
| App activity / In-app search history | Yes | Yes | No | Optional | App functionality | Gridly Edge stores hashed request keys and provider response caches; upstream logs unknown | Linked to request/IP, and cached response may carry request ID | Yes | No, not operationally proven |
| App activity / Other user-generated content — community reports | Yes | Yes | No | Optional | App functionality; community awareness | Intended public row and private link cleanup day 149; 180-day ceiling; aggregate month/condition/count may remain; production not certified | Yes, private pseudonymous device link; not public identity | Yes | No, not operationally proven |
| App activity / Other user-generated content — feedback | Yes | Yes, conservatively for hosted processor/email route | No | Optional | Developer communications; app functionality/support | No approved operative retention period found | Page/platform/awareness context, not account | Yes for in-app Supabase submit; external mail app transport is outside Gridly’s control | No, not operationally proven |
| App activity / App interactions | Yes | Yes, conservatively | No | Optional | App functionality and fraud/security (submit, confirm, edit, clear, cancel/retry) | Minimal replay digest intentionally survives report deletion; provider logs unknown | Pseudonymous operation/device context | Yes | Partly; security replay digest is intentionally retained and not reversible to a raw token |
| Device or other IDs / Gridly device ID and operation identifiers | Yes | Yes, conservatively | No | Optional reporting | App functionality; fraud prevention; security; idempotency | Device link intended for cleanup day 149/max 180; SHA-256 operation digest persists for replay defense | Yes, pseudonymous | Yes | Device link planned deletable; replay digest intentionally retained; not operationally proven in production |
| App info and performance / Crash logs, diagnostics, performance | No automated off-device telemetry proven | No | N/A | N/A | N/A | Local audit/performance state only; feedback can include platform/version/page but is classified above | No analytics identity | N/A | N/A |
| Personal info / Name, email, phone, account/user ID | No ordinary in-app collection proven | No | N/A | N/A | Preferred name is local only; direct feedback has no email field | Local until reset/uninstall | No account | N/A | Local reset/uninstall |
| Financial info / Payment details and purchase history | No | No | N/A | N/A | Paid-app purchase is handled by Google Play; Gridly has no BillingClient | N/A | No | N/A | N/A |
| Health and fitness, contacts, messages, photos/videos, audio, files/documents, calendar, web browsing | No | No | N/A | N/A | No implementation or permission found | N/A | No | N/A | N/A |

IP addresses are inherently exposed to Supabase and every direct HTTP provider. Code does not read an IP address or use it as a Gridly identifier. Under Google’s taxonomy, an IP may map to approximate location or Device/other IDs depending on how a recipient uses/retains it. Provider logging/use is not established locally, so the privacy policy must disclose request metadata and the owner must review provider terms before narrowing the conservative declarations.

On-device inventory, excluded from “collected” while it remains strictly on device:

| Storage | Significant keys/data | Data Safety treatment |
|---|---|---|
| `localStorage` | `gridlyHomePersonalizationV1`, `gridlyHomeTown`, `gridlyUserProfileV1`, `gridlySettingsV1`, `gridlySavedPlacesV1`, `gridlySelectedPlaceIdV1`, legacy `gridlyHome`/`gridlyWork` | Home area, ZIP/community, preferred name, preferences, saved names/addresses/coordinates. Not collected merely by local storage; the address/search becomes collected when submitted to geocoding/routing |
| `localStorage` | `gridlyDeviceId` | Local until reporting transmits it; then Device/other IDs is collected |
| `localStorage` | `gridlyPendingCommunityOperationV1` | Pending payload + UUID operation token for at most 24 hours; becomes collected when RPC begins; after expiry the client retains a token-only cancellation tombstone |
| `localStorage` | `gridlyMovementIntelligenceV1`, `gridly_commute_baseline_samples_v1`, `gridlyEventHistoryV1` and legacy history keys | Local route observations, commute samples, and event history. No off-device telemetry path proven; therefore not collected unless separately sent in a feedback/report flow |
| `localStorage` | `gridlyMapStyleV1`, `gridlySmartAlertsV1`, onboarding/walkthrough/first-hint flags, crossing review decisions, UI expansion state, `gridlyFeedbackLog` legacy local log | Preferences and UI state; on-device only |
| `sessionStorage` | location-prompt and reset guards | Session-only; on-device only |
| Cache Storage | Service-worker application shell/runtime assets | On-device cache, not user-data collection |
| IndexedDB/native Preferences | No application data schema/use found | None proven |

There is no persistent local search-history key. That does not remove the Data Safety search declaration because search text/address/context is transmitted off device.

Global form answers today:

- Does the app collect or share required user-data types? **YES**.
- Is all collected data encrypted in transit? **YES for app-controlled transport**.
- Can users request deletion? **NO today**. Change to **YES** only after Section 12 is operational and the live privacy URL describes it.
- Is collection required? The categories above are **optional** because core awareness can be used with manual area selection and without reporting/search/feedback. Network access itself remains necessary for live data.

## 4. LOCATION DISCLOSURE

Actual flow:

`ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` → `GridlyGeolocationPlugin.getCurrentPosition()` (one shot) or active foreground JS Route Watch → in-memory `userLocation` → selected feature request.

The current position is not written to localStorage as a current-location history. It can leave the device through:

- OSRM route and nearest-road endpoints: origin/destination or tap/report-candidate coordinates.
- Nominatim reverse geocoding: latitude/longitude.
- NWS point alerts/points lookup: selected point, which may be current location.
- Supabase report RPC: report event latitude/longitude when the user submits.
- Map tile providers: tile indices/viewport area plus ordinary request metadata, rather than a raw geolocation API payload.
- Gridly’s Supabase geocoding Edge Function: destination/address query and geographic context; the function may forward to configured geocoders.

Server-side storage is feature-dependent. A submitted report stores the event coordinate; geocoding response caches exist; provider logs are unknown. One-shot live location used for routing/reverse lookup is kept in memory by Gridly, but cannot be called “ephemeral” across the entire data type because providers may retain it and report coordinates persist.

If permission is denied or approximate-only, Gridly can still use ZIP/town/home area, destination search, saved places, or map-tap placement. Current-location precision may be lower or “near me” actions may be unavailable. There is no background tracking, `ACCESS_BACKGROUND_LOCATION`, location foreground service, or native watch service.

Suggested Play Console explanation:

> Gridly optionally uses foreground location to center local road, rail, weather, and community awareness; choose a nearby starting point; and place a user-confirmed community report. Location is requested only while the user is using the app. Gridly does not request background location. Users can deny permission and select a Texas area, search for a place, use a saved place, or tap the map instead.

Future requirement: before targeting Android 17/API 37, reassess whether transactional “use my location” actions can use the Android Location Button and whether continuous foreground Route Watch justifies retained `ACCESS_FINE_LOCATION`. See [Google Play’s precise foreground location policy](https://support.google.com/googleplay/android-developer/answer/17033915).

## 5. COMMUNITY REPORTING / UGC

Community reports are public UGC under Google Play policy even though the UI is structured and reporters are pseudonymous. Other users can see user-submitted condition/location content.

Current intended protocol-v2 path:

1. The user selects a crossing/hazard and confirms a coordinate/road.
2. `gridly-report-protocol.js` creates a cryptographically random UUIDv4 operation ID and saves one pending operation in `gridlyPendingCommunityOperationV1` before network transmission.
3. Create calls `submit_community_observation`; confirm/edit/clear call `mutate_community_observation`; cancellation calls the cancel RPC. Direct report-table insertion is rejected by the client boundary.
4. Submitted create fields include crossing ID/name, railroad, latitude, longitude, report type, severity, detail, confidence, and expiry. The server forces `source=user` and caps active expiry at 90 minutes.
5. The public report projection includes report ID, timestamps, crossing/road fields, coordinates, type, severity, detail, source, confidence, and expiry. It excludes device identity.
6. `report_retention.device_links` privately associates the report with the persistent `gridlyDeviceId`. `observation_receipts` holds the live-report token relationship; append-only `replay_evidence` keeps only a SHA-256 operation-token digest and first-accepted time for replay defense.
7. Intended cleanup at day 149 deletes the report and cascades the device link/receipt, inside the 180-day ceiling. Only month + broad condition/crossing count aggregation remains; the non-reversible replay digest remains.

Privacy separation is well designed locally: public consumers cannot read the private device link and the public report row carries no `device_id`. However, this is not production proof. The activation SQL says it has not been executed, external cleanup monitoring is separately required, and reporting is currently disabled.

Deletion status: an anonymous reporter has no account UI or authenticated self-service deletion. The protocol supports clear/edit/confirm operations but “clear” is not equivalent to a privacy deletion request. A working privacy request procedure must locate records using reasonably available report/device evidence without exposing or accepting forged ownership.

UGC policy gaps — launch blockers:

- No affirmative Terms/user-policy acceptance gate before creating/uploading a report was found.
- The Terms draft is not published in-app as binding report rules.
- No in-app control to report objectionable report content or a reporter was found.
- No in-app user/content blocking control was found. Because public reports expose no user identity, design an appropriate pseudonymous block/hide model and confirm it with policy counsel rather than omitting the control.
- No operational moderation queue, response SLA, escalation record, or reviewer-accessible moderation behavior is proven.
- Email contacts in a draft Terms document do not replace in-app reporting controls.

Google requires UGC apps to require acceptance of terms/user policy, define prohibited content, conduct ongoing moderation, and provide in-app reporting/blocking appropriate to the UGC model. Publicly accessible UGC carries the stronger report-user/content and block-user requirements. See [UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937) and [moderation guidance](https://support.google.com/googleplay/android-developer/answer/12923286).

## 6. THIRD-PARTY DATA FLOWS

| Provider | Actual outbound data | Precise coordinates? | Play sharing conclusion | Purpose |
|---|---|---:|---|---|
| Supabase (database, Realtime, Storage, Edge Function) | Community report fields; private device ID; operation token (stored as digest); report operations; feedback message/category/context; geocode query/context/request ID; database reads; IP/HTTP metadata | Yes, report/geocode context can contain coordinates | **Yes conservatively**. A service-provider exclusion may be supportable only after contract/processing-role documentation | Reports, feedback, geocoding boundary/cache, shared data and public assets |
| OSRM public demo server | Route origin/destination and nearest-road/report-candidate coordinates; IP/HTTP metadata | Yes | **Yes** | Routing and road snapping |
| OpenStreetMap Nominatim | Reverse-geocode coordinates directly; forward queries via Gridly Edge by default; IP/HTTP metadata | Yes | **Yes** | Reverse geocoding and search |
| NWS `api.weather.gov` | State query or selected point; points lookup; IP/HTTP metadata | Yes for point mode | **Yes** for point-derived user location; fixed state-feed download alone is not user-data sharing | Weather/local alerts |
| OpenStreetMap standard tiles | Tile z/x/y, viewport-derived area, IP/HTTP metadata | Not raw GPS, but viewport can reveal an area | **Yes conservatively** for location/request metadata | Base map |
| Esri World Imagery/labels | Tile z/x/y, viewport-derived area, optional configured token, IP/HTTP metadata | Not raw GPS, but viewport can reveal an area | **Yes conservatively** | Satellite map and labels |
| Gridly geocoding upstreams | Nominatim is default; Google Geocoding and US Census are conditional environment-configured fallbacks, not proven active | Search/address/coordinate context can be precise | **Yes** for any enabled third-party provider | Address/place search |
| Zippopotam.us | User-entered ZIP and IP/HTTP metadata | No; ZIP is approximate | **Yes** | ZIP-to-community lookup |
| DriveTexas/TxDOT endpoint | Fixed statewide conditions request + API key and IP/HTTP metadata; no user coordinate in the audited request | No | **No user-data sharing established**; inbound public-data retrieval is not itself sharing | Official roadway conditions; conditional on configured API key |
| `data.transportation.gov` | Fixed Texas/Liberty crossing query + IP/HTTP metadata | No user coordinate | **No user-data sharing established** | FRA crossing fallback inventory |
| External email app/provider | If user chooses email fallback: feedback category/message, awareness area, platform, timestamp, and sender metadata | Area may be approximate | **Yes**, user-initiated but transport/retention is controlled by the mail provider | Support fallback |

No analytics SDK, crash SDK, advertising/tracking SDK, Firebase, Google location SDK, or Google Play services dependency was found. The production Android assets bundle Leaflet and the Supabase browser client locally (`www/vendor` copied byte-for-byte into Android assets); the native package does not load unpkg/jsDelivr at startup. The repository-root web build does use unpkg/jsDelivr, which matters to the web deployment but not this audited Android package.

Every remote provider inherently receives IP and normal HTTP/TLS metadata. Provider retention, secondary use, subprocessors, and deletion are not proven by source code. Complete vendor/terms review before changing any “shared” answer to No.

## 7. ADS

**Play Console answer: Contains ads — NO.**

Searches of source, packaged Android assets, Gradle, the final merged manifest, and runtime dependencies found no AdMob/Google Mobile Ads, mediation, banner/interstitial/rewarded implementation, advertising ID permission, Facebook Audience Network, AppLovin, Unity Ads, or other advertising/tracking SDK. No house-ad surface was identified. If any ad or cross-promotion is added, revisit both this declaration and Data Safety before release.

## 8. APP ACCESS

**Play answer: All functionality is available without special access — YES, with a launch-state reviewer note.** Gridly has no user account, login, membership, subscription, paywall inside the app, or special credentials. A paid Play listing is a store purchase, not an in-app subscription/access credential. No Play Billing implementation exists.

Reviewer instructions:

> Gridly requires no login or account. Launch the app, complete or skip setup, and select a supported Texas ZIP/community manually. Location permission is optional: deny it to verify manual area/search/map selection, or grant foreground location to test “near me” behavior. Internet access is required for live providers. Community reporting is controlled by a server availability flag and is currently disabled for all users during pre-launch; the UI should show reporting unavailable rather than claim success. No reviewer credential bypass exists.

Review risk: community reporting is declared as a launch feature but is disabled today. Do not submit a listing/policy that promises working UGC while the reviewed build cannot exercise it, and do not silently enable it before retention, moderation, legal, deletion, and monitoring gates close. Coordinate one truthful reviewable launch state.

Google requires access details when features are restricted by credentials, memberships, location, or other authentication ([App access guidance](https://support.google.com/googleplay/android-developer/answer/9859455)).

## 9. TARGET AUDIENCE

Owner decision “age 16+” maps to exactly:

- **Ages 16–17**
- **Ages 18 and over**

Do not select Ages 13–15 or any younger group for reach. Do not select only 18+ because that contradicts the 16+ product decision. Google notes 16–17-year-olds may be children under some local laws; owner/counsel must assess minor privacy, UGC safety, and consent duties for the US launch.

**Families Policy answer for the stated Texas-focused 16+ launch: not a child-directed/Families app.** Do not enroll or select younger groups merely for availability. This is not a claim that every 16–17-year-old is legally an adult: Google warns that this group may be considered children in some locales. The owner must still assess minor privacy, UGC safety, and consent duties and must revisit the answer before adding territories or child-directed design. Google may review whether the declared audience matches the product. See [target audience guidance](https://support.google.com/googleplay/android-developer/answer/9867159).

## 10. CONTENT RATING

Proposed IARC answers based on the current content; the final rating is assigned by IARC/Play Console and must not be preclaimed:

| Topic | Proposed answer | Basis |
|---|---|---|
| Violence | No developer-created violence | “Crash/wreck,” blocked road, and hazard category labels describe traffic conditions; no depiction of injury, gore, or violent act |
| Fear/horror | No | No frightening imagery/theme identified |
| Sexual content/nudity | No | None identified |
| Language | No in developer-created content | Public UGC is not fully moderated, so disclose online content/UGC accurately; do not promise users cannot submit objectionable text |
| Drugs/alcohol/tobacco | No | None identified |
| Gambling | No | None identified |
| User-generated content/content exchange | Yes | Community condition reports are created by users and displayed to others |
| Fully moderated UGC | No | No pre-publication filter or operational moderation system is proven |
| Online interaction/communication | Yes for content exchange; no direct messaging/chat | Users affect shared public reports but cannot privately message each other |
| Location sharing | Yes, conservatively | A user-confirmed report coordinate is displayed publicly; it is an event location, not continuous person tracking |
| Unrestricted internet | No | The app calls fixed providers and does not expose an unrestricted browser |
| Sharing personal information | No as a designed feature | Public reports do not solicit name/email/phone and device identity is private; Terms must prohibit entering personal information in details |

Answer “Yes” to online content exchange where asked ([content exchange guidance](https://support.google.com/googleplay/android-developer/answer/7021383)). Do not answer that content is fully moderated; reactive reporting alone would not establish that status ([fully moderated guidance](https://support.google.com/googleplay/android-developer/answer/6161095)).

## 11. PRIVACY POLICY GAP CHECK

Reviewed: `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md`.

**Publish as-is: NO.** The document itself says “PROPOSED FOR OWNER REVIEW — NOT APPROVED OR PUBLISHED” and “PUBLICATION BLOCKED.” Those are accurate warnings and cannot appear as a claim that a launch policy is operative.

Accurate strengths:

- Names the operator and product.
- Discloses no ordinary account/payment flow.
- Covers foreground location, search/geocoding, reports, persistent device linkage, saved local data, feedback, IP/request metadata, no ads/sale, relevant provider families, a 16+ posture, and HTTPS transport.
- Distinguishes report content from a private message and acknowledges provider-controlled retention uncertainty.

Launch-blocking edits/decisions:

1. Remove draft/publication-block banners only after owner/legal approval and operational certification; set a real effective date/version.
2. Publish at a stable HTTPS URL accessible without login, add the URL to Play Console, and add an actual in-app Privacy link. Current Settings copy says “Privacy” but no working policy link was found.
3. State the final launch reporting status and deployed retention behavior. Do not present day-149/180 controls as operative until deployed, scheduled, monitored, and recovery/log/backup behavior is certified.
4. Define feedback, correspondence, privacy-request, logs, geocode cache, provider, and backup retention or clearly state the operational rules. Cache freshness is not deletion.
5. Clarify that device linkage is private and absent from the public report projection under protocol v2.
6. Add explicit native-provider detail for OSRM, Nominatim, NWS point calls, OSM/Esri tiles, Zippopotam, conditional geocoders, and ordinary IP/HTTP metadata; the Android package bundles its JS libraries locally.
7. Describe public UGC moderation/report/block controls and prohibited-content rules after they exist.
8. Describe the tested deletion-request method, verification/matching limits for pseudonymous reports, exceptions for aggregate/security replay evidence, and provider/backups handling.
9. Ensure the published contacts are monitored and consistent with Play’s developer/store records. The feedback email fallback currently targets an owner Gmail address while policy contacts use Gridly domains; approve and document that path or change it in a separately authorized task.

Anything not yet proven should remain qualified. Do not claim encryption at rest, provider deletion periods, production cleanup operation, or anonymous data merely because IDs are pseudonymous.

## 12. DATA DELETION

Gridly does not support account creation or a user-facing authenticated identity. Reports are associated with a local pseudonymous device ID, not an account. Therefore Google’s account-deletion URL requirement is **not applicable** unless an account-creation feature is later added. All developers still answer the Data Safety deletion question.

Truthful current answer:

> Gridly does not create consumer accounts. Community reports use a pseudonymous device association that is not displayed publicly. A repository design schedules report and device-link cleanup at day 149, inside a 180-day ceiling, but production deployment and the privacy-request process have not been certified. Users cannot yet be promised an operational deletion mechanism.

Required launch language after the gate closes:

> Gridly does not require an account. To request deletion of information you submitted, contact privacy@gridlygo.com and provide the approximate date, location, report type, and any report reference available on your device. We may request limited additional information to locate the record and prevent fraudulent deletion. We delete or de-identify eligible Gridly-controlled records subject to legal, security, backup, and provider limitations explained in the Privacy Policy. Public reports and their private device links are automatically scheduled for cleanup by day 149 and never later than 180 days from original submission. Minimal non-reversible replay-security evidence and aggregate month/condition/count statistics may remain.

Before using that language, prove the mailbox works, define owner/SLA/escalation and identity-matching rules, test a report and feedback deletion end-to-end, document denials/exceptions, and publish the policy. Then answer Data Safety “Can users request deletion?” **YES**. See [Google account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111).

## 13. SECURITY CLAIMS

Safe claims:

- App-controlled remote endpoints audited in the Android package use HTTPS/TLS.
- Supabase client traffic uses the project’s HTTPS/WSS service boundary.
- Android `allowBackup=false` is configured.
- Protocol-v2 public report projections exclude `device_id`; device links and receipts are private schema data with ordinary-client access denied by the tested fixture.
- Operation IDs are UUIDv4; the persistent replay ledger stores a SHA-256 digest, not the raw token.
- One pending operation is persisted before sending, retries reuse the same identity, and terminal outcomes clear the payload.
- Local SQL/tests enforce original-time retention, day-149 cleanup, the 180-day ceiling, private-link separation, idempotency, failure visibility, and minimal aggregate history.
- Known-disabled reporting blocks new guarded writes before protocol begin.

Claims that are **not** safe today:

- “All data is encrypted at rest.” No complete Supabase/provider/device encryption-at-rest evidence was audited.
- “Production reports are deleted at day 149.” The migration, cron activation, external monitor, backup/log/export rules, and production execution are not proven.
- “All providers delete coordinates/searches on request” or within a particular time. Provider retention is unknown.
- “Anonymous.” A persistent device ID and request metadata are pseudonymous/linkable.
- “No third party collects data.” Direct providers receive request parameters and IP/HTTP metadata.
- “No data loss/recovery exposure.” Recovery and backups require separate operational certification.

Security follow-ups: deploy only the reviewed migration batch with owner authorization; activate cleanup and independent monitoring; validate public/private grants in production; inventory Supabase backups/logs/exports and provider terms; pin/bundle web-deployment dependencies; rotate/limit provider keys; and rerun a final AAB dependency/manifest scan. No service-role secret is embedded in the audited Android client; only a public Supabase client credential is expected there.

## 14. PLAY CONSOLE ANSWER SHEET

| Question / section | Recommended answer | Why | Evidence | Owner action needed |
|---|---|---|---|---|
| Privacy policy URL | Not ready | Current file is proposed/unpublished; no working in-app link found | `docs/LEGAL/GRIDLY-PRIVACY-POLICY.md`; Settings renderer in packaged `js/app.js` | Approve, publish HTTPS URL, add in app and Console |
| Contains ads | **No** | No advertising implementation | Source/packaged search; merged manifest; Gradle dependency graph | Reconfirm against final AAB |
| App access | **All functionality available without special access** | No login/account/subscription/credentials | No auth calls/dependencies; public Supabase client; no BillingClient | Paste reviewer instructions; coordinate reporting launch state |
| Data collection/sharing | **Yes** | Location, searches/addresses, UGC/feedback, app operations, device/operation IDs leave device | Packaged `js/app.js`, `gridly-geocoding-client.js`, `gridly-report-protocol.js`, Supabase migrations | Enter Section 3 rows; retain conservative sharing until vendor review |
| Encrypted in transit | **Yes** | Audited app-controlled endpoints use HTTPS/WSS | URL inventory in packaged JS and Supabase client configuration | Do not translate this into at-rest claim |
| Deletion request | **No today; Yes after gate** | Draft email process is not operationally certified | Privacy draft publication banner; no self-service/account workflow | Operationalize and test; then submit Yes |
| Account deletion URL | **Not applicable** | No account creation/authenticated identity | No sign-up/sign-in/auth implementation | Revisit if accounts are added |
| Ads/ID declaration | **No ads; no Advertising ID** | No SDK or permission | Final manifest and `releaseRuntimeClasspath` | None beyond final scan |
| Target audience | **16–17; 18+** | Owner’s 16+ decision | Owner authorization; Play age-group mapping | Validate US minor/UGC/privacy posture |
| Designed for children / Families | **No** | Texas-focused 16+ awareness utility, not child-directed | Product decision and UI/content review | Avoid child-directed listing/creative; revisit for new territories |
| UGC | **Yes** | Public community reports | Report submission/read paths and public report projection | Add Terms acceptance, in-app report/block, moderation |
| Content fully moderated | **No** | No pre-publication moderation/filter proven | No runtime moderation/report/block controls found | Do not overclaim |
| Online interaction/content exchange | **Yes** | User reports are displayed to others; there is no chat | Community report RPC and public map display | Answer IARC precisely |
| Precise/approximate location | **Collected and shared; optional; app functionality** | Foreground plugin and remote feature requests | Source manifest; `GridlyGeolocationPlugin.kt`; OSRM/Nominatim/NWS/Supabase calls | Use Section 4 disclosure; review API 37 policy later |
| Background location | **No** | Permission/service absent | Final merged manifest and source/runtime scan | None |
| Permissions declaration | Foreground coarse/fine only; no restricted background permission | Location powers optional awareness convenience | Final merged manifest and plugin | Explain core/optional use if Console asks |
| News app | **No** | Road/weather/community awareness utility, not news publishing | Product/runtime content review | None |
| Government app | **No** | Public-agency data does not make Gridly a government app | Legal owner is DJ Burns Collective LLC | Do not imply government affiliation |
| Financial features | **No** | No banking, trading, lending, crypto, wallet, or billing feature | Package/dependency/source scan | Set paid-app price through Play only |
| Health features | **No** | No health/medical/fitness feature or data | Permission/source/data inventory | None |
| App category | **Maps & Navigation** or **Travel & Local**; owner choice | Location-aware road/rail/weather/community awareness; not turn-by-turn | Product behavior and store taxonomy | Choose one consistent with listing; “Maps & Navigation” is the best functional fit, “Travel & Local” if positioning fits better |
| Store support email | Required | Google requires an app support email | Google store setup guidance | Use and monitor `support@gridlygo.com` after verification |
| Store website/phone | Website/phone recommended for listing; organization developer phone is separately required/public | User and organization contact requirements differ | Google account/store-contact guidance | Supply stable website and public business number |
| Organization developer profile | Organization | DJ Burns Collective LLC is the legal owner | Owner decision; Google organization-account requirements | Complete D-U-N-S, payments, identity/document, website, public contact verification |

Organization account facts: Google requires a D-U-N-S number, organization name/address, phone, website, contact name/email/phone, and public developer email/phone; legal name/address, developer email, and developer phone are displayed. Verification can take time. See [required account information](https://support.google.com/googleplay/android-developer/answer/13628312), [identity verification](https://support.google.com/googleplay/android-developer/answer/10841920), and [store contact details](https://support.google.com/googleplay/android-developer/answer/9859152).

## 15. LAUNCH BLOCKERS

### READY NOW

- Application ID/version/target SDK are identifiable.
- Release merged-manifest and dependency inventory is reproducible.
- Permission explanation, ads answer, no-account answer, target ages, provider inventory, location narrative, and conservative Data Safety worksheet are ready.
- Local protocol/retention/reporting-availability tests pass against a disposable PostgreSQL 17 fixture.
- Native Android assets match the staged `www` authorities for audited key files.

### NEEDS OWNER INPUT

- Approve final privacy policy and Terms/user policy.
- Choose final Play category and approve listing claims.
- Provide/approve public legal address, organization/developer phone, developer email, support email, website, and internal Google contact details.
- Approve vendor/controller/service-provider classifications and provider terms.
- Assign moderation, privacy-request, security-monitoring, and support owners with SLAs.
- Decide exact launch/reporting review window and whether UGC is enabled for the reviewed release.

### NEEDS TECHNICAL CHANGE

- Add affirmative Terms/user-policy acceptance before report creation.
- Add in-app report-content/report-user and block/hide controls plus moderation backend/operations.
- Add working in-app Privacy and Terms links.
- Deploy/certify protocol v2, cleanup cron, external monitor, production grants, and backup/log/export posture; enable reporting only after gates pass.
- Implement/test privacy deletion intake and record-matching workflow.
- Complete a final signed AAB permission/SDK scan and Play pre-launch report.
- Before target API 37, rework/rejustify precise foreground permission under the new minimum-scope policy.

### WAITING ON D&B / GOOGLE

- No repository evidence proves a D-U-N-S number, matching D&B organization record, verified Play organization profile, linked payments profile, website verification, or public developer contacts.
- Complete D&B corrections first if legal name/address differ; Google says organization records must match.
- Wait for Google identity/document/phone/email/website verification and create the draft app record before relying on Console-specific screenshots or question variants.

## 16. TEST RESULTS

No production credentials or non-loopback database were used.

| Check | Result |
|---|---|
| `android\gradlew.bat :app:processReleaseMainManifest :app:dependencies --configuration releaseRuntimeClasspath` | PASS; release manifest and dependency graph produced |
| `tests/lp24421-report-retention.test.cjs` on disposable PostgreSQL 17 port 55941 | 14/14 PASS |
| `tests/lp24421-submission-protocol.test.cjs` on disposable PostgreSQL 17 port 55941 | 13/13 PASS |
| `tests/lp24429a-reporting-availability.test.cjs` on disposable PostgreSQL 17 port 55941 | 11/11 PASS |
| Android launch/physical polish + LP184.1B privacy mapping | 18/18 PASS |
| Key packaged asset SHA-256 comparisons (`www` vs Android `assets/public`) | PASS for `index.html`, `js/app.js`, and `js/gridly-report-protocol.js` |
| Broad combined suite | 20 pass / 77 fail on first run because the expected local PostgreSQL listener at 55441 was absent; not a product result |
| Retried mixed DB suite | Relevant env-aware tests passed; 25 harness failures remained because two older suites hard-code port 55441, parallel database suites contend on a cluster-global role, and one encrypted-export test cannot set Windows ACLs under the restricted token |
| LP184.1A deterministic verification | One existing generated summary mismatch (`lp1841a-summary.json`); the current LP184.1B mapping tests pass. Regenerate/review LP184.1A in a separately authorized artifact update rather than treating stale generated evidence as current |

The passing tests establish local implementation behavior only. They do not establish production migration state, scheduler execution, provider retention, policy publication, Play declarations, or moderation operations.

## 17. FILES CHANGED

- Added `docs/launch/GRIDLY-GOOGLE-PLAY-COMPLIANCE-PACKAGE.md`.
- No app source, Android manifest/Gradle file, Supabase migration, legal policy, runtime configuration, or generated package asset was intentionally changed.
- Pre-existing untracked `output/` was not touched or staged.

## 18. COMMIT / PUSH

Planned commit: `Prepare Google Play compliance package`

Planned branch push: `LP244.32-play-console-compliance-package`

The final handoff records the actual commit hash and push result after this document is verified.

## 19. PRODUCTION SAFETY

- No production Supabase read or write occurred.
- Reporting was not enabled.
- No migration, retention activation, cron job, monitor, secret, or provider configuration was applied.
- No app behavior, permission, manifest, dependency, policy publication, store listing, Play Console record, or release track was changed.
- Tests used local files and a disposable loopback PostgreSQL 17 cluster, which was stopped after testing.
- No merge to `main` was performed.

## 20. FINAL VERDICT

**C. MATERIAL COMPLIANCE BLOCKER**

The answer package is factually usable, but the app is not ready for Google Play launch submission with community reporting. The blocking path is explicit: publish accurate legal documents and links; implement Play-required UGC acceptance/report/block/moderation controls; deploy and monitor retention/reporting safely; operationalize deletion; complete organization verification/contacts; then align the final AAB, listing, reviewer state, and Data Safety answers. Re-audit the signed AAB and live launch configuration after those actions.
