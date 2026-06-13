# Gridly V287 — Live TxDOT Direction Coverage Measurement Audit

**Branch:** `V287-LIVE-TXDOT-DIRECTION-COVERAGE-MEASUREMENT`  
**Audit date:** 2026-06-13 UTC  
**Scope:** Audit only. No directional display, labels, UI, alerts, hazard popups, Route Watch, markers, reporting, Supabase, or production behavior changes.

## 1. Executive Summary

V287 was intended to move the TxDOT direction work from feasibility and validation design into a live-production-data coverage measurement. The codebase confirms that Gridly's TxDOT ingestion contract is ready to preserve official `travel_direction` evidence when a DriveTexas conditions feed is available: raw GeoJSON feature properties are extracted with geometry, `travel_direction` is normalized into `direction`, `route_name` / `roadway` / `from_limit` / `to_limit` are retained, and unified incident construction can carry the normalized direction forward.

However, this audit environment does **not** include a configured DriveTexas API key, and direct unauthenticated attempts to fetch the live DriveTexas conditions endpoint were blocked. TxDOT's own API documentation states that current conditions are requested as `/api/conditions.{filetype}?key={api_key}` and that API access is subject to key approval. Therefore, V287 could not lawfully or technically review a live incident sample from this environment.

**Primary answer:** live TxDOT directional coverage is **not measurable from the current environment**. The implementation path remains plausible because V286's pipeline discovery is real, but pilot planning cannot be justified on actual coverage rates until Gridly runs this audit with an approved DriveTexas API key or a sanctioned export of the same feed.

**Final recommendation:** **B. Partial Direction Data Exists But Additional Validation Needed.** The data contract contains the right direction-bearing fields, but the live coverage rate, Liberty County volume, and corridor-level sufficiency remain unproven.

## 2. Live TxDOT Direction Coverage Results

### Live data access result

| Item | Result |
| --- | ---: |
| DriveTexas API key present in environment | No |
| Live `conditions.geojson` fetch completed | No |
| Fetch blocker | `403 Forbidden` / unauthenticated protected endpoint |
| Official access requirement | API calls require `key={api_key}` |
| Official feed refresh cadence | Every 5 minutes |
| Production behavior changed | No |
| UI / alerts / marker behavior changed | No |

### Measurement counters

Because no live feed payload was accessible, the only honest live-sample counters are zero reviewed records, not zero coverage in TxDOT itself.

| Metric | Count | Percentage | Interpretation |
| --- | ---: | ---: | --- |
| Total incidents reviewed | 0 | N/A | No sanctioned live payload was available. |
| Total Liberty County incidents reviewed | 0 | N/A | County filtering could not be performed. |
| Incidents containing `travel_direction` | 0 | N/A | Not measurable. |
| Incidents containing `direction` | 0 | N/A | Not measurable. |
| Incidents where `direction != unknown` | 0 | N/A | Not measurable. |
| Incidents missing direction | 0 | N/A | Not measurable. |
| Incidents containing `from_limit` | 0 | N/A | Not measurable. |
| Incidents containing `to_limit` | 0 | N/A | Not measurable. |
| Incidents containing `route_name` | 0 | N/A | Not measurable. |
| Incidents containing `roadway` | 0 | N/A | Not measurable. |
| Incidents containing usable geometry | 0 | N/A | Not measurable. |

**Coverage summary:** V287 cannot claim a live percentage. The correct coverage answer is **unknown pending authorized feed access**, not 0%.

## 3. Liberty County Direction Inventory

No Liberty County TxDOT rows were available for review. The inventory below is intentionally marked `N/A` rather than inferred from code or historical assumptions.

| Category | Incident count | Direction count | Unknown count | Direction percentage | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Crash | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Closure | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Construction | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Flooding | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Congestion | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Hazard | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Maintenance | 0 | 0 | 0 | N/A | Not measurable without live rows. |
| Other conditions | 0 | 0 | 0 | N/A | Not measurable without live rows. |

**Strongest directional evidence category:** undetermined. A future rerun should rank categories by the share of rows where `travel_direction` normalizes to `NB`, `SB`, `EB`, `WB`, `NB/SB`, or `EB/WB` and where route and geometry evidence are present.

## 4. Corridor Coverage Table

| Corridor | Total incidents | Directional incidents | Unknown-direction incidents | Direction coverage % | Geometry availability | `from_limit` availability | `to_limit` availability | Classification |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| US 90 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| TX 146 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| TX 321 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| US 59 / I-69 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| FM 1960 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| FM 1409 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |
| FM 1011 | 0 | 0 | 0 | N/A | N/A | N/A | N/A | D. No measurable directional coverage |

**Important distinction:** these `D` classifications mean **no meaningful coverage was measurable in this audit run**, not that those corridors lack TxDOT directional data in the real feed.

## 5. Sample Record Review

No representative live records were available. To avoid fabricating evidence, V287 does not provide route-level examples.

| Corridor | `route_name` | `roadway` | `condition` | `travel_direction` | `from_limit` | `to_limit` | Geometry availability |
| --- | --- | --- | --- | --- | --- | --- | --- |
| US 90 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| TX 146 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| TX 321 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| US 59 / I-69 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| FM 1960 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| FM 1409 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |
| FM 1011 | N/A | N/A | N/A | N/A | N/A | N/A | N/A |

## 6. Display-Gate Simulation Results

This is a simulation only. No display gate was implemented.

### A. Source Direction Requirement

Requirement: `travel_direction` exists, or an equivalent official direction exists.

| Scope | Incidents satisfying source direction | Total reviewed | Pass rate |
| --- | ---: | ---: | ---: |
| Live TxDOT sample | 0 | 0 | N/A |

### B. Geometry Compatibility Requirement

Requirement: source direction exists, usable geometry exists, and corridor match exists.

| Scope | Incidents satisfying source + geometry + corridor | Total reviewed | Pass rate |
| --- | ---: | ---: | ---: |
| Live TxDOT sample | 0 | 0 | N/A |

### C. Future Display Gate Potential

A future display gate is technically plausible because Gridly's TxDOT normalizer already retains the fields needed to perform the simulation. It is not operationally justified until a live feed run shows enough rows that pass source, geometry, and corridor checks.

## 7. US 90 Pilot Readiness Assessment

| Measure | Result |
| --- | --- |
| Incident volume | Unknown |
| Direction coverage | Unknown |
| Geometry coverage | Unknown |
| Validation readiness | Contractually plausible, not coverage-proven |
| Classification | **B. Promising but additional validation required** |

**Rationale:** US 90 remains the most realistic popup-only candidate from a validation-design perspective because it is primarily an east/west corridor in the intended pilot context. But V287 found no live sample to prove incident volume or `travel_direction` coverage.

## 8. TX 146 Pilot Readiness Assessment

| Measure | Result |
| --- | --- |
| Incident volume | Unknown |
| Direction coverage | Unknown |
| Geometry coverage | Unknown |
| Overlap risk | High where TX 146 shares or intersects complex corridor context |
| Validation readiness | Requires route/segment disambiguation before display |
| Missing requirements | Live direction coverage, segment validation, overlap handling |
| Remaining blockers | No measured feed sample; divided/overlap ambiguity unresolved |
| Path-to-ready | Run authorized live coverage audit, then corridor segment validation audit |
| Classification | **B. Promising but additional validation required** |

## 9. TX 321 Pilot Readiness Assessment

| Measure | Result |
| --- | --- |
| Incident volume | Unknown |
| Direction coverage | Unknown |
| Geometry coverage | Unknown |
| Overlap risk | Moderate; still requires local segment validation |
| Validation readiness | Requires measured live coverage and corridor snap checks |
| Missing requirements | Live direction coverage, geometry/corridor match proof |
| Remaining blockers | No measured feed sample; no segment-level pilot evidence |
| Path-to-ready | Run authorized live coverage audit, then segment validation for TX 321 |
| Classification | **B. Promising but additional validation required** |

## 10. Directional Evidence Quality Scorecard

| Evidence source | Score | Justification |
| --- | ---: | --- |
| TxDOT `travel_direction` | 3 — Moderate | The field is recognized and normalized by Gridly, but live coverage frequency is unmeasured in this audit. |
| TxDOT geometry | 3 — Moderate | The GeoJSON path can expose feature geometry and Gridly derives midpoint coordinates; full retained geometry and carriageway confidence are not proven for display. |
| `from_limit` / `to_limit` | 3 — Moderate | The service retains and humanizes limits, but live availability and validation value are unmeasured. |
| Route naming | 4 — Strong | `route_name` and `roadway` are part of the normalizer's intended preserved contract. |
| Corridor identity | 3 — Moderate | Route display names support corridor identity, but overlap/alias validation remains required. |
| Unified incident retention | 4 — Strong | V286-era code paths indicate normalized direction/route context can survive into in-memory incident objects. |

## 11. Shortest Path To Directional Awareness

Ranked by shortest realistic path:

1. **Additional Data Collection Required** — Required first. Run this exact audit with an approved DriveTexas API key or approved exported conditions payload.
2. **US 90 Popup Pilot Planning** — Most realistic pilot candidate after live coverage is proven, because the corridor's expected EB/WB use case is simpler than overlap-heavy candidates.
3. **US 59 / I-69 Popup Pilot** — Potentially strong if the live feed has high volume and geometry, but it introduces freeway/divided-road complexity and should not precede data measurement.
4. **TX 146 Segment Pilot** — Possible only after overlap and segment validation.
5. **TX 321 Segment Pilot** — Possible only after measured direction volume and segment validation.

**Recommended next step:** perform an authorized live feed measurement run, save sanitized aggregate counts, then decide whether US 90 popup planning is justified.

## 12. Recommended Next Milestone

**V288 — Authorized TxDOT Direction Coverage Measurement Rerun**

V288 should repeat V287 with one of the following sanctioned inputs:

- A configured, approved DriveTexas API key in local development or CI secrets.
- A timestamped, sanitized export of `/api/conditions.geojson` obtained by an approved Gridly/TxDOT account.
- A replay fixture derived from the approved feed with sensitive or nonessential details removed.

V288 should not build display behavior. It should only produce aggregate coverage by county, condition category, and corridor, plus sanitized representative samples.

## 13. Final Recommendation

**B. Partial Direction Data Exists But Additional Validation Needed**

Gridly has enough pipeline support to continue directional pilot research, but V287 could not verify real-world live coverage. The shortest safe path is not to implement labels; it is to obtain authorized live feed access and rerun this measurement audit before any US 90, TX 146, or TX 321 pilot planning decision.

## Audit Commands And Sources

Commands run from `/workspace/liberty-county-map`:

```bash
pwd && rg --files -g 'AGENTS.md' -g 'package.json' -g '*.md' | sed -n '1,80p'
find .. -name AGENTS.md -print
rg -n "travel_direction|txdot|TxDOT|from_limit|to_limit|route_name|unified" -S --glob '!node_modules/**' | sed -n '1,200p'
rg -n "GRIDLY_TXDOT|apiKey|drivetexas|conditions.geojson" -S --glob '!node_modules/**' --glob '!*.map' . | sed -n '1,200p'
env | sort | rg -n "TXDOT|GRIDLY|SUPABASE|DRIVE|API|KEY" | sed -n '1,200p'
python3 - <<'PY'
from urllib.request import urlopen, Request
from urllib.error import HTTPError
url='https://api.drivetexas.org/api/conditions.geojson'
try:
 with urlopen(Request(url,headers={'User-Agent':'GridlyAudit/1.0'}),timeout=20) as r:
  print(r.status, r.geturl(), r.read(500))
except HTTPError as e:
 print('HTTP', e.code, e.read(500))
except Exception as e:
 print('ERR',type(e).__name__,e)
PY
curl -L --max-time 20 -A 'Mozilla/5.0' -i 'https://api.drivetexas.org/api/conditions.geojson?key=' | head -c 1000
```

External official source checked:

- DriveTexas API documentation: `https://api.drivetexas.org/api-docs`
