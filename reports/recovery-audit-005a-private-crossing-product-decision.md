# Gridly Recovery Audit 005A — Private-crossing product-decision breakdown

## Executive answer and audit correction

**The certified package data does not contain 4,835 source-private `PUBLIC_ROADWAY` rows. It contains 4,826.** The 4,835 figure in Audit 005 resulted from subtracting all 67 `PRIVATE_ROAD` rows from 4,902, without also subtracting seven private `INDUSTRIAL`, one private `RAIL_YARD`, and one private `TEMPORARY_ACCESS` row. Thus:

`4,902 = 4,826 PUBLIC_ROADWAY + 67 PRIVATE_ROAD + 7 INDUSTRIAL + 1 RAIL_YARD + 1 TEMPORARY_ACCESS`.

This report corrects that arithmetic rather than forcing the requested premise. The “non-public 67” is likewise **76 source-private rows**, while 67 is only the `PRIVATE_ROAD` subset. Statewide there are 79 non-`PUBLIC_ROADWAY` rows because three additional `INDUSTRIAL` rows have source `TYPEXING=Public`.

The direct reason 4,826 private records become `PUBLIC_ROADWAY` is the manufacture fallback in `tools/lp115/manufacture-candidate-crossings.mjs::classifyFeature`: preserve an inherited value only if it is one of five allowlisted Gridly classes; otherwise assign `PUBLIC_ROADWAY`. It does **not** inspect `TYPEXING`, `XPURPOSE`, `PRVCAT`, `POSXING`, `HIGHWAY`, or `STREET` for classification. `STREET`, then `HIGHWAY`, is used separately for display name only.

Accordingly, current `PUBLIC_ROADWAY` means **D — Gridly's production/consumer visibility class (with a permissive default)**. It does not establish legal/public ownership (A), public use (B), or even reliably establish vehicle-road use (C): 34 private `XPURPOSE=2` pedestrian/pathway records and many yard/internal records can carry it.

No runtime, package, filter, marker, manifest, count, or governed inventory was changed. The two evidence files and this report are audit-only.

## 1–2. Why normalization produces `PUBLIC_ROADWAY`, and its exact semantics

| Stage / precedence | File and function | Fields read | Rule / fallback | Consequence |
|---|---|---|---|---|
| 1. Package manufacture | `tools/lp115/manufacture-candidate-crossings.mjs`, `classifyFeature` | existing `properties.gridlyClassification` only for class; `CROSSING`; separately `STREET`, then `HIGHWAY` for display | Preserve only an allowlisted inherited class; otherwise default to `PUBLIC_ROADWAY` | No ownership or purpose derivation; most authoritative FRA rows default public |
| 2. Package adapter | `js/gridlyCrossingPackageAdapter.js`, `normalizeCrossing` | copies all properties; `STREET → HIGHWAY → road_name → roadName → name` for road name | No class derivation; raw uppercase fields survive inside copied properties | Manufacture class survives unchanged; name precedence is unrelated to access |
| 3. Consumer normalization | `js/app.js`, `normalizeGridlyCrossingFeatures` | adapted properties | Preserves source properties in `props`; does not reinterpret authoritative access fields | `TYPEXING` remains metadata only |
| 4. Location Context selector | `js/app.js`, `gridlyCrossingSatisfiesConsumerVisibilityPolicy` / `gridlySelectConsumerVisibleCrossings` | `gridlyClassification`, then `props`, then `properties` | blank or `PUBLIC_ROADWAY` passes; then launch, county, reportability, awareness ownership and identity de-duplication gates apply | A source-private row labelled public can be counted |
| 5. Marker selector | `js/app.js`, `isGridlyPublicRoadwayCrossing` and marker filtering | same Gridly class locations | missing class defaults `PUBLIC_ROADWAY`; only blank/public passes, plus reportability and map visibility rules | Same semantic gate, but marker count also varies by zoom/viewport/cap |

There is no branch in this precedence chain where `TYPEXING=Private` is consulted. `XPURPOSE`, `PRVCAT`, and uppercase `POSXING` are also not classification inputs. This is a **defaulted application visibility label**, not a source-derived legal or access assertion.

## 3. Complete private combination matrix

The complete descending matrix is [`recovery-audit-005a-private-combination-matrix.csv`](./recovery-audit-005a-private-combination-matrix.csv): **179 unique meaningful combinations across all 4,902 rows**, with no rare-row collapse. Its columns are exactly statewide count, `TYPEXING`, `XPURPOSE`, `PRVCAT`, `POSXING`, `HIGHWAY` value category, `STREET` value category, and Gridly class.

Value categories are deterministic and overlapping where evidence overlaps: `BLANK`, `PLACEHOLDER/UNKNOWN`, `PRIVATE`, `PUBLIC_ROAD`, `INDUSTRIAL`, `FARM`, `YARD/RAIL_ONLY`, `SERVICE/ACCESS`, `DRIVEWAY`, `RESIDENTIAL`, `COMMERCIAL`, and `NAMED/UNSPECIFIED`. Composite values such as `PRIVATE+INDUSTRIAL` preserve multiple signals. The CSV is the raw distribution required for decisions; no `OTHER` row is used. Machine-readable combinations, samples, and totals are also in `recovery-audit-005a-private-crossing-evidence.json`.

## 4. Private purpose distribution

The repository has no bundled authoritative decoding table for `PRVCAT`, and Audit 005 found only numeric `XPURPOSE` values. Therefore this table preserves codes and distinguishes code-supported categories from conservative road-name evidence. It does not claim that name evidence is authoritative purpose.

| Purpose category | Source-native evidence | Count |
|---|---|---:|
| Ordinary/unspecified highway purpose | `XPURPOSE=1`, with no narrower name evidence | 4,509 |
| Farm/agricultural | `XPURPOSE=1`; `STREET`/`HIGHWAY` farm, field, ranch or agricultural evidence | 116 |
| Rail yard/facility | `XPURPOSE=1`; yard or railroad-use-only name evidence | 111 |
| Industrial | `XPURPOSE=1`; industrial/plant/mill/mine/quarry/chemical/refinery/terminal name evidence | 69 |
| Pedestrian/pathway | `XPURPOSE=2` | 34 |
| Private driveway | `XPURPOSE=1`; driveway/drive/entrance name evidence | 32 |
| Maintenance/service/access | `XPURPOSE=1`; maintenance/service/access/haul/temp/construction name evidence | 22 |
| Station | `XPURPOSE=3` | 5 |
| Residential | `XPURPOSE=1`; residential/home/house/subdivision/apartment name evidence | 3 |
| Commercial | `XPURPOSE=1`; commercial/store/shop/business name evidence | 1 |

These rules are mutually exclusive in the order shown by the audit script. “Unknown” is not invented as a purpose code: the 4,509 ordinary/unspecified rows are explicitly reported as insufficiently narrowed within `XPURPOSE=1`.

## 5. Complete non-public source-private breakdown (76, not 67)

All classes below remain in governed inventory. Current consumer visibility, Location Context inclusion, and individual marker eligibility are **No** because the common class gate accepts only blank/`PUBLIC_ROADWAY`; no additional hypothetical policy is applied.

| Gridly class | Count | Source-combination summary | Representative record | Consumer / Context / marker |
|---|---:|---|---|---|
| `PRIVATE_ROAD` | 67 | Full combinations are in JSON; overwhelmingly `TYPEXING=Private`, `XPURPOSE=1`, with varied `PRVCAT`/position/name evidence | FRA 762801W, Chambers; `STREET=Private`, `HIGHWAY=NA`, `PRVCAT=14`, at grade | No / No / No |
| `INDUSTRIAL` | 7 | Private, purpose 1; explicit/manual Gridly industrial class, with varied source names | FRA 748392X, Liberty; `PRIVATE HUNTSMAN`, `HIGHWAY=NA`, `PRVCAT=14`, at grade | No / No / No |
| `RAIL_YARD` | 1 | Private, purpose 1, `PRVCAT=14`, at grade, yard name | FRA 930212V, Liberty; `STREET=RRYARD`, `HIGHWAY=PRIVATE` | No / No / No |
| `TEMPORARY_ACCESS` | 1 | Private, purpose 1, `PRVCAT=14`, at grade, temporary haul-road name | FRA 975462J, Liberty; `Temp Haul Road TX 99`, `HIGHWAY=NA` | No / No / No |

The evidence JSON supplies every distinct source combination and three samples per class, not merely the representatives above.

## 6. Road/street and access evidence among the 4,826 private `PUBLIC_ROADWAY` rows

| Presence | Count |
|---|---:|
| Both nonblank `STREET` and nonblank `HIGHWAY` | 4,406 |
| `STREET` only | 420 |
| `HIGHWAY` only | 0 |
| Neither | 0 |

“Nonblank” does not mean useful or public: `NA`, `PRIVATE`, and “Not Yet Reported by State” are values. Text-evidence counts (overlapping, so they do not sum to 4,826) are: private access/road 4,244; public-road/access 65; industrial access 71; driveway 36; service/access 25. The source has no dedicated public-access, restricted-access, industrial-access, driveway, or service-road field in the governed schema. `TYPEXING` is the dedicated public/private designation, and all rows in this subset say Private. No distinct “restricted access” term was found by the declared evidence rules.

## 7–11. Proposed owner decision groups

These buckets partition all 4,902 source-private rows. They are conservative proposals based only on available code, codes, and text. They are **not implemented**.

| Group | Statewide | Harris | Dallas | Travis | Liberty | Source rule | Current normalized behavior |
|---|---:|---:|---:|---:|---:|---|---|
| **1 — Clearly user-facing** | 33 | 0 | 0 | 0 | 0 | Explicit public/county/city/numbered-highway road evidence, without private text, despite `TYPEXING=Private` | 33 `PUBLIC_ROADWAY`; included subject to downstream gates |
| **2 — Likely user-facing** | 848 | 82 | 27 | 17 | 2 | A meaningful named `STREET` or `HIGHWAY`, no Group 3/4 signal; evidence suggests roadway relevance but does not prove public access | 847 public, 1 private-road; class gate includes 847 |
| **3 — Likely not user-facing** | 240 | 24 | 9 | 1 | 1 | Industrial, farm, service/access/haul/temp, or driveway text | 238 public, 1 private-road, 1 temporary-access; current gate includes 238 |
| **4 — Clearly not user-facing** | 146 | 15 | 6 | 3 | 1 | `XPURPOSE=2` pedestrian/pathway, or explicit yard/rail-only text | 145 public, 1 rail-yard; current gate includes 145 |
| **5 — Ambiguous** | 3,635 | 153 | 58 | 11 | 32 | Generic private, placeholder, unknown, station, residential/commercial, or otherwise insufficient evidence after Groups 1–4 | 3,563 public, 65 private-road, 7 industrial; current gate includes 3,563 |

Representative records:

* **Group 1:** 795844G, Bowie — `bowie Parkway` / `county road`.
* **Group 2:** 970869H, Anderson — `UNNAMED ROAD` / `PRIVATE` (roadway-shaped but access-private, hence only likely).
* **Group 3:** 970866M, Anderson — `FARM ROAD` / `PRIVATE`.
* **Group 4:** 440977S, Anderson — `ALL PRIVATE IN Yard - PALESTINE` / `NA`.
* **Group 5:** 970868B, Anderson — `PRIVATE` / `PRIVATE`, insufficient to distinguish a driver-relevant private road from internal access.

Group 1 is intentionally narrow. Group 5 is intentionally large because the data does not safely support the requested consumer judgment. `POSXING=RR Over/RR Under` is not itself used to decide ownership or user relevance.

## 12–15. Certified-count effects

### Governed county contributions

The governed totals remain Harris 1,159, Dallas 789, Travis 176, and Liberty 115. Their private group contributions are the county columns above. If Groups 3 and 4 were excluded from presentation, the maximum county-wide reductions from current public-class rows would be Harris 39 (to 1,120), Dallas 15 (to 774), Travis 4 (to 172), and Liberty 0 (remains 115; its Group 3/4 rows are already non-public-class). These are class-policy arithmetic, not runtime changes.

### Awareness-area diagnostics

The static packages do not persist the exact membership IDs behind the certified awareness counts. Consequently it is not defensible to assert exact revised certified counts. Consistent with Audit 005, the table uses the reproducible nearest-anchor composition diagnostic over exactly the certified number of records. It answers the hypothetical while labeling its limitation.

| Area | Certified baseline | Private G1 | G2 | G3 | G4 | G5 | Diagnostic baseline minus G3+G4 |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baytown | 70 | 0 | 6 | 0 | 1 | 5 | **69** |
| Dallas | 417 | 0 | 16 | 7 | 3 | 32 | **407** |
| Austin | 135 | 0 | 8 | 0 | 2 | 6 | **133** |
| Liberty | 30 | 0 | 1 | 0 | 0 | 5 | **30** |

Exact production answers require a read-only capture of the browser selector's 70/417/135/30 FRA IDs and a join to this evidence. Until then, 69/407/133/30 are diagnostics, **not recertified counts**.

## 16. Option A / B / C comparison

| Option | Advantages | Risks | Statewide and local impact |
|---|---|---|---|
| **A — Show/count every governed roadway crossing** | Simple; inventory and UI are easy to reconcile; maximizes warning coverage | “Roadway” remains undefined; exposes private yards, pedestrian paths, farms and internal access; could show all 16,099 if literally every governed row, versus today's 16,020 public-class ceiling | Statewide +79 versus current class gate if literal. Governed county totals remain 1,159/789/176/115. Awareness counts could remain 70/417/135/30 only if certified membership is retained; otherwise must be recertified |
| **B — Exclude clearly private/non-user-facing from marker and Context** | Marker/count semantics align; removes the strongest false-positive evidence | A source name can be stale or incomplete; ambiguous majority remains; needs an owner definition and recertification | Proposed G3+G4 contains 386 private rows, of which 383 currently have public class. Maximum current-class statewide ceiling 16,020→15,637. County ceiling diagnostics: Harris 1,120; Dallas 774; Travis 172; Liberty 115. Awareness diagnostic: 69/407/133/30 |
| **C — Count ambiguous/private awareness but mark only clearly user-facing** | Preserves broad situational awareness while reducing map clutter and implied public access | Marker/count divergence is harder to explain; “crossings watched” may include inaccessible locations; marker absence may look like a defect | Location Context can stay at current 70/417/135/30. G3–G5 contain 4,021 source-private rows; 3,946 currently carry `PUBLIC_ROADWAY` and are the maximum statewide marker-class impact. Exact viewport marker impact is session-dependent |

## 17. Owner decision table

| Decision | Evidence | Recommended disposition before code |
|---|---|---|
| What should `PUBLIC_ROADWAY` mean? | Today it is an allowlisted/default visibility class, not legal ownership | Rename the product concept in a policy specification before changing data |
| Trust `TYPEXING=Private` as an automatic exclusion? | 4,902 rows; some have meaningful named/numbered road evidence | No blanket exclusion without defining whether Gridly serves drivers on private roads |
| Exclude Group 4? | 146 pedestrian/pathway or explicit yard/rail-only rows; 145 currently pass | Strongest first owner decision; validate `XPURPOSE=2` against an authoritative FRA codebook |
| Exclude Group 3? | 240 rows with farm/industrial/service/driveway text; 238 currently pass | Review samples and text lexicon, then approve as a separate rule from Group 4 |
| Include Group 5? | 3,635 ambiguous rows dominate the issue | Do not silently classify; decide fail-open count versus fail-closed markers explicitly |
| Keep marker and count aligned? | Option B is consistent; Option C separates awareness from map claims | Choose the user promise first, then certify both surfaces |
| Change production now? | Exact awareness membership IDs are not persisted in static audit data | **No. Stop before filters**, capture IDs, attach codebook, then recertify hypotheticals |

## 18. Recommended next product decision

Adopt a written two-axis model before any implementation: **source access** (`Public`, `Private`, unknown) separate from **consumer relevance** (vehicle roadway, pedestrian, station, internal/yard, ambiguous). Approve Group 4 as the first validation cohort, but do not filter it until the authoritative `XPURPOSE`/`PRVCAT` definitions and exact awareness membership IDs are attached. Then decide whether the product promise is Option B (recommended for semantic consistency) or Option C (only if UI copy explicitly explains that counted locations may have no marker).

Do not treat `gridlyClassification=PUBLIC_ROADWAY` as proof of public ownership or public access. Do not regenerate packages or modify filters until the owner has approved definitions, exact cohorts, marker/count alignment, and new certified counts.

## Reproduction

Run `python3 scripts/audit-crossing-classifications.py`. It reads the 254 production packages, writes the JSON and complete CSV, and does not touch runtime artifacts. Bucket and term matching rules are declared as auditable regular expressions at the top of the script.
