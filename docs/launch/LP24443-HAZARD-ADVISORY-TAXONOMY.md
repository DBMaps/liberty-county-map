# LP244.43 — Hazard/advisory taxonomy

Audit only; baseline `647c85a30d042a90276c3915ba92538df78ddf1c`. No labels, protocol, categories, markers, migrations, Dispatch or legal content changed. Covers request parts 20–23, 25 and 32. The normalized inventory below separates existing runtime, aliases, source labels and proposed semantics.

## Existing consumer inventory

Authoritative definitions: `js/app.js:10178` HAZARD_TYPES; ROAD_HAZARD_TYPE_OPTIONS immediately below; other-hazard subtype options (10265); `HAZARD_CATEGORY_MAP` (12256); production PNG mappings (12310); `js/gridlyConditionDisplayLabel.js:12`. The JSON inventory contains the complete HAZARD_TYPES and alias objects extracted from source.

| Internal condition | Current consumer label | Metadata severity | Primary road picker | Current icon/PNG |
|---|---|---|---|---|
| flooding | Flooding | high | yes | wave / water-over-road.png |
| ice | Ice | high | **no** | ice cube / **water-over-road.png** |
| debris | Debris In Road | moderate | yes | caution / debris-in-road.png |
| crash | Crash / Wreck | high | yes | car / crash-on-road.png |
| construction | Construction | moderate | yes | work barrier / construction-zone.png |
| road_closed | Road Closed | high | yes | no entry / road-closed.png |
| disabled_vehicle | Disabled Vehicle | moderate | yes | vehicle / disabled-vehicle.png |
| traffic_backup | Traffic Backup / Heavy Delay | moderate | yes | traffic light / traffic-backup-heavy-delay.png |
| rail_blockage_delay | Train Blocking Crossing | high | rail flow | train / train-front.png |
| rail_issue | Rail Issue | moderate | rail flow/legacy support | rail / other-hazard.png |
| other_hazard | Other Hazard | moderate | yes | exclamation / other-hazard.png |

Other-hazard structured subtypes: livestock_on_road (“Livestock on Road”), traffic_signal_issue (“Traffic Signal Issue”), downed_power_line (“Downed Power Line”), emergency_response_activity (“Emergency Response Activity”), other (“Other”). They are serialized with `gridly_structured=` metadata in detail, not a separate top-level condition enum. PNG mappings also recognize compatibility keys emergency_response_impact, fallen_tree, signal_outage, and rail/crossing infrastructure identities. These are not all independent report-picker types.

Aliases in `HAZARD_CATEGORY_MAP`: blocked/heavy/delayed/delay/blocked_crossing/crossing_blocked/train_blocking_crossing/rail_blockage/rail_blocked/rail_delay → rail_blockage_delay; wreck → crash; heavy_traffic/traffic_delay → traffic_backup; road_hazard/other → other_hazard. Identity aliases for all canonical categories remain. `hazard_cleared` maps visually to other_hazard but is a **lifecycle marker**, never a new active hazard. Preserve that distinction before any generic fallback. `getHazardCategory` (61556) lowercases and underscore-normalizes unknown inputs, then defaults to other_hazard.

Shared retrieval (`GRIDLY_CORE_ROAD_HAZARD_CLEANUP_TYPES`, 58531) includes flooding, ice, debris, crash, construction, road_closed, disabled_vehicle, traffic_backup, other_hazard; shared road report types add hazard_cleared and wreck. Rail types include blocked/heavy/delayed/delay/clear/cleared in route scoring/lifecycle handling. The consumer map and alert semantic layers distinguish crossing infrastructure from active blockage; do not collapse them into one notification type.

## Source-specific categories and labels

DriveTexas provider normalizes **Road Closure, Flooding, Construction, Lane Closure, Crash, Bridge Restriction, Travel Advisory** (`js/gridlyDriveTexasProvider.js:9`). Pattern order is significant: flood terms precede closure; generic bridge/restriction precedes closure; lane wording precedes road closure. A single flat category can lose the joint fact “closed due to flooding” or “bridge icing.” Keep source description and independently extract condition/advisory only under a tested contract.

Legacy/projection IDs `txdot_construction`, `txdot_closure`, `txdot_flooding`, `txdot_damage`, `txdot_other` are still generated in `app.js:109385` and mapped for lifecycle/display (10804). They encode source plus condition; they must not become additional user-selectable hazards. `gridlyConditionDisplayLabel.js:32` recognizes construction, flooding/flood/high_water, closure/road_closed/road_closure, lane_closure, bridge_restriction, crash/incident/crash_incident. Group labels add lane_closures, road_closures, bridge_restrictions, flooding_high_water and other. These singular/plural aliases are presentation levels, not new physical conditions.

Weather provider categories (`js/gridlyWeatherProvider.js:9`) are Flash Flood Warning, Flood Warning, Flood Advisory, Severe Thunderstorm Warning/Watch, Tornado Warning/Watch, Special Weather Statement, High Wind Warning, Wind Advisory, Dense Fog Advisory, Winter Weather, Heat Advisory, Excessive Heat Warning, Fire Weather Watch, Red Flag Warning, Air Quality Alert, Coastal Flood Warning, Rip Current Statement, Tropical Storm, Hurricane; fallback Weather Advisory. **Raw `event` is separately retained** and the display-label owner prefers it. Do not rebrand all official winter watches/warnings as road ice. Official event names are an open source vocabulary; these 21 broad categories are not an exhaustive list of NWS event strings.

`gridlyAlertSemanticContract.js:16,60` reduces active/cleared/expired/inactive/removed/reopened/open status before source-specific roadway/crossing/weather/community classification. This semantic layer and `gridlyConditionDisplayLabel` should own future projection instead of adding independent switches to every surface.

## Protocol, severity, lifecycle and authority

`js/gridly-report-protocol.js:7` exposes report_type, severity, detail, source, confidence and expires_at; current report protocol version is 2. The pending operation is idempotent and payload-bounded. There is no separate first-class advisory field in this public projection. Current `public.reports` is an existing baseline table: the repository's later migrations alter/govern it, rather than establishing a complete original report-category enum. Do not claim exhaustive live database constraints from these migrations. `20260908200554_lp24422a_prelaunch_reset_and_atomic_report_transition.sql:459` blocks empty/clear creation, forces community source to user, and uses guarded mutation RPCs. Protocol shape alone does not certify semantic authority on every free-form string.

Severity appears in HAZARD_TYPES, `getGridlyIncidentSeverity` (13268), provider severity, route numeric weights (62124), map glyphs, KBYG priority and historical/active report paths. Values include high/moderate defaults and other normalized low/critical/unknown/provider labels. Preserve original provider severity alongside normalized level; map moderate → MODERATE explicitly instead of silently reassigning LOW. Current construction defaults moderate; future low-impact construction can be LOW only with supporting impact information.

Status is separate: getIncidentLifecycleState (115800), gridlyClassifyHazardLifecycle (21079), report expires_at, recent clear indexes, provider end times and source freshness. Active/aging/stale/expired/historical/cleared/cancelled are not severity or condition. Retention deletion deadlines are not active hazard lifetimes. Source withdrawal/moderation can remove projection before nominal expiry.

Legal Community Guidelines (`legal/community-guidelines.html:3`) already call reports observations rather than official information and prohibit misleading content. Yet community HAZARD_TYPES and label owner use “Road Closed” and “Train Blocking Crossing.” Source chips alone do not fully cure authoritative headline ambiguity on a push lock screen. This is a product wording gap, not a legal conclusion.

## Recommended normalized contract

Keep compatible legacy `report_type` during migration. Add a versioned projection with:

- condition: physical event (FLOODING, ICE, CRASH, DEBRIS, CONSTRUCTION, DISABLED_VEHICLE, TRAFFIC_BACKUP, RAIL_CONDITION, OTHER_HAZARD; optional subtypes).
- severity: UNKNOWN / LOW / MODERATE / HIGH / CRITICAL, with severityBasis and rawSourceSeverity. CRITICAL is an impact level, not a privileged OS channel.
- advisory: nullable **authorized** operational action, independently sourced. No advisory inferred solely from condition or severity.
- observationQualifier: reported/suspected/confirmed-by-community/official-source; uncertainty and confidence remain distinct.
- authority: COMMUNITY_OBSERVATION / OFFICIAL_WEATHER / OFFICIAL_ROADWAY / AUTHORIZED_OPERATIONAL, issuer and evidence/reference, permission/capability, scope and validity window.
- lifecycle: state, observedAt, effectiveAt, expiresAt, resolvedAt, lastSourceSuccess, freshness class.
- geometry: kind/precision/provenance/version; road segment/PLACE memberships when known; canonical event/source identity.

Example: community high water → FLOODING/HIGH/advisory null/“High water reported.” An official instruction can separately supply AVOID_AREA. Official lane closure for construction → CONSTRUCTION + lane-closure subtype + authorized restriction; do not call full ROAD_CLOSED. Preserve original source instructions verbatim as governed text where normalization cannot faithfully express them.

## Advisory permission matrix

This is a proposed policy, not a statement of an existing Dispatch implementation. No standalone Dispatch application/authorization model is present in this checkout; event-dispatch code and historical references do not establish one. Require the external Dispatch owner to map issuer roles and explicit publication capability before operational projections are enabled.

| Advisory | Consumer-safe output | Community-origin handling | Official / authorized operational | Dispatch-private vs shareable |
|---|---|---|---|---|
| USE_CAUTION | “Use caution; condition reported” | May be Gridly explanatory guidance tied to observation, not an asserted official order | Permitted with evidence | Shareable only after explicit public projection |
| MONITOR_CONDITIONS | “Monitor conditions” | Generic awareness guidance | Permitted | Shareable if public |
| EXPECT_DELAYS | “Delays reported/possible” | Qualified impact, not invented ETA | Permitted with source | Private estimates stay private unless validated |
| AVOID_AREA | “Authority advises avoiding this area” | No authority claim; keep observation wording | Authorized source instruction only | Private tactical avoidance never automatically public |
| ROAD_CLOSED | “Road closed — [authority]” | “Road appears blocked/impassable” | Explicit authorized closure, affected extent and expiry | Shareable only with closure publication permission |
| DETOUR_REQUIRED | Source instruction, not generated navigation | Not community-selectable order | Official/authorized detour order | Private dispatch route instructions remain private |
| RESTRICTED_ACCESS | Source-qualified restriction | Describe observed blockage, no legal restriction assertion | Authorized restrictions and scope | Sensitive access controls private by default |
| IMPASSABLE | Source-qualified passability | “Road appears impassable” | Authorized operational condition | Public only with reviewed geometry/validity |
| TRAFFIC_CONTROL | “Traffic control reported/in effect” | Observation can report visible control, not direct traffic | Authorized operational notice | Tactical staffing/positions private |

A report cannot gain issuer authority from text, community votes, confidence, severity or proximity. Source-issued action and platform recommendation must have separate attribution. Do not synthesize DETOUR_REQUIRED merely because a route intersects a closure. Condition/advisory validity pairs should be explicit: flooding/ice may pair with closure or impassability when supported; construction may pair with traffic control/delays; a weather watch alone does not prove ROAD_CLOSED; a crossing point alone supports no operational advisory.

## Migration impact and safeguards

| Surface | Future work / invariant |
|---|---|
| Existing reports | Versioned adapters, preserve IDs/observed timestamps and clear identity; unknown legacy types remain qualified generic content |
| Database/RPC | Additive versioned fields and server validation of condition/advisory/issuer; protocol negotiation; no blind public-column extension |
| Official connectors | Retain raw event/severity, condition cause, instruction, full geometry, stable ID and expiry; maintain source withdrawal handling |
| Consumer/report UI | Observation wording; do not grant closure powers via a picker |
| Markers/filters | Map all legacy aliases and winter subtype fallback; avoid water glyph for ice; condition drives icon, authority/advisory drives caption/badge |
| KBYG/Active Issues | Shared condition label and lifecycle projection; no duplicate groups or cleared resurrection |
| Notifications | Consume normalized public projection plus authority and freshness, not raw report_type/free text |
| Dispatch | Separate private operational data and public share projection; require role/capability matrix and withdrawal propagation |
| Moderation | Validate abuse/authority impersonation; source suppressions invalidate pending and cached candidates |
| Retention/history | New metadata follows bounded existing retention; no extension on normalization; public geometry not joined to private device histories |
| Tests | Alias round-trip, unknown type, all condition/advisory pairs, community vs official text, ice retrieval/icon, clear/expiry and context dedupe |

Recommended ownership: central condition registry + source adapters + public projection policy, with a compatibility adapter for old labels. Do not replace protocol, all icons and all filters in one unbounded change. Audit phase has made none of these changes.
