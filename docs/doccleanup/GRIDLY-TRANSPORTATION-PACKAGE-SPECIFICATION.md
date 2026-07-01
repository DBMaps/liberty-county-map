# GRIDLY Transportation Package Specification

## 1. Purpose

This specification defines the contract for Gridly Transportation Packages in the Southeast Texas Regional Foundation. It converts the Blueprint principle of shared regional transportation ownership into implementation-ready architecture documentation.

A Transportation Package is the authoritative home for physical transportation infrastructure. It prevents county duplication, provider-driven duplication, and presentation-driven duplication by defining one shared regional owner for corridors, roads, rail, crossings, intersections, carriageways, direction models, and related geometry.

This document is architecture documentation only. It does not authorize runtime, JavaScript, CSS, HTML, Supabase, UI, migration, provider integration, or feature changes.

## 2. Mission

Transportation Packages support **Know Before You Go** by establishing the durable infrastructure context needed to understand how conditions affect movement through a region.

The Transportation Layer answers:

- What corridor, road, rail asset, crossing, intersection, carriageway, or direction is affected?
- How does that asset continue across county or municipal boundaries?
- Which communities and Intelligence Objects relate to the asset?
- How can future Experience Packages consume transportation context without owning transportation assets?

## 3. Corridor Ownership

A corridor is owned once by the Transportation Layer. A corridor may cross many counties, municipalities, communities, and Awareness Areas, but it remains one corridor with many relationships.

Corridor ownership includes:

- Stable corridor id.
- Canonical corridor name.
- Route identifiers and aliases.
- Regional scope.
- Geometry references.
- Segment ordering.
- Direction model.
- Relationship metadata.
- Validation and certification evidence.

## 4. Road Ownership

Roads are Transportation-owned assets. A road may be part of a corridor, local network, frontage system, access road, or future transportation classification.

Road ownership includes geometry, identifiers, source metadata, continuity, relationships, and validation. Community Packages may relate to roads, but must not copy or own road records.

## 5. Rail Ownership

Rail assets belong to the Transportation Layer as physical infrastructure. Rail ownership includes rail lines, rail segments, rail identifiers, rail-related geometry, rail crossings, and relationships to communities and Intelligence Objects.

Rail providers may produce intelligence about rail activity or crossing status, but provider records do not own rail infrastructure.

## 6. Crossing Ownership

Crossings are Transportation-owned relationship assets where infrastructure intersects or interacts. Crossing types may include:

- Road-rail crossings.
- Road-road crossings.
- Road-water crossings.
- Corridor-corridor crossings.
- Pedestrian, emergency, utility, or future modal crossings.

Crossings must have stable identifiers, source metadata, geometry or location references, related asset identifiers, and validation evidence.

## 7. Intersection Ownership

Intersections belong to the Transportation Layer. Intersection records must identify related roads, corridors, segments, approaches, direction context, and relationship metadata.

Intersections must not be duplicated for each county, municipality, provider, or Experience Package.

## 8. Carriageway Ownership

Carriageways represent divided-road, side-of-road, lane-group, or directional roadway structures where needed. Carriageways belong to the Transportation Layer because they describe physical infrastructure.

Carriageway metadata may include:

- Parent corridor or road.
- Side or carriageway identity.
- Directional relationship.
- Geometry reference.
- Segment relationship.
- Applicable validation rules.

## 9. Direction Ownership

Direction models belong to the Transportation Layer. Direction may include northbound, southbound, eastbound, westbound, inbound, outbound, clockwise, counterclockwise, upstream, downstream, or locally meaningful directional models.

Directional Intelligence must reference Transportation-owned direction models. It must not invent presentation-only or provider-only direction ownership.

## 10. Continuous Regional Ownership

Transportation assets are continuous regional assets. County boundaries may annotate, filter, or contextualize a transportation asset, but they must not split ownership unless the physical transportation asset itself requires separately identified segments under the same corridor.

Continuity validation must prove that cross-county corridors remain relationship-driven rather than duplicated.

## 11. Shared Asset Philosophy

Gridly uses a shared asset philosophy:

- One corridor.
- One road asset.
- One rail asset.
- One crossing.
- One intersection.
- One direction model.
- Many community relationships.
- Many Intelligence Object relationships.
- Many Experience Package consumers.

Shared assets protect trust, reduce conflicting interpretations, and preserve the Intelligence Layer as the platform core.

## 12. No County Duplication

No Transportation Package may duplicate a corridor, road, rail asset, crossing, intersection, carriageway, or direction model solely because it crosses or touches a county boundary.

County-specific needs must be modeled through relationships, filters, administrative boundary metadata, or Experience consumption rules. Duplicated infrastructure is a validation failure unless explicitly approved by architecture governance for a physical asset reason.

## 13. Package Relationships

Transportation Packages may relate to:

- Community Packages for counties, municipalities, communities, Awareness Areas, and adjacency.
- Intelligence Packages for conditions, incidents, reports, alerts, provider records, trust, freshness, and lifecycle.
- Experience Packages for consumption eligibility and visualization references.
- Other Transportation Packages for corridor adjacency, crossings, shared segments, or regional continuity.
- Registry metadata for discovery and compatibility.

Relationships must not transfer ownership.

## 14. Validation Requirements

Transportation Package validation must confirm:

- Asset identifiers are stable, unique, and versioned.
- Corridor geometry is valid and source-traceable.
- Segment ordering is continuous and internally consistent.
- Roads and corridors are not duplicated by county.
- Rail assets and crossings are source-traceable.
- Intersections reference existing Transportation-owned assets.
- Carriageways and direction models are consistent with geometry.
- Community relationships point to Community-owned identities.
- Intelligence relationships point to Intelligence-owned objects.
- Experience relationships are consumption references only.
- No JavaScript, CSS, HTML, runtime, Supabase, UI, or behavior changes are required by the package.

## 15. Recommended Package Structure

```text
/transportation-packages/
  southeast-texas/
    corridors/
      <corridor-id>/
        package.json
        identity.json
        geometry/
          source/
          normalized/
          metadata.json
        roads/
          roads.json
        segments/
          segments.json
          ordering.json
        rail/
          rail.json
        crossings/
          crossings.json
        intersections/
          intersections.json
        carriageways/
          carriageways.json
        direction/
          direction-model.json
        relationships/
          communities.json
          intelligence.json
          experience.json
          corridors.json
        validation/
          checklist.md
          results.json
        certification/
          evidence.md
          status.json
        production/
          release-notes.md
          rollback.md
```

This structure is a future implementation contract only.

## 16. Future Corridor Examples

Future Transportation Packages may include:

- US 90 regional corridor.
- SH 146 regional corridor.
- I-10 Southeast Texas corridor.
- US 59/I-69 regional corridor.
- SH 105 regional corridor.
- FM and local road networks where regional awareness requires them.
- Rail corridors and road-rail crossings across Southeast Texas.
- Future evacuation, freight, school, emergency, or weather-sensitive corridors.

Each future corridor must remain a shared regional transportation asset with relationship-driven community and intelligence context.
