# GRIDLY V708 — Directional Awareness Product Decision Package

## Executive Summary

GRIDLY V708 is a product strategy and decision package for the Directional Awareness Layer. It authorizes no runtime behavior changes, no UI changes, no directional rendering changes, no routing changes, and no navigation changes.

The validated product problem is that directional intelligence exists and passes service-level protections, but it is not retained in the final user-visible Awareness Brief. Because Gridly remains **Awareness Platform First** and **Route Intelligence Second**, the recommended future direction is **Option A — Incident Context Enhancement**: directional awareness should become incident context when, and only when, it is attached to an active condition.

Final V708 determination: **do not keep directional awareness permanently hidden, do not add an always-on secondary awareness line, do not create a separate current awareness surface, and do not treat service-only deferral as the product target. Directional awareness should become incident context in a future authorized implementation package.**

## Current State

- Directional candidates exist.
- Current directional candidate count: `164`.
- Directional service behavior is validated.
- Containment protection passes.
- Bearing protection passes.
- Fail-closed protection passes.
- Directional awareness is not retained in the final user-visible Awareness Brief.
- Current production visibility state:
  - `candidateCount > 0`
  - `visibleDirectionalCards: 0`
  - `userVisible: false`
  - `candidateVisibilityMismatch: true`

## Validated Findings

Directional intelligence has crossed the threshold from feasibility into validated internal capability, but it has not crossed into durable user-facing awareness value. The remaining question is not whether directional metadata can be computed; it is where that metadata belongs in the product ownership model.

The key ownership finding is that initial directional rendering is displaced by the later localized-intelligence hydration path. Therefore, any future implementation must first resolve product ownership and language strategy rather than adding another rendering attempt.

## V704 Findings

V704 implemented the Directional Awareness Layer and established that directionally meaningful candidates can be produced from the available road intelligence inputs. The V704 outcome moved directional awareness from design intent into an implemented layer.

Product implication: the capability exists, but implementation alone did not define final Awareness Brief ownership.

## V705 Findings

V705 corrected visibility auditing so the program could distinguish between internal directional candidate generation and actual user-visible retention. This made the mismatch measurable instead of inferred.

Product implication: candidate existence is not the same as awareness delivery.

## V706 Findings

V706 identified the final ownership chain. Directional awareness renders initially, but `refreshPortraitV2LocalizedIntelligence()` later hydrates active incident/community awareness and becomes the final Awareness Brief owner. The localized-intelligence path displaces directional awareness.

Product implication: the correct future design must either integrate directional language into the localized-intelligence owner or intentionally place it outside that owner.

## V707 Findings

V707 realigned test expectations with the validated production behavior. Directional candidates can exist while visible directional cards remain at zero, and that state is now understood as the current product behavior rather than a service failure.

Product implication: the current state is a product decision gap, not a directional service defect.

## Option Analysis

### Option A — Incident Context Enhancement

**Concept:** Directional awareness appears only when attached to an active condition.

Examples:

- Disabled Vehicle — US 90 Westbound near Waco Street
- Flooding — FM 1960 Eastbound near Dayton
- Train Blocking Crossing — TX 146 Southbound

**Evaluation:**

- **Mission Alignment:** High. It supports “Know Before You Go” by making active awareness more precise without making route intelligence the primary product.
- **Awareness Value:** High. Direction is most valuable when tied to a condition a user may encounter.
- **User Comprehension:** High. Users understand direction best when paired with a specific road condition.
- **Ownership Complexity:** Medium. The localized-intelligence owner must accept directional context as part of incident/community awareness language.
- **UI Complexity:** Low to Medium. It can reuse existing Awareness Brief surfaces if wording is concise.
- **County Scalability:** High. County-specific road labels can remain governed by existing containment and resolver patterns.
- **Future Route Intelligence Compatibility:** High. Incident-bound direction can later inform route impact without becoming routing behavior now.
- **Future Destination Intelligence Compatibility:** High. Directional incident context can later help destination-relevant language.
- **Risk Level:** Medium. Main risk is wording clutter or inconsistent attachment rules.
- **Implementation Cost:** Medium. Requires future language ownership work and acceptance tests, but not a new surface.

### Option B — Secondary Awareness Line

**Concept:** Directional awareness appears beneath primary awareness content.

Example:

- Disabled Vehicle on US 90 at Waco Street
- US 90 Westbound
- Awaiting additional reports

**Evaluation:**

- **Mission Alignment:** Medium to High. It adds awareness context, but risks making direction feel like a separate signal rather than condition context.
- **Awareness Value:** Medium. It preserves direction, but may be redundant when the primary line already names a road and location.
- **User Comprehension:** Medium. Users may understand it, but may not know whether the second line modifies the incident, road, or route.
- **Ownership Complexity:** Medium. Existing Awareness Brief ownership can remain mostly intact, but line ordering and content precedence must be governed.
- **UI Complexity:** Medium. It adds hierarchy decisions and possible wrapping/truncation concerns.
- **County Scalability:** High. The pattern is repeatable, but wording length varies by county roads and communities.
- **Future Route Intelligence Compatibility:** Medium to High. It preserves structured direction, but does not strongly bind it to future route relevance.
- **Future Destination Intelligence Compatibility:** Medium. It may help later, but the secondary line is not inherently destination-aware.
- **Risk Level:** Medium. Main risks are redundancy, visual hierarchy confusion, and brief inflation.
- **Implementation Cost:** Medium. Requires UI/content rules even if runtime ownership stays largely unchanged.

### Option C — Separate Directional Awareness Surface

**Concept:** Directional awareness lives outside the Awareness Brief, such as Community Pulse, Awareness Details, Road Intelligence, or a future route surface.

**Evaluation:**

- **Mission Alignment:** Medium. It can preserve awareness-first positioning only if the surface is clearly framed as awareness, not navigation.
- **Awareness Value:** Medium to Low. Separating the signal lowers visibility at the moment users read the Awareness Brief.
- **User Comprehension:** Medium. A separate surface can explain direction clearly, but users may miss why it matters.
- **Ownership Complexity:** Low to Medium. It avoids Awareness Brief ownership conflict but creates a new ownership area.
- **UI Complexity:** Medium to High. Any new or expanded surface requires placement, hierarchy, empty states, and content governance.
- **County Scalability:** Medium. It scales technically, but risks fragmenting county-specific intelligence across surfaces.
- **Future Route Intelligence Compatibility:** High. A separate Road Intelligence or route-adjacent surface could become a bridge to future route intelligence.
- **Future Destination Intelligence Compatibility:** Medium to High. A details surface could later support destination-aware expansion.
- **Risk Level:** Medium to High. Main risks are lower visibility and feature fragmentation.
- **Implementation Cost:** High. Requires surface strategy and future UI work.

### Option D — Service Only

**Concept:** Directional awareness remains internal and is used for future ranking, route intelligence, destination intelligence, or future awareness language, but is not shown directly now.

**Evaluation:**

- **Mission Alignment:** Low to Medium. It protects the architecture but does not currently advance user-facing “Know Before You Go” value.
- **Awareness Value:** Low current value; high possible future value.
- **User Comprehension:** High in the narrow sense that no new concept is exposed, but users receive no directional benefit.
- **Ownership Complexity:** Low. No Awareness Brief ownership conflict is introduced.
- **UI Complexity:** Low. No UI work is required.
- **County Scalability:** High. Internal service capability can continue scaling under containment rules.
- **Future Route Intelligence Compatibility:** High. This is useful for future route intelligence.
- **Future Destination Intelligence Compatibility:** High. This is useful for future destination intelligence.
- **Risk Level:** Medium. The product risk is delayed return on an already validated capability.
- **Implementation Cost:** Low. No current implementation is needed.

## Decision Matrix

Scores use a 1–5 scale where 5 is strongest, lowest-risk, or lowest-cost depending on the criterion. For complexity, risk, and implementation cost, a higher score means lower complexity, lower risk, or lower cost.

| Evaluation Criteria | Option A: Incident Context Enhancement | Option B: Secondary Awareness Line | Option C: Separate Directional Awareness Surface | Option D: Service Only |
| --- | ---: | ---: | ---: | ---: |
| Mission Alignment | 5 | 4 | 3 | 2 |
| Awareness Value | 5 | 3 | 2 | 1 |
| User Comprehension | 5 | 3 | 3 | 5 |
| Ownership Complexity | 3 | 3 | 4 | 5 |
| UI Complexity | 4 | 3 | 2 | 5 |
| County Scalability | 5 | 4 | 3 | 5 |
| Future Route Intelligence Compatibility | 5 | 4 | 5 | 5 |
| Future Destination Intelligence Compatibility | 5 | 3 | 4 | 5 |
| Risk Level | 3 | 3 | 2 | 3 |
| Implementation Cost | 3 | 3 | 2 | 5 |
| **Total** | **43** | **33** | **30** | **41** |

## Recommendation

Recommended path: **Option A — Incident Context Enhancement**.

Directional awareness should **become incident context** in a future explicitly authorized implementation package. It should not remain hidden as the intended product destination, should not become an always-present secondary awareness line, should not be split into a separate current awareness surface, and should not be indefinitely deferred as service-only infrastructure.

This recommendation best preserves Gridly’s product hierarchy:

1. Awareness Platform First.
2. Route Intelligence Second.
3. Directional language only when it improves active condition understanding.

The future implementation should attach direction to active conditions only when the directional service has validated containment, bearing, and fail-closed confidence. If those conditions are not met, the experience should remain silent rather than expose uncertain directional language.

## Alternatives Considered

- **Remain hidden:** Rejected as the final product target because it provides no current user-facing awareness value despite validated candidates.
- **Become secondary awareness:** Rejected as the primary path because it risks redundancy and visual hierarchy clutter.
- **Become separate awareness:** Rejected for current planning because it lowers visibility and fragments the awareness experience.
- **Be deferred/service-only:** Rejected as the product target because it delays return on a validated awareness capability, although service-only retention remains acceptable until a future implementation package is approved.

## Risks

- **Language clutter risk:** Incident labels could become too long if direction is appended without strict phrasing rules.
- **Ownership risk:** The localized-intelligence owner must explicitly own directional incident context before implementation begins.
- **Confidence risk:** Direction must remain fail-closed when containment, bearing, or candidate confidence is insufficient.
- **Scalability risk:** County road naming variation may create inconsistent wording unless governed by shared language rules.
- **Expectation risk:** Users may interpret directional language as routing guidance unless copy remains awareness-oriented.

## Future Opportunities

- Direction-aware incident phrasing for active conditions.
- Direction-informed awareness ranking without exposing route calculations.
- Destination-relevant awareness summaries when a destination context is available in the future.
- Route intelligence compatibility once routing work is explicitly authorized.
- County-scalable language templates for roads, highways, frontage roads, and crossings.
- Audit expansion that distinguishes candidate existence, owner retention, and final user-visible awareness value.

## Protected Systems Verification

V708 is documentation-only. The protected systems remain unchanged and must continue to be treated as closed or paused:

| Protected System | Required State | V708 State |
| --- | --- | --- |
| `historicalReadsEnabled` | `false` | Unchanged |
| `historyUiEnabled` | `false` | Unchanged |
| `DriveTexasPaused` | `true` | Unchanged |
| `TransportationIntelligenceEnabled` | `false` | Unchanged |
| `TransportationIntelligenceDisplay` | `false` | Unchanged |
| `TransportationIntelligenceActivation` | `false` | Unchanged |

## Non-Goals Confirmation

V708 does not authorize or include changes to:

- Runtime behavior.
- Awareness Brief ownership.
- Route Watch.
- Alerts.
- Destination Intelligence.
- Navigation.
- Routing.
- County systems.
- Supabase.
- Directional extraction.
- Directional candidates.

## Final Determination

Directional awareness should **become incident context** in a future authorized implementation package.

Until that package exists, the current runtime behavior should remain unchanged: directional candidates may exist internally, but no new user-facing directional rendering, secondary line, separate surface, navigation behavior, routing behavior, or protected-system activation is authorized by V708.
