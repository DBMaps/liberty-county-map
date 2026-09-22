# LP244.44 — Hazard normalization contract

Contract `LP24444.v1`; future additive projection, no report picker, records or runtime changed. [Machine enums](../../reports/lp24444-launch-contracts.json) are authoritative. [LP244.43 taxonomy audit](LP24443-HAZARD-ADVISORY-TAXONOMY.md) documents the existing split among picker, aliases, markers, display and report lifecycle. Implementation must retain original report protocol v2, type/subtype, severity, status, timestamps and source IDs; normalization adds fields without rewriting old records or making old clients submit new dimensions.

## HAZ-01 — Independent dimensions and missing evidence

Normalized object is `{v:1,condition,subtype,severity,advisory,observedPassability,authorityClass,sourceDomain,issuer,authorityEvidence,confidence,confidenceBasis,lifecycle,changeType,geometry,geometryPrecision,sourceId,sourceEventId,sourceRevision,observedAt,startsAt,endsAt,updatedAt,normalizationVersion,rawType}`. The backend event contract adds canonical event/episode/material revision and source-health fields. Adapter DTOs convert camelCase to backend snake_case explicitly; do not keep competing meanings.

UNKNOWN means applicable evidence is unavailable, unsupported or unrecognized; it is never a favorable road state. NOT_APPLICABLE is supported only for advisory when the source is known to offer an observation without an instruction. It is not a severity, authority, confidence or geometry value. Missing advisory information from an instruction-bearing source is UNKNOWN. Null is allowed for subtype, observedPassability, issuer, authorityEvidence, absent times and geometry; absent times/geometry must fail the corresponding push gates. `lifecycle:null` means unrecognized lifecycle and is ineligible, never ACTIVE by default. Empty or unknown source identifiers suppress notification identity creation. Render bounded raw labels only as escaped text; never display raw HTML or execute a source URL.

`observedPassability` is null, BLOCKED or IMPASSABLE. It records a reported observation, not legal road status. Do not interpret null as passable. `changeType` is CREATED, UPDATED or TERMINATED; UPDATED is a revision signal while lifecycle remains ACTIVE, not an alternative active state. Geometry can be null only with UNKNOWN or identity-only precision; coordinates use valid WGS84 GeoJSON and preserve full source shape. MultiLineString maps to LINE, MultiPolygon to POLYGON without discarding components/holes. Unknown enum values are retained in adapter diagnostics with bounded codes, not accepted as new canonical values.

## HAZ-02 — Compact condition mapping

| Canonical condition | Current/future source aliases and meaning |
|---|---|
| UNKNOWN | Missing or unmapped type; no push based on a guessed category |
| FLOODING | flooding, HIGH_WATER, high water; subtype may preserve depth unknown/observed cause, never infer safe depth |
| ROAD_OBSTRUCTION | ROAD_BLOCKED, blockage, existing road_closed community observation; observedPassability BLOCKED or IMPASSABLE when explicitly reported |
| CRASH_SCENE | crash; impact separate from injury speculation |
| DEBRIS | debris; powerline subtype preserves separate electrical concern without invented authority |
| CONSTRUCTION | construction, PLANNED_WORK; planned flag/times distinguish future work from current obstruction |
| DISABLED_VEHICLE | disabled_vehicle |
| TRAFFIC_BACKUP | traffic_backup; no estimated delay unless independently supported |
| RAIL_CROSSING_CONDITION | rail_blockage_delay, rail_issue; preserve reported subtype and attribution |
| ICE | ice, ICY_ROAD, BLACK_ICE_SUSPECTED, BRIDGE_OVERPASS_ICING via subtypes below |
| WINTER_ROAD_CONDITION | SNOW_COVERED_ROAD, WINTER_ROAD_HAZARD; cause-specific passability attaches to this or ICE |
| WINTER_PRECIPITATION | SLEET_FREEZING_RAIN; precipitation is not proof of road ice |
| REDUCED_VISIBILITY | visibility observation; WINTER subtype only when supported |
| OTHER_ROAD_HAZARD | other_hazard; livestock/animals, signal, emergency-response observation and other legacy subtypes retained |
| WEATHER_EVENT | Official weather event without a supported road-condition observation; raw NWS event stays available |
| OFFICIAL_NOTICE | Verified publicly authorized notice that does not fit a supported condition; authorization still independently required |

ROAD_IMPASSABLE is an impact/observedPassability, not a duplicate condition. Preserve known cause (ICE/FLOODING/etc.); otherwise ROAD_OBSTRUCTION plus IMPASSABLE. An official road_closed source uses cause where known plus authorized ROAD_CLOSED advisory; a legacy community road_closed report becomes “Road appears blocked” without conferring that advisory. Unknown legacy data is losslessly retained but excluded from high-confidence claims. No “all clear” from absence of a normalized category.

## HAZ-03 — Severity and confidence

Severity: UNKNOWN, LOW, MODERATE, HIGH, SEVERE. LOW means minor localized impact; MODERATE meaningful caution/delay; HIGH substantial road disruption or dangerous condition; SEVERE extreme threat/major impassability. This is an impact scale, not a responder credential or OS emergency level. Do not create CRITICAL for launch. Existing low/moderate/high/severe map by meaning, not ordinal guessing; unsupported legacy values remain UNKNOWN with raw value preserved.

NWS severity mapping: Minor→LOW, Moderate→MODERATE, Severe→HIGH, Extreme→SEVERE, Unknown/missing→UNKNOWN. Preserve raw urgency/certainty/event name separately; a future test-backed adapter distinguishes warnings from watches/advisories using official product evidence. “Warning” alone does not override expired/cancelled status or unrelated geometry. Roadway sources map only explicit documented impact fields; an official confirmed closure may qualify via authorized advisory without fabricating severity. Community selected severity remains attributed observation; confirmation cannot manufacture severity increases. Existing default ice severity is evidence of current UI, not universal severity for all winter events.

Confidence: UNKNOWN, LOW, MEDIUM, HIGH with basis. A single fresh valid community observation is LOW unless separately corroborated; at least two independent valid observations or independent source corroboration supports MEDIUM under existing moderation rules. HIGH requires verified precise source evidence with no material conflict; official origin alone does not eliminate geometry uncertainty. Repeated submissions by one actor are not independent. Confidence in observation does not raise authority class. Conflicting sources retain separate provenance; use uncertainty, never silently merge votes into official truth.

## AUTH-01 — Authority and public projection

| Authority | Meaning / projection |
|---|---|
| UNKNOWN | Unverified issuer/permission; no official claims or high-priority push |
| COMMUNITY_OBSERVATION | Reported condition only; attributed observational wording |
| OFFICIAL_PUBLIC | Validated official public source within its subject/geographic remit |
| AUTHORIZED_ORGANIZATION | Verified organization capability, scope, expiry and explicit public-projectable permission; private by default |
| SYSTEM_DERIVED | Computed summary referencing original evidence; no new legal authority or invented instruction |

Source domain is independently UNKNOWN/COMMUNITY/WEATHER/ROADWAY/ORGANIZATION. NWS governs weather alert evidence; roadway authority governs road closure evidence. A NWS ice warning does not declare a particular road closed. A community observation can be more locally specific while still observational. Dispatch/private operational data stays private unless a separately governed public projection is explicitly authorized. LP244.43 found no standalone Dispatch app in this repository; this contract is a boundary for future integration, not a claim it exists. Revoked/expired capability immediately withdraws eligibility and cancels unsent items.

## ADV-01 — Advisory and wording matrix

All consumer-projectable advisories require current public evidence; none publishes Dispatch-private content by default. Community-safe guidance is distinct from official instructions and displays issuer/source.

| Advisory | Community-safe form | Official/authorized form | Dispatch/private/public rule |
|---|---|---|---|
| UNKNOWN | “Details unavailable” when useful, no instruction | Same missing-evidence meaning | No projection from unknown permissions |
| NOT_APPLICABLE | Observation without advisory | Source explicitly has no instruction dimension | Not an all-clear |
| USE_CAUTION | “Use caution — {condition} reported” as clearly generic awareness | Source-attributed caution | Project only approved safe fields |
| EXPECT_DELAYS | “Delays reported” / “Delays may occur” with supporting observation | “Expect delays” per source | Operational estimates remain private |
| MONITOR_CONDITIONS | “Monitor conditions” as general guidance | Source-attributed monitoring instruction | No undisclosed operational intelligence |
| AVOID_AREA | Community cannot issue this advisory; show underlying reported hazard | “Avoid area” only within verified issuer remit | Public authorization mandatory |
| RESTRICTED_ACCESS | “Access appears blocked” if observed; advisory stays NOT_APPLICABLE | “Restricted Access” only authorized | Access-control details private unless approved |
| IMPASSABLE | “Road appears impassable”; observedPassability, not this official advisory | “Impassable” per authorized roadway evidence | Governed public projection required |
| ROAD_CLOSED | “Road appears blocked”; preserve legacy observation | “Road Closed” per verified roadway/organization authority | No self-authorized closure |
| DETOUR_REQUIRED | No community instruction or generated detour; show reported blockage | “Detour Required” with source attribution, no invented route | Only approved public direction; no navigation generation |
| TRAFFIC_CONTROL | “Traffic control reported” as observation with NOT_APPLICABLE advisory | “Traffic Control” per authorized source | Private staffing/tactics never projected |

SYSTEM_DERIVED may summarize “Reports of ice near your route”; an official instruction remains attributed to its source and backed by authorityEvidence. The system cannot assign OFFICIAL_PUBLIC to its own inference. A validated public source link may appear in detail through a fixed source allowlist; notification targets never execute arbitrary source links.

## LIFE-01 — Lifecycle and geometry

ACTIVE, RESOLVED, EXPIRED, CANCELLED are frozen states. Recognized legacy active/open reports become ACTIVE only before their existing expiresAt and moderation eligibility; explicit cleared/resolved/reopened-road signals become RESOLVED; expiry becomes EXPIRED; withdrawn/deleted/rejected/cancelled becomes CANCELLED or immediate removal if existing privacy rules require. Unknown report status maps to null/ineligible. Preserve source-specific mapping fixtures before implementation; don't treat every unrecognized status as ACTIVE. Source fetch failure changes source health, not event lifecycle. Source timestamp update alone is not a material event update.

Official NWS effective/onset/expiry and messageType/status/replacement references determine active, update, cancel and supersession. Follow proven replacement references through event aliases; no fuzzy merge based solely on location/title. Roadway reopening resolves the prior closure when source identity proves continuity. A source-proven recurrence after terminal state starts a new episode/event ID. Backend document owns dedupe/revision behavior.

Geometry classes: UNKNOWN, POINT, LINE, POLYGON, ROAD_SEGMENT, PLACE_ONLY, COUNTY_ONLY. Keep stable segment identifiers and direction/lanes where available; display midpoints never replace full geometry. Identity-only membership is regional evidence; a point may be approximate and cannot automatically establish same-road relevance. Surface geometry provenance, spatial uncertainty and temporal freshness separately. [Route rules](LP24444-ROUTE-WATCH-RELEVANCE-CONTRACT.md) determine exact intersection vs nearby/regional wording; [winter contract](LP24444-WINTER-HAZARD-CONTRACT.md) supplies all eight required concepts.

LP244.46 acceptance must cover every existing category/subtype and unknown value, old pending operations, source shapes, authority revocation and every advisory/community wording pair. No source must invent unavailable dimensions to fit this projection. UI, marker, KBYG and push consume this same projection; legacy writes stay compatible until a separately reviewed migration exists.
