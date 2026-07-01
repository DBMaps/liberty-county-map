# GRIDLY V678 — OSM Directional Framework Risk Review

## Scope

This risk review supports the V678 documentation-only architecture package for a corridor-agnostic OSM directional intelligence framework. It does not authorize runtime changes, directional display, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, Supabase changes, or county expansion.

## Hardcoding Risk

**Risk:** A first validation effort may accidentally hardcode US 59 / I-69 route names, Montgomery-specific tags, or motorway assumptions.

**Impact:** Future corridors such as I-10, US 90, TX 146, TX 321, SH 105, SH 150, FM 1960, and county corridors would require rework and could inherit incorrect confidence rules.

**Mitigation:** Require data-driven corridor IDs, normalized route references, reusable metadata schemas, and confidence rules that do not depend on a specific route name.

## Corridor-Specific Logic Risk

**Risk:** Extraction logic may treat divided motorways, state highways, and FM roads as if they share identical geometry and tagging patterns.

**Impact:** Directional inference could be accurate for US 59 / I-69 but unreliable for arterials, rural highways, frontage roads, or multiplexed routes.

**Mitigation:** Classify corridors by tier and highway class. Require per-corridor audit sampling before promotion beyond offline research.

## False Directional Confidence Risk

**Risk:** Bearing, route reference, or `oneway` tags may create a false impression that NB/SB/EB/WB direction is known.

**Impact:** Users could receive misleading directional awareness if display is enabled prematurely.

**Mitigation:** Keep display blocked. Assign confidence only when required signals, county containment, geometry continuity, and human audit agree.

## OSM Metadata Inconsistency Risk

**Risk:** OSM tags vary by mapper, corridor, date, and jurisdiction. Lane and destination-lane tags may be present on one corridor and absent on another.

**Impact:** Optional metadata could be overvalued or missing metadata could be interpreted as negative evidence.

**Mitigation:** Treat lane and destination-lane tags as optional confidence boosters, not required universal inputs. Preserve extraction dates and object IDs for repeatable audit.

## County Containment Risk

**Risk:** OSM `tiger:county` tags may be incomplete, stale, or inconsistent with accepted Gridly county boundaries.

**Impact:** Directional artifacts could leak into unsupported counties or attach to incorrect local awareness contexts.

**Mitigation:** Use accepted county boundaries as containment authority. Treat OSM county tags as supporting evidence only. Block unresolved and boundary-crossing segments by default.

## Runtime Expansion Risk

**Risk:** Offline directional evidence could be imported into runtime files before product readiness.

**Impact:** Runtime behavior, UI labels, incident display, or routing assumptions could change without authorization.

**Mitigation:** Keep V678 documentation-only. Require future artifacts to remain outside runtime bundles with explicit `runtimeEligible: false` defaults.

## Maintenance Burden

**Risk:** OSM ways can split, merge, retag, or change geometry over time.

**Impact:** Directional confidence can decay, and stale extracts may become inaccurate.

**Mitigation:** Version extraction runs, record geometry hashes, diff updates, and require re-audit after material OSM changes.

## User Trust Risk

**Risk:** Directional display without sufficient evidence may imply operational precision Gridly does not yet support.

**Impact:** Trust in Gridly's awareness platform could be reduced if users see incorrect directional guidance.

**Mitigation:** Preserve awareness-first positioning. Do not expose directional output until a later milestone approves product language, evidence thresholds, and runtime behavior.

## DriveTexas Assumption Risk

**Risk:** The framework may assume DriveTexas is available as a current directional validation source.

**Impact:** This would violate the paused DriveTexas state and create dependency on a protected system.

**Mitigation:** Keep `DriveTexasPaused: true`. Treat DriveTexas only as a future compatibility source after explicit activation approval.

## Recommendation to Keep Directional Display Blocked

Directional display must remain blocked. V678 supports architecture and extraction planning only. No NB/SB/EB/WB labels, route intelligence UI, DriveTexas integration, Transportation Intelligence activation, or runtime directional behavior should be enabled from this milestone.

## Final Risk Position

The framework is appropriate for offline extraction planning if it remains corridor-agnostic, blocked by default, county-contained, and human-audited. It is not ready for runtime display.
