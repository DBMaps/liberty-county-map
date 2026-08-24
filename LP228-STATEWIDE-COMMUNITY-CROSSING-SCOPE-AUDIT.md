# LP228 — Statewide Community Crossing Scope Audit

## Certification decision

**Classification: `REPAIR_REQUIRES_NEW_AUTHORITY`.** The desired canonical-community contract is product-valid, but the runtime has no certified crossing-to-Census-PLACE association or PLACE boundary geometry. LP228 therefore makes no production repair.

## Current “crossings watched” authority

`buildGridlyCrossingWatchPresentationModel` calls `getGridlyBottomPanelAwarenessCrossingCount`. Ordinarily its winning collection is `gridlySelectConsumerVisibleCrossings`, but the function formally returns the maximum of that selector and the summary's `crossingsInArea` projection; an active saved-route watch can also supply a larger floor. The selector starts with the **active county inventory**, rejects invalid, wrong-county, non-public/non-reportable records, applies the selected awareness area's geography, and deduplicates FRA identity within that one collection.

For a PLACE projection, ownership is currently presentation-coordinate/radius filtering (default eight miles), not Census PLACE membership. Viewport and zoom do not enter this selector. They independently control rendered markers. The selected county does enter it twice: it chooses the only loaded inventory and enforces county matching. Canonical identity helps rejoin the presentation selector, but does not gather sibling memberships.

Thus Katy's observed **4** is the reportable/public subset of the 1,159-record Harris inventory falling within Katy's governed presentation radius. It is not the viewport's zero markers, not all Harris crossings, and not a three-county canonical Katy set.

## Katy

| Field | Finding |
|---|---|
| canonical community / key | Katy / `place-4838476` |
| selected membership | `harris-tx` |
| governed memberships | `fort-bend-tx`, `harris-tx`, `waller-tx` (FIPS 48157, 48201, 48473) |
| county inventories | Harris **1,159**; Fort Bend **175**; Waller **46** |
| current watched count | **4** |
| source counties represented | Harris only |
| viewport influenced | false |
| radius influenced | true |
| selected-membership limited | true |
| multi-county aggregated | false |
| cross-membership deduplicated | false (no aggregated collection exists) |

The live helper returns exact watched FRA IDs and the Harris grouping from the current runtime. It reports sibling inventory counts as unavailable (`null`) rather than loading sources. A canonical Katy count cannot be computed safely: county package health and governed PLACE memberships do not prove that an individual crossing belongs to Katy.

## Controls

Static governed controls confirm stable PLACE identity but the same membership-dependent count policy:

| Community | Canonical key | Governed memberships | Result when membership switches |
|---|---|---|---|
| Katy | `place-4838476` | Fort Bend, Harris, Waller | identity remains stable; watched source/count switches to the selected county inventory |
| Abilene | `place-4801000` | Jones (inventory 0), Taylor (106) | identity remains stable; watched source/count can change |
| Midland | `place-4848072` | Martin (12), Midland (35) | identity remains stable; watched source/count can change |
| Austin | `place-4805000` | Bastrop (158), Hays (53), Travis (176), Williamson (166) | identity remains stable; watched source/count can change |

Exact non-Katy watched counts require selecting and hydrating each membership in a browser; LP228 intentionally does neither. Single-county controls (Dayton, Liberty, Marfa, and Brownsville) use the same radius policy but cannot switch to a sibling inventory. Their healthy selection/governance behavior is unchanged; their radius result is still not certified PLACE-boundary membership.

## Statewide static certification

The LP214/LP217 inventory remains **1,859 canonical communities**, **2,058 memberships**, **163 multi-county identities**, and **254 counties**. On the strict requested meaning of “crossings belonging to the community”:

* certifiable authoritative community crossing sets today: **0**;
* communities backed only by governed county crossing inventory plus presentation filtering: **1,859**;
* communities whose current PLACE watched projection relies on presentation coordinates/radius: **1,859**;
* multi-county communities safely aggregatable with existing certified attribution: **0**;
* multi-county communities requiring additional geography authority: **163**.

The strongest certified authorities are PLACE GEOID identity/membership and county crossing inventories. Neither relates individual crossing coordinates to PLACE membership. Presentation focus/radius is certified for consumer camera/awareness presentation, not municipal geography. A future repair should first add and certify an authoritative crossing-to-PLACE association (for example, certified Census PLACE geometry), then aggregate all governed membership packages and deduplicate stable FRA IDs without changing selected membership or county governance.

## Launch risk and separate finding

Changing the count before that authority exists risks silently including crossings outside a PLACE or excluding valid edge/multi-county crossings. Recommendation: **do not repair before launch without owner-approved new authority**. Preserve separately the DriveTexas FM0529 marker finding at 29.87412353353783, -95.91808992841244; LP228 does not investigate or modify it.

**NO PRODUCTION CROSSING BEHAVIOR WAS CHANGED.**  
**NO MAP RENDERING BEHAVIOR WAS CHANGED.**  
**NO MULTI-COUNTY GOVERNANCE WAS CHANGED.**  
**NO UNRELATED PRODUCTION CHANGE WAS APPLIED.**
