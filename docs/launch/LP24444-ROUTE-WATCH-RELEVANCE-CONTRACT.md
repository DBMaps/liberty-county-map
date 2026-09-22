# LP244.44 — Route Watch and relevance contract

Contract `LP24444.v1`; documentation only. [Launch defaults](../../reports/lp24444-launch-contracts.json) and [LP244.43 route evidence](LP24443-TRAVEL-CONTEXT-MODEL.md) are inputs. Existing OSRM/start/stop/hydration/proximity code is a foundation, not certified background travel behavior. This contract supersedes optional LP244.43 threshold suggestions; no unvalidated 10-mile lookahead or 200m relevance rule is silently adopted.

## ROUTE-01 — Product and session

Route Watch is an explicit trip with origin, destination and validated real road geometry. No turn instructions, automatic reroute, navigation ETA, guaranteed safe road, emergency route or live train detection. User selects origin/current position and destination, reviews corridor, and explicitly activates. A route preview alone does not subscribe. At most one ACTIVE/PAUSED watch per installation; replacing it requires explicit confirmation and terminates the former watch in the same backend transaction.

Required session fields: watchId UUID, installation owner (private), generation/revision, state, origin/destination bounded identity references, geometryId/hash/version/provider/fetchedAt, startedAt, expiresAt, lastEvaluatedAt, latestEvaluation {mode, sourceHealth, relevanceState}, surfacedEventKeys (local ephemeral) and delivered event/revision keys (private dedupe table). Route origin is immutable for the session; live foreground position refines relevance without moving it. Server stores no moving position/progress for launch. Device persists only watchId/expiry/state/generation/geometryHash/pendingStopOrPause in protected local storage, not raw route endpoints/geometry/history.

## ROUTE-02 — State transitions and expiry

| From | Trigger | To / side effects |
|---|---|---|
| INACTIVE | Explicit configure | CONFIGURING; no watch send eligibility |
| CONFIGURING | Valid geometry + explicit activation + accepted server/local state | ACTIVE; assign immutable expiry and new generation |
| CONFIGURING | Cancel or geometry failure | CANCELLED or remain CONFIGURING with unavailable status; never ACTIVE without geometry |
| ACTIVE | Pause | PAUSED; cancel unsent route-only candidates and stop foreground location watch |
| PAUSED | Explicit resume before expiry | ACTIVE, new generation; revalidate sources/geometry and request fresh foreground fix if desired |
| ACTIVE/PAUSED | Stop | CANCELLED; revoke eligibility, purge sensitive route data |
| ACTIVE/PAUSED | User confirms arrival/completion | COMPLETED; same revocation/purge |
| ACTIVE/PAUSED | Clock reaches expiresAt | EXPIRED without client wakeup; same revocation/purge |
| Terminal state | New trip action | New CONFIGURING session/ID; terminal session never reactivated |

Exact default lifetime: if valid provider duration exists, `min(12h, max(1h, 2 × duration + 30min))`; otherwise 4h. Duration is used only for internal watch expiry, not navigation ETA. User sees expiry before activation and may choose a shorter lifetime. Absolute limit is 12h from activation, no sliding extension on refresh, pause, update, restart or confirmations. Longer travel requires a new explicit watch. These are frozen configurable engineering defaults, not measured arrival predictions.

Foreground inactivity/fix age >120s degrades to static-corridor evaluation; it does not infer arrival or stop a legitimate suspended trip. Background does not depend on heartbeat to stay ACTIVE until the bounded expiry. Location near destination may suggest “End this trip?” but only confirmation completes; a highway pass near destination or one inaccurate fix cannot end it. Restart restores descriptor as awaiting reconciliation, fetches owned server watch, handles expiry/terminal status, and never labels old GPS fresh. Offline restart cannot recover missing geometry as if current; retain “Reconnect to restore trip”.

Stop/pause is immediate locally; send idempotent server mutation. Offline copy must say “Stopped on this device. Server alerts may continue until cancellation is confirmed or the watch expires.” Persist only the pending cancellation descriptor and retry on reconnect. A locally stopped watch cannot restart from stale server data. Server revocation cancels unsent entries; already in-flight/provider-held alerts cannot be recalled reliably. Terminal access denial is immediate; physical sensitive purge <=15min under backend contract.

## ROUTE-03 — Routing boundary, capacity and privacy

Retain OSRM-compatible driving geometry; current js/app.js:19558 points to public router.project-osrm.org. Future native consumers call a narrow Gridly routing boundary that accepts validated origin/destination, not arbitrary upstream URLs. The boundary provides request caps and credentials/configuration isolation; it must not log endpoint payloads. Provider endpoint is deployment configuration, not embedded limitless public infrastructure.

Request: `{v:1,requestId,origin:{lat,lng},destination:{lat,lng}}`; reject nonfinite/out-of-range values, unsupported Texas scope, same endpoint and excessive body. Upstream uses `[lng,lat];[lng,lat]`, overview=full, geometries=geojson, alternatives=false, steps=false. Response contract: `{v,requestId,provider,geometry:{type:'LineString',coordinates},distanceMeters,durationSeconds?,fetchedAt,geometryHash,coverageStatus}`. Verify success code, >=2 valid vertices, coordinate order, finite positive distances, endpoint correspondence, geometry continuity, bounds, no straight-line fabrication and <=10,000 vertices/64KiB request body for subsequent watch creation. Oversized geometry is rejected or refetched at an approved provider resolution; never truncate it or silently invent a line.

Geometry can be reused only for the same explicit endpoint pair for <=15min when activating/resuming, and only if provider/coverage validation remains valid. A resume after that window must reacquire and validate the same corridor; if its geometry materially changes, offer an explicit new session instead of changing the old one in place. For an already ACTIVE watch the known geometry is a static chosen corridor until session expiry; fetchedAt is visible, and it is not a current traffic-aware route. Changing destination/geometry starts a new session; no automatic reroute when a hazard appears. Routing cache is per trip, transient and private; provider terms may require a shorter cache. No historical route database.

The existing saved inline entry rejects endpoint distance >80 miles (`js/app.js:101524`); the destination-preview path has a statewide geometry bridge. Freeze target policy as the same validated Texas-route boundary for both entry points, replacing the legacy arbitrary entry-specific 80-mile guard only in LP244.51 after capacity/coverage tests. Until that certification, unsupported long trips are explicitly refused in the guarded path; the plan does not claim current parity.

No straight-line “fallback corridor” at launch. Provider timeout/rate limit/invalid geometry → route unavailable; Quick Check remains usable. Existing ACTIVE geometry can continue as explicitly static until watch expiry if independently valid; failed source updates still suppress fresh-alert claims. Default routing request deadline 10s, no unbounded retries; user Retry creates a bounded new request ID. Launch requires provider limits/terms review and measured capacity approval at forecast peak and 2× peak. If public endpoint cannot satisfy those gates, self-hosted OSRM or another approved compatible host is required. No host purchase/activation now. Route endpoint coordinates necessarily leave device for requested route/server watch; redact access logs and delete with watch.

## REL-01 — Deterministic eligibility order

Evaluate in this order; return class plus reason codes and evidence, never just a Boolean:

1. Installation/subscription consent and unrevoked ACTIVE watch; effective time reached; event source publicly projectable.
2. Event lifecycle ACTIVE; current source availability/capability; valid observed/expiry times; fresh adapter data. Unknown lifecycle or missing source identity suppresses push.
3. Resolve full event and real route geometry, validate precision, coordinate system and connected roadway relevance. County/PLACE lookup is discovery, not exact intersection proof.
4. Compute geometry relation: DIRECT_CORRIDOR / NEAR_CORRIDOR / REGIONAL / NONE / UNKNOWN.
5. Foreground only: project fresh position and event onto route segments; determine AHEAD / BEHIND / AT_POSITION / AMBIGUOUS and distance uncertainty. Server never performs moving progress inference.
6. Combine condition, severity, authorized advisory, source domain and confidence into HIGH/MEDIUM/SUPPRESSED; apply content preferences, dedupe and queue policy afterward.

Frozen starting geometry policy: existing 0.8-mile route distance is a **candidate discovery ceiling only**, not HIGH relevance. Existing 750-foot destination-preview width is evidence of another current heuristic, not a second authoritative threshold. Adopt configurable 60m comparison tolerance from current shadow scoring only as numeric error/near-geometry tolerance, requiring fixture/device certification. An exact shared, connected road segment or valid intersection establishes DIRECT_CORRIDOR; point proximity within 60m additionally needs verified road connectivity/segment linkage. Parallel/frontage/opposite carriageway conflicts override distance and suppress HIGH. If point precision is unknown, cap at MEDIUM even when close. Do not enlarge tolerance merely to capture more matches.

Community road evidence age must be <=180min, rail <=90min, routine community <=75min, and still within report expiresAt and existing lifecycle policy; these ceiling values come from js/app.js:9498/17484/105114. Use latest valid source observation/confirmation time, not fetch time; no extension past source expiry. NWS polling target 120s and DriveTexas 180s reuse current connector cadences; an adapter stops new push after three cadences without successful complete refresh (360s/540s). A failed/partial refresh never means road reopened. Any stricter official expiry/capability withdrawal wins. Suppressed stale data may remain explicitly dated in a brief but is not active notification evidence.

| Class | Deterministic rule | Surface/delivery |
|---|---|---|
| HIGH | DIRECT_CORRIDOR + ACTIVE/fresh + HIGH/SEVERE impact, or explicit official closure/impassability/severe warning; community requires at least MEDIUM evidence confidence | Eligible for HIGH_AWARENESS after other gates; source attribution mandatory |
| MEDIUM | Valid near-corridor candidate without confirmed connectivity; moderate construction; single unverified significant community observation; relevant regional/destination notice | Clearly qualified KBYG/in-app; ROUTINE only if user opted in and no unknown/stale evidence; never exact road closure claim |
| SUPPRESSED | Off discovery scope, behind moving traveler, expired/resolved/cancelled, stale source/report, unknown lifecycle/identity, withdrawn authority, invalid geometry or unrelated county | No active notification; return bounded reason, no false all-clear |

No fixed 10-mile lookahead is frozen: use remaining route in foreground and the complete explicit static corridor server-side. Local proximity can order in-app content without hiding a serious known later-route condition. A 4.8-mile-off-route minor construction record is suppressed by the 0.8-mile discovery ceiling. Fresh high water 6.2 route miles ahead may be HIGH only when actual connected geometry, source/confidence and progress gates pass.

## REL-02 — Progress and wording

Fresh Around Me (120s) is **not** enough for numeric ahead. Numeric ahead requires foreground, fix <=30s old, horizontal accuracy <=50m, two consistent samples, unambiguous segment projection and valid route geometry. These stricter defaults are derived conservatively from the existing watch's 5s cache/20s timeout, not claimed calibrated accuracy; certify sparse rural/urban/parallel-road fixtures before enabling copy. Missing native fix timestamp disables numeric ahead. Account for uncertainty from reported accuracy, segment ambiguity and movement between samples. If uncertainty crosses ahead/behind or a whole-mile rounding boundary, use generic wording.

Project onto each route segment using an appropriate metric distance method (PostGIS geography or equivalent tested client geodesic/local projection), not nearest vertex index. Sum segment lengths to compute chainage. At loops/self-intersections choose only a unique progress-consistent segment; ambiguity removes direction/numeric claims. Known one-way/carriageway metadata constrains matches; absence never invents direction. A definitely-behind event is suppressed for foreground trip relevance; an at-position event says “near your current route position”. Server still evaluates full static corridor and cannot know the event is behind; this limitation is disclosed when enabling trip alerts.

Allowed foreground numeric copy: “About {wholeMiles} miles ahead on your route — {source-qualified condition}.” Never false decimal precision. Background payloads use “Along your trip corridor” or “Reported near your trip corridor.” No miles-ahead field is sent by the server in v1. A tap may refine copy after a fresh foreground fix; it does not retroactively make the lock-screen text precise. “Traffic is clear”, “safe route” and “fastest route” are prohibited in every mode.

## GEO-01 — Weather and geometry-specific rules

| Geometry/source | Relation method | Allowed copy / fallback |
|---|---|---|
| NWS Polygon/MultiPolygon | Full validated polygon including holes, intersect remaining real route (foreground) or full static corridor (server) | “Severe weather intersects your route.” Exact event/location name retained; numeric hazard boundary distance only after REL-02 and boundary uncertainty checks |
| Official zone polygon | Fetch/cache governed official zone geometry; label zone precision | “Severe weather is active in an area along your trip.” Not a storm position or forecast path |
| County-only official alert | Match counties actually crossed; no replacement for finer available polygon that does not intersect | “Alert active in a county along your trip.” MEDIUM regional; no numeric ahead/HIGH exact-route claim |
| PLACE_ONLY | Resolve governed polygon when available; otherwise preserve PLACE-only precision | “Update for {place} along your trip.” No invented radius or pinpoint |
| DriveTexas Line/MultiLine | Entire geometry intersection or same connected segment with tolerance; midpoint marker ignored for targeting | “Road condition along your trip corridor” with authority/cause; lane/carriageway restrictions preserved |
| DriveTexas/community point | Distance to segments, then quality/connectivity/recency test | “Reported hazard near your route” until DIRECT_CORRIDOR established |
| ROAD_SEGMENT / official closure | Stable segment membership/overlap, roadway direction if present | Source-qualified closure affecting actual overlapping segment |
| Unknown geometry | No exact relevance | Source unavailable/unsupported precision; no route push |

Future NWS normalization MUST retain id, source replacement references, messageType/status, effective/onset/expiry/sent, raw event/severity/urgency/certainty/instruction, full GeoJSON and official zone references. Current `gridlyWeatherProvider.js:196` loses full polygon and selected-point acquisition is not a corridor-wide catalog. Server acquisition must fetch a complete relevant official alert set before evaluating routes; source permission/capacity review is a release gate. Missing polygon may use fetched official zones; do not infer shape from areaDesc or treat county match as finer geometry. Existing ring flattening is not a hole-aware spatial predicate.

Crossing infrastructure may be in a brief as “Crossing ahead” only with valid route/progress; otherwise “Crossing on your trip corridor”. An ACTIVE, fresh report may say “Crossing blockage reported”; a nearby roadway problem remains a road issue unless linked. No “train approaching/present” or live blockage assertion from location inventory/community reports. Infrastructure alone never triggers a hazard push.

Acceptance fixtures MUST distinguish point-near vs connected, line midpoint outside but actual intersection, polygon hole, county-only near miss, parallel roads, opposite carriageway, loops, stale/no fix, behind event, explicit stop/pause/expiry, source withdrawal, offline cancellation and long-route entry parity. Thresholds are configuration with versioned fixture evidence; changes require contract version and certification, not ad hoc client constants.
