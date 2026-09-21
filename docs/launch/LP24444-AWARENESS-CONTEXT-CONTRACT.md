# LP244.44 — Awareness context contract

Contract `LP24444.v1`, planning only, baseline `0b8a5914cf69dcbc9f658b860d8d8cd9a2f57467`. MUST/SHALL are future implementation requirements. Enumerations/defaults are owned by [launch contracts](../../reports/lp24444-launch-contracts.json); this document owns context resolution. LP244.43 evidence: [travel model](LP24443-TRAVEL-CONTEXT-MODEL.md), especially js/app.js:18600, 46335, 48524, 48555, 54444 and 87497.

## CTX-01 — One visible owner, independent watches

Frozen contexts: HOME, SEARCH, AROUND_ME, ROUTE_WATCH, NONE. HOME is persistent, SEARCH and AROUND_ME are ephemeral, ROUTE_WATCH is explicit/bounded. NONE represents absent/default/unavailable selection; it is not an undisclosed Home alias. There is no separate DEFAULT enum.

The latest **explicit valid transition** wins visible context. An ACTIVE watch does not outrank a later Search; its server subscription continues independently until stopped/paused/expired. Bootstrap may restore a validated Home once. After that, no consumer may independently fall back to Home when the selected context lacks data, expires or cannot resolve. A failed temporary context remains labeled unavailable with an explicit Return Home action. Home chooser confirmation is the only action authorized to mutate Home keys.

Resolution is a pure read of the published snapshot, never an opportunistic getter that saves or substitutes identity. Async fetch keys contain contextId + generation + geometry version + source family; late results for Crosby cannot publish into Beaumont or Home. Changing context immediately switches all labels and clears prior-context active claims; each family then renders loading, fresh, stale or unavailable under the same generation. Atomic ownership does not require waiting for every source to finish. No mixed Home weather beneath a Search label.

## CTX-02 — Exact snapshot payload

All fields below are required, with explicit nullability. UTC timestamps use ISO-8601; IDs are opaque bounded strings (128 characters max), names plain text <=120 characters. Coordinates are finite WGS84 degrees; lat/lng must both exist or both be null. Arrays are deduplicated/sorted; no prototype-bearing payloads or arbitrary URLs.

| Field | Type / invariant |
|---|---|
| v | integer 1 |
| contextId | UUIDv4 per explicit selection; never a user/device ID |
| generation | monotonically increasing in-session integer; async publication guard |
| contextType | frozen enum above |
| identityKind | NONE / CANONICAL_PLACE / GOVERNED_LOCALITY / COORDINATE / ROUTE |
| placeId | canonical PLACE GEOID as string, or governed locality ID; null for unresolved coordinates/route overview |
| placeName | authoritative consumer name, or “Current area” / “Selected location” / “Trip”; no nearest-city invention |
| countyId | validated operational county ID or null; never assumed from first membership |
| countyMemberships | array of governed Texas county FIPS strings; empty if not yet known |
| qualification | {state: RESOLVED or AMBIGUOUS or UNRESOLVED, membershipSource, operationalCountySource}; source strings/null bounded to 64 chars |
| lat, lng | focus/observation point or null; not necessarily user's current location |
| geometryRef | null or {id,version,kind}; resolved only through owned geometry store, not caller URL |
| geometryPrecision | UNKNOWN / POINT / LINE / POLYGON / ROAD_SEGMENT / PLACE_ONLY / COUNTY_ONLY |
| source | HOME_RESTORE / HOME_SELECTION / SEARCH_SELECTION / USER_LOCATION / ROUTE_SELECTION / NOTIFICATION_TAP / EXPLICIT_MAP_INSPECTION |
| selectedAt | selection time, not measurement timestamp |
| expiresAt | null for HOME/SEARCH/NONE; Around Me position expiry; route watch expiry |
| routeWatchId | UUID only for an installation-owned server watch; null for other contexts and a local-only trip without push consent. Local trip geometry/session association stays in the in-memory context/geometry store and cannot authorize a server watch read |
| position | null except current-position evidence: {latitude,longitude,accuracyMeters,capturedAt,receivedAt,provider}; measurement timestamp required for fresh claims |
| health | {state: LOADING/FRESH/STALE/UNAVAILABLE,reason}; source-family freshness is separately recorded, not hidden by context FRESH |

HOME snapshots contain governed identity and presentation focus, not a residence GPS address. A canonical PLACE can span counties: identity remains one GEOID; each consumer queries all validated memberships and deduplicates event IDs. If an operational county is necessary and unproven, require qualification before operational action; do not silently use prior Home county. A resolved POI point may have a community containment result, but the community polygon must not erase the POI's precise destination identity.

## CTX-03 — Consumer precedence table

Each row receives the same selected snapshot. These are scope adapters, not competing precedence rules.

| Consumer | HOME / SEARCH / AROUND_ME | ROUTE_WATCH | NONE or unavailable |
|---|---|---|---|
| Location Context | Selected identity, provenance and freshness | Trip origin → destination, watch state and static/moving qualifier | Explicit selection/unavailable prompt |
| Weather summary | Selected governed focus or explicitly requested current/selected coordinate; never hidden Home weather | Label origin/destination forecast separately; no invented single route forecast | No local weather claim |
| NWS Alerts | Full official geometry against selected PLACE/point; point scope labeled | Official alert geometry vs known corridor | Unknown/unavailable |
| DriveTexas | Full source geometry vs selected area | Full corridor/source-geometry matching | No local-road count claim |
| Community reports | Same selected locality or bounded coordinate context | Independent route report source, no mutation of local awareness arrays | No active claim from old selection |
| Crossings | Canonical location inventory in selected scope | Route intersections + qualified reported conditions | Prompt/no relevance claim |
| Nearby Places | Existing governed POI scope for selection | Destination-scoped list explicitly labeled; not all POIs along route | No invented nearby list |
| KBYG / Travel Brief | One context, source-family freshness and authority | Trip brief with static vs moving evidence | Explain missing context/data |
| Map focus | User action owns camera; do not recenter on source refresh | Fit geometry only on explicit open/show route; user pan remains respected | Neutral overview, no implied local authority |
| Notifications | **Not driven by visible context**; explicitly opted-in HOME watch continues while inspecting elsewhere | ACTIVE server watch evaluated independently | Existing subscriptions remain explicit; NONE creates none |

Weather for Around Me requires a future adapter into point acquisition; existing `gridlyResolveGovernedWeatherPoint` refuses arbitrary points. Do not weaken that global Home validator and assume every source automatically follows. Preserve governed geometry validation for Home and add a separate explicit request-authority contract. Location Context and KBYG receive unavailable weather until their matching request completes.

## CTX-04 — Destination Quick Check

Entry is the existing search UI, `gridlyAddressSearchInput` → canonical token/PLACE/POI resolution → `selectGridlySearchResult`. Reuse search governance and marker logic; separate inspection from route preview.

1. User chooses resolved Crosby: create SEARCH snapshot and publish immediately; all nine visible consumers bind to its generation. Home storage bytes remain Cleveland. No Settings or route activation required.
2. Selecting a new result replaces the current ephemeral snapshot; retain one previous snapshot in memory for Back. Neither result is a server subscription. Invalid/unresolved input leaves current selection intact and displays result-specific failure.
3. Clear/Search reset is an **explicit Return Home transition**, or NONE if no valid Home exists. Back returns the one previous valid snapshot; if it expired, show its unavailable state with Return Home. Repeated Back does not create an unbounded location history.
4. Home action selects stored Home without writing it. Changing Home itself still requires the existing explicit chooser/confirmation. Closing a panel does not clear context; clearing does. Process restart discards SEARCH history and restores valid Home/NONE unless a user-authorized push tap requests a temporary target.
5. Multi-county PLACE keeps all memberships and canonical identity. Ambiguous same-name places show county-qualified choices. No silent county selection. A POI uses the exact point for destination and point-local awareness; optional canonical community is supplementary, derived by containment. Outside a PLACE: “Selected location” plus known county, not county-wide replacement.
6. Explicit Save uses existing saved-place governance; it does not convert Search into Home. Optional “Watch this place” is a separate SHOULD HAVE subscription feature, disabled until its own implementation/consent exists.

## CTX-05 — Around Me

Freeze option **A: foreground-only** for launch. No server AROUND_ME subscription, background geofence, location timer while suspended, or background-near-me push. Settings describes “Around Me — while the app is open”; do not ship a switch that implies background delivery. Foreground in-app awareness is mandatory.

Existing map location control gains the clear Around Me entry. On explicit tap, request foreground permission/fix through one provider adapter for Android/iOS/browser. Existing Android report one-shot plugin is reusable but other paths currently use browser APIs; unify them later and supply original fix timestamp/accuracy. Requested browser maximumAge <=60 seconds and existing 10-second acquisition timeout are starting behavior, not proof native options are enforced. A fix is current only when `now - capturedAt <=120 seconds`; reject future/invalid timestamps. If source timestamp is unavailable, do not call a cached coordinate fresh solely because its callback arrived now.

Resolve county and PLACE using governed geometry. If the position accuracy envelope straddles boundaries, keep COORDINATE identity with uncertainty/known memberships rather than forcing a nearby city. Approximate location may still support explicitly approximate area awareness; fine-grained roadway claims require route/event precision gates. PLACE failure is not location failure: render coordinate-area awareness where supported and mark missing locality. A result outside supported Texas coverage says so; no nearest Texas fallback.

On expiry mark AROUND_ME STALE, stop “right now” claims, and offer Refresh location. On denial/revocation remove current-position authority, retain Home untouched, and offer Search/Return Home. On timeout/unavailable distinguish from denied; no repeated permission prompts. Network failure keeps local coordinate/PLACE/crossing information if valid, source panels unavailable or visibly dated. Re-entry/resume needs fresh measurement; foreground awareness may refresh only while the user is in that mode, with one listener and no persisted samples. Suspended app never pretends current position is updating.

## CTX-06 — Persistence/privacy and migration invariants

No Around Me or Search input may write `gridlyHomePersonalizationV1`, `gridlyHomeTown`, `gridlySettingsV1` Home fields or `gridlyUserProfileV1` Home fields. Existing route/saved-place keys remain separately owned. Also prevent ephemeral location from being appended to `gridlyMovementIntelligenceV1` or commute baseline samples: LP244.43 found those can contain endpoint information. Do not repurpose them as an Around Me history store.

Coordinates can be transmitted only for the active user request to required routing/weather/geocode services; keep URLs/request bodies out of debug/crash analytics, never route them to advertisers. This is not a claim that providers retain nothing. Around Me is memory-only, cleared on mode exit/expiry/process loss; no upload of position history. Any Back snapshot for an exited Around Me retains only its unavailable label/context type, not coordinates, position or precise geometry; returning requires a new explicit fix. A future persistence change must add purpose, explicit consent where appropriate, bounded retention, deletion across caches/backups and platform disclosure review before activation. That change is outside this freeze.

Future implementation order: introduce publisher/adapters behind compatibility bridge; audit every direct `getGridlySelectedAwarenessArea` call; migrate source/model owners before UI consumers; leave Home storage validation intact. Acceptance: Cleveland/Crosby/Beaumont transitions, late NWS response suppression, multi-county ambiguity, Around Me expiry without Home fallback, active route + temporary Search, and restart all preserve Home bytes. Contract tests must fail if any consumer silently substitutes Home.
