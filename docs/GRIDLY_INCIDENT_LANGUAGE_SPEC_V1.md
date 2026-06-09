# GRIDLY INCIDENT LANGUAGE SPEC V1

## Purpose
Establish one permanent location-language contract for all customer-facing incident wording in Gridly.

## Scope and Constraints
- This is a **specification only**.
- Do **not** change application behavior as part of this spec.
- Do **not** modify `js/app.js`.
- Do **not** alter rendering, routing, alert logic, or backend code.

## Core Principle
Gridly wording must sound like how one local driver would explain a problem to another local driver.

Guiding question:

> "Where is it and does it affect me?"

Never expose raw/internal data structures.

Never expose:
- `PRIVATE`
- `UNKNOWN`
- `UNNAMED`
- `DAYTON AREA`
- `LIBERTY COUNTY`
- `AREA`
- `REGION`
- `LOCAL AREA`
- `COMMUNITY AREA`
- `CITY AREA`
- `TOWN AREA`
- placeholder values
- `null`
- `undefined`
- duplicate wording

Bad examples:
- "Flooding on Winfree Street & US 90 near WINFREE STREET"
- "Crossing blocked at PRIVATE"
- "Crossing blocked near Dayton area"

Good examples:
- "Flooding on Winfree Street near US 90"
- "Flooding on TX 146 between Moller Street and US 90"
- "Crossing blocked at US 90 and Waco"
- "Crossing blocked near FM 1409"
- "Crossing blocked nearby"

---

## Road Hazard Language Contract

Priority hierarchy:

### Tier 1 — Segment wording (preferred)
Format:

```text
{hazardType} on {primaryRoad} between {referenceRoadA} and {referenceRoadB}
```

Examples:
- Flooding on TX 146 between Moller Street and US 90
- Construction on FM 1409 between CR 676 and FM 1008
- Road closed on Winfree Street between Main Street and US 90

### Tier 2 — Near wording
Format:

```text
{hazardType} on {primaryRoad} near {referenceRoad}
```

Examples:
- Flooding on TX 146 near Moller Street
- Road closed on Winfree Street near US 90

### Tier 3 — Directional wording (future capability)
Format:

```text
{hazardType} on {primaryRoad} east/west/north/south of {referenceRoad}
```

Examples:
- Flooding on TX 146 east of Moller Street

### Tier 4 — Last resort
Format:

```text
{hazardType} on {primaryRoad}
```

Example:
- Flooding on TX 146

---

## Rail Crossing Language Contract

Priority hierarchy:

### Tier 1
Format:

```text
Crossing blocked at {primaryRoad} and {secondaryRoad}
```

Example:
- Crossing blocked at US 90 and Waco

### Tier 2
Format:

```text
Crossing blocked near {referenceRoad}
```

### Tier 3
Format:

```text
Crossing blocked nearby
```

---

## Duplicate Suppression Rules

If:
- `primaryRoad == referenceRoad`
- OR normalized values match

Then: suppress duplicates.

Bad:
- Flooding on Winfree Street & US 90 near WINFREE STREET

Good:
- Flooding on Winfree Street near US 90
- Flooding on Winfree Street between US 90 and Main Street

---

## Reference Road Quality Rules

Preferred references:
- intersections
- cross streets
- highways
- FM roads
- county roads
- named local roads

Avoid:
- generic areas
- duplicate road names
- placeholder labels
- city names unless absolutely necessary

---

## Directional Impact Language V1

### Purpose
Provide users with useful travel direction context without making headlines excessively long.

### Core principle
Headlines describe location.

Secondary text describes movement impact.

Avoid overloaded headlines.

Bad:
- Flooding eastbound on US 90 near Winfree Street
- Train blocking westbound northbound traffic near Waco

Preferred pattern:

Headline:
- Flooding on US 90 near Winfree Street

Secondary:
- Eastbound impact likely

Headline:
- Train blocking US 90 at Waco

Secondary:
- Westbound delays building

---

## Confidence Model

### High confidence
Conditions:
- known route geometry
- route segment orientation
- route direction data available
- route watch data available

Examples:
- Eastbound affected
- Westbound affected
- Northbound affected
- Southbound affected

### Medium confidence
Conditions:
- road orientation known
- corridor orientation known

Examples:
- Eastbound impact likely
- Northbound impact likely

### Low confidence
Conditions:
- intersection only
- isolated point
- insufficient geometry

Examples:
- Traffic impact possible
- Both directions may be affected

---

## Road Orientation Examples

US 90:
- Primary orientation: East / West

TX 146:
- Primary orientation: North / South

FM roads:
- Use geometry-based determination

Local streets:
- Use geometry if available
- Otherwise use: Both directions may be affected

---

## Future Mobility Intelligence (not implemented)

Examples:
- Flooding on TX 146 between Moller Street and US 90
  - Southbound impact likely
- Train blocking US 90 at Waco
  - Westbound delays building
- Road closed on FM 1409 near CR 676
  - Northbound traffic affected

---

## Protected Systems

Do not alter:
- V158.2 crossing context
- V160 road hazard intelligence
- V162 quality filtering
- V163 segmentation logic
- V164 crossing references
- Supabase sync
- Alerts rendering
- Route logic
- Desktop
- Tactical landscape
- Marker ownership
- Popup ownership
- Top strip

---

## Known Bad Ideas / Do Not Reintroduce
- Raw internal labels
- Parallel wording systems
- Duplicate wording generation
- Multiple ownership chains
- Generic area fallbacks
- Overwriting incident wording in downstream renderers

---

## Deliverable
Update markdown document only. No application behavior changes.
