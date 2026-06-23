# GRIDLY V680 — OSM Directional Inventory Risk Review

## Scope

This risk review supports the V680 documentation-only OSM directional inventory design package. It evaluates risks introduced by defining future inventory artifacts and confirms that no runtime behavior, directional display, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, county asset modification, Supabase change, or extraction implementation is recommended.

## Inventory Bloat Risk

**Risk:** A scalable inventory for dozens of counties and hundreds of corridors could accumulate excessive segment, evidence, validation, and audit records.

**Controls:** Keep artifact types modular, require stable IDs, separate required fields from optional enrichment, and use lifecycle states to retire stale or superseded records. Optional lane, destination, access, and relation evidence should enrich validation without becoming mandatory for every corridor class.

**Disposition:** Manageable if future prototypes include pruning, versioning, and retirement rules before broad expansion.

## Hardcoding Risk

**Risk:** US 59 / I-69 or another early corridor could become embedded in inventory field names, validation assumptions, or blocking rules.

**Controls:** Corridor records must use normalized route refs, aliases, corridor classes, county scope, continuity policy, and mainline policy as data. US 59 / I-69 may be referenced only as a non-binding example.

**Disposition:** Manageable only if corridor-specific schema forks remain disallowed.

## County Containment Risk

**Risk:** Cross-county corridors and boundary-crossing segments could leak directional inventory into unsupported counties or blur local awareness boundaries.

**Controls:** Containment records are mandatory. Every segment must receive `contained`, `boundary_crossing`, `outside_scope`, or `unresolved` status. Outside-scope and unresolved containment block progression; boundary crossings require continuity or split policy.

**Disposition:** High-priority gate. Corridors without explicit county containment must remain blocked.

## Metadata Inconsistency Risk

**Risk:** OSM directional, lane, destination, relation, and access tags may be missing, stale, locally inconsistent, or mapper-dependent.

**Controls:** Required fields focus on identity, route refs, source identity, geometry hash, highway class, oneway value, containment, validation, and audit provenance. Lane and destination metadata remain optional confidence-model inputs and cannot override unresolved required fields.

**Disposition:** Manageable with conservative validation and human audit.

## Confidence Inflation Risk

**Risk:** Future teams could treat a rich inventory as proof of directional certainty or promote a high-profile corridor because it appears complete.

**Controls:** V680 defines confidence-model inputs but no confidence logic. Priority tier, corridor importance, user demand, and route prominence must not promote confidence. Confidence must remain blocked until a separate model-design milestone.

**Disposition:** Directional display must remain blocked until independent confidence design and audit milestones are complete.

## Runtime Expansion Risk

**Risk:** Offline inventory artifacts could drift into production bundles, runtime ingestion, Supabase tables, or UI logic before activation approval.

**Controls:** All artifacts default to `runtimeEligible: false`. V680 prohibits `js/app.js` changes, production ingestion, Supabase writes, directional UI, DriveTexas activation, Transportation Intelligence activation, and TIGER replacement.

**Disposition:** Manageable with strict code review and artifact isolation.

## User Trust Risk

**Risk:** Premature NB/SB/EB/WB claims could mislead users during time-sensitive awareness decisions.

**Controls:** Gridly remains awareness-first. Directional intelligence is second and must pass inventory, validation, audit, confidence, and activation gates before display is considered.

**Disposition:** User trust requires keeping directional display blocked.

## DriveTexas Assumption Risk

**Risk:** Future inventory planning could incorrectly assume DriveTexas is active, authoritative, or directionally complete.

**Controls:** DriveTexas remains paused. V680 creates no DriveTexas dependency. Future compatibility may be considered only in a separate milestone and must treat DriveTexas as a candidate event source, not inventory authority.

**Disposition:** No DriveTexas activation recommended.

## Maintenance Burden

**Risk:** OSM drift, corridor expansion, alias changes, relation edits, county boundary updates, and audit reviews could create unsustainable maintenance demands.

**Controls:** Corridor records should include maintenance owner and review cadence when available. Audit records should preserve source timestamps, schema versions, source query versions, artifact hashes, drift summaries, reviewer decisions, and retirement status.

**Disposition:** Manageable only if future offline prototypes include maintenance ownership and drift review.

## Recommendation to Keep Directional Display Blocked

Directional display should remain blocked. V680 is ready to support validation-model design, not runtime ingestion or user-facing direction claims. No NB/SB/EB/WB UI, DriveTexas activation, Transportation Intelligence activation, TIGER replacement, county road modification, Supabase integration, extraction code, confidence code, or production ingestion should occur.

**Final risk recommendation: keep directional display blocked and proceed only to offline validation-model design.**
