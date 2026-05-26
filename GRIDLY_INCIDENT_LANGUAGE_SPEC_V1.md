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

## Future Mobility Intelligence (not implemented)

Examples:
- Flooding on TX 146 between Moller Street and US 90. Affecting southbound traffic.
- Train blocking US 90 at Waco. Traffic delays building westbound.

---

## Protected Systems

Do not alter:
- V158.2 local crossing context
- V160 road hazard intelligence
- Supabase sync
- Alerts rendering
- Report flow
- Route logic
- Desktop architecture
- Tactical landscape
- Popup ownership
- Hazard ownership
- Portrait V2 ownership
- Marker render ownership

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
Create markdown document only. No application code changes.
