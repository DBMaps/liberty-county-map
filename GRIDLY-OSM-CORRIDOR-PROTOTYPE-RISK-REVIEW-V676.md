# GRIDLY V676 — OSM Corridor Prototype Risk Review

## Scope

This risk review covers the documentation-only V676 planning package for a possible future OSM corridor prototype. It does not authorize implementation, runtime behavior changes, directional display, route guidance, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, Supabase changes, county-road asset changes, or new counties.

## False directional confidence risk

**Risk:** OSM geometry can tempt a system to infer NB/SB/EB/WB direction from bearing, road shape, or local naming even when the data does not prove directional semantics. This is especially risky for divided highways, frontage roads, ramps, curves, and diagonal corridors.

**Impact:** High. Incorrect direction could mislead users and undermine Gridly's awareness-first trust posture.

**Control:** Directional confidence must require route identity, continuity, county containment, and explicit directional evidence. Bearing-only inference must be a mandatory blocker. Directional display must remain blocked.

## OSM extraction risk

**Risk:** A future extraction could include non-mainline ways, omit relation members, capture stale data, or normalize route refs incorrectly.

**Impact:** Medium to high. Bad extraction would contaminate confidence scoring before review begins.

**Control:** Require source timestamp, query text, checksums, OSM way IDs, OSM relation IDs, accepted/rejected segment tables, and repeatable preprocessing. Full county road extracts should remain out of scope.

## County containment risk

**Risk:** Major corridors cross county boundaries, and clipping can create partial segments whose direction or continuity depends on out-of-scope geometry.

**Impact:** Medium. Uncontrolled geography could expand runtime scope or produce false continuity.

**Control:** Limit scope to `liberty-tx`, `montgomery-tx`, and `san-jacinto-tx`; clip before scoring; mark boundary cuts; reject segments that cannot be assigned to one approved county; fail if directional meaning depends on unapproved counties.

## Runtime size risk

**Risk:** OSM data can grow beyond the corridor-only purpose if ramps, frontage roads, connectors, and unfiltered local networks are retained.

**Impact:** Medium. Size creep could pressure later runtime loading or compromise mobile performance.

**Control:** V676 creates no runtime asset. Future measurement must report raw extract size, filtered size, catalog size, compressed size, segment counts, and hypothetical bundle delta without importing the data into runtime.

## User trust risk

**Risk:** Users may interpret directional labels or corridor intelligence as official route guidance rather than awareness context.

**Impact:** High. Gridly's mission is Know Before You Go, not navigation or official traffic control.

**Control:** Keep directional display, route guidance language, and DriveTexas-derived event mapping blocked unless separately approved by future governance milestones.

## Maintenance burden

**Risk:** OSM changes over time. A one-time prototype can become stale if no refresh, diff review, or regression process exists.

**Impact:** Medium. Stale directional metadata could become less reliable than no metadata.

**Control:** A future prototype must include extraction date, source version, repeatable scripts, diff review requirements, and confidence revalidation. No production dependency should be created by V676.

## Corridor-selection risk

**Risk:** Selecting an easy corridor may overstate feasibility; selecting an overly complex corridor may prematurely reject the concept.

**Impact:** Medium. The first prototype must be representative and consequential without being broad.

**Control:** V676 selects US 59 / I-69 because it has strong route identity, regional relevance, expected OSM relation support, and enough divided-corridor complexity to expose false-confidence risks. If it cannot pass without guessing, directional display should remain blocked broadly.

## Future DriveTexas dependency assumptions

**Risk:** A successful OSM corridor prototype could be incorrectly interpreted as readiness for DriveTexas event matching.

**Impact:** Medium to high. Official event text, ramps, frontage roads, mile markers, and incident vocabulary may not map cleanly to OSM segments.

**Control:** DriveTexas remains paused. A separate DriveTexas-specific mapping audit and governance authorization would be required before any event integration is considered.

## Recommendation to keep directional display blocked

Directional display must remain blocked after V676. A future V677 offline prototype may be considered for US 59 / I-69 only as an evidence-gathering exercise. It must not enable NB/SB/EB/WB display, route guidance, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, or runtime behavior changes.
