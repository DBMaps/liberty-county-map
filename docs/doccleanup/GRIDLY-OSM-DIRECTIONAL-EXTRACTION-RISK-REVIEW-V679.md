# GRIDLY V679 — OSM Directional Extraction Risk Review

## Scope

This risk review supports the V679 documentation-only OSM directional extraction planning package. It evaluates risks for future offline extraction design and confirms that directional runtime display remains blocked.

## Hardcoding Risk

**Risk:** A future implementation could encode US 59 / I-69 assumptions into extraction logic and fail when applied to I-10, US 90, TX 146, TX 321, SH 105, SH 150, FM 1960, or future corridors.

**Controls:** Corridor definitions must be data-driven. Route refs, aliases, allowed highway classes, county scope, and mainline/link policies must live in reusable configuration or inventory artifacts rather than corridor-specific code branches.

**Disposition:** Manageable only if hardcoded corridor logic remains disallowed.

## OSM Metadata Inconsistency Risk

**Risk:** OSM tags vary by region, mapper practice, road class, and time. Lane, destination, relation, and county tags may be incomplete or inconsistent.

**Controls:** Required signals are limited to minimum identity, classification, geometry, directional context, county evaluation, timestamp, and tag snapshot requirements. Lane and destination metadata remain optional confidence inputs, not prerequisites.

**Disposition:** Manageable with conservative confidence rules and human audit.

## Extraction Drift Risk

**Risk:** OSM ways can split, merge, change tags, move geometry, or alter relation membership between extracts.

**Controls:** Future artifacts should record OSM IDs, extraction timestamp, query version, source tags, and geometry hashes. Re-extraction should diff against previous artifacts and require re-audit after material changes.

**Disposition:** Requires ongoing maintenance before any activation decision.

## County Containment Risk

**Risk:** Corridor segments may cross county boundaries or leak into unsupported counties, creating misleading local awareness.

**Controls:** Accepted Gridly county boundaries must be the containment authority. OSM `tiger:county` can support but not replace spatial containment. Boundary-crossing, outside-scope, and unresolved segments must block or require explicit review.

**Disposition:** High priority gate. Corridors without county containment must remain blocked.

## Confidence Inflation Risk

**Risk:** Optional metadata or high-profile corridors could create an exaggerated sense of directional certainty.

**Controls:** Confidence should consume required signal completeness, containment, geometry continuity, oneway consistency, optional metadata coverage, drift, and human audit outcomes. Confidence must never be promoted from route name, demand, or importance alone.

**Disposition:** Directional display should remain blocked until confidence models are independently reviewed.

## Runtime Expansion Risk

**Risk:** Offline extraction artifacts could accidentally become runtime dependencies or enable directional UI.

**Controls:** V679 requires offline-only artifacts, no `js/app.js` changes, no Supabase changes, no DriveTexas activation, no Transportation Intelligence activation, and `runtimeEligible: false` defaults.

**Disposition:** Manageable only with strict artifact isolation and code review.

## User Trust Risk

**Risk:** Premature NB/SB/EB/WB display or corridor direction claims could mislead users during time-sensitive awareness decisions.

**Controls:** Gridly remains awareness-first. Directional corridor metadata must pass extraction, inventory, audit, confidence, and activation milestones before any display is considered.

**Disposition:** Directional display must remain blocked.

## DriveTexas Dependency Assumptions

**Risk:** Future plans might incorrectly assume DriveTexas is active or available as a validation source.

**Controls:** DriveTexas remains paused. Future compatibility checks may occur only after a separate milestone authorizes DriveTexas analysis. V679 extraction planning has no DriveTexas dependency.

**Disposition:** No DriveTexas activation recommended.

## Future Maintenance Burden

**Risk:** Corridor expansion may create recurring work for alias normalization, relation drift, boundary handling, audit sampling, and confidence recalibration.

**Controls:** Use reusable corridor onboarding templates, inventory summaries, audit artifacts, and drift diffing. Do not accept a corridor into extraction unless maintenance ownership and review cadence are defined.

**Disposition:** Inventory design should explicitly include maintenance metadata.

## Recommendation to Keep Directional Display Blocked

Directional display should remain blocked. V679 is ready for inventory design, not runtime use or extraction execution. No NB/SB/EB/WB UI, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, county asset modification, Supabase integration, or production ingestion should occur.

**Final risk recommendation: keep directional display blocked and proceed only to offline inventory design.**
