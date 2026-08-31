# LP243 — Final Pre-Launch Product UX / Visual Audit

**Product:** Gridly — Know Before You Go  
**Mode:** Audit only; no production behavior or presentation code changed  
**Primary viewport:** Mobile portrait  
**Audit date:** 2026-08-31  
**Final classification:** **LP243_REPAIR_REQUIRED**

## 1. Executive summary

The current production presentation is structurally launch-capable: the portrait V2 owner suppresses legacy consumer surfaces, the map retains explicit viewport ownership, bottom sheets reserve dock and safe-area clearance, long collections have a bounded scroll owner, and the main actions remain represented by touch-sized controls. Repository inspection found **no confirmed launch blocker**.

Three finite presentation defects remain worth a focused pre-launch repair:

1. alert condition casing can still vary by source family because the shared condition-label authority canonicalizes community categories but may preserve an official provider's trusted label verbatim;
2. the active Alerts information architecture can become visually laborious at volume because one condition may sit behind source, type, and roadway disclosures before reaching its action; and
3. consumer-facing capitalization is not governed by one contract across settings/actions and alert headings (sentence case, title case, and all-caps source labels coexist without an explicit semantic boundary).

Two lower-priority opportunities should not delay launch: unify close glyph treatment (`X` versus the surrounding icon system), and reduce explanatory repetition in expanded Settings once usage evidence is available.

This is a current-path audit, not a historical defect inventory. Closed Home Area, canonical place/county, crossing, DriveTexas geometry, count-authority, and POI categories were not reopened. No town-specific exception is proposed.

### Evidence boundary

The audit traced the live DOM, portrait V2 builders/renderers, shared formatters, late winning CSS, responsive overrides, and existing browser audit helpers. A headless Chromium acceptance pass could not run in this container because no Playwright browser executable is installed and the browser CDN returned HTTP 403. Consequently, geometry conclusions are limited to active code/CSS authority; the owner checklist below explicitly requires final physical visual acceptance.

## 2. Current surfaces inspected

| Surface | Current authority inspected | Audit disposition |
|---|---|---|
| Primary portrait shell | `#gridlyPortraitV2`, portrait cleanup/containment, map-only legacy subtree allowance, top brief, control rail, bottom dock | No blocker found; owner visual pass required |
| Search / destination search | `#gridlySearchShell`, `.gridly-search-card`, destination result writers, portrait sheet override | Bounded scroll and dock clearance present |
| Nearby Places | LP241.19 POI controls/results inside Search, one-column portrait override | Current production path inspected; authority not reopened |
| Alerts | `getAlertsSurfaceSnapshot()`, LP236 model/render projection, Portrait V2 Alerts sheet, late alert CSS | Two pre-launch findings |
| Know Before You Go | portrait awareness/travel brief builders and interaction panel styling | No confirmed defect from current inspection |
| Location Context | mobile destination/awareness command writer and final metric hierarchy CSS | Collapsed actionable-state contract preserved; no raw metric restoration recommended |
| Settings | Portrait V2 `buildSettingsSurfaceHtml()`, contained sheet scroll, grouped accordions | One cross-surface copy finding; one enhancement |
| Home Area picker | Portrait V2 Settings chooser, search-first manual result/selected/confirmation projection | LP242.1 contract treated as closed; presentation path inspected only |
| Reporting | Portrait V2 report template, hazard and subtype choices, location/map CTAs | No confirmed regression; owner keyboard/device pass required |
| Popups | active alert focus/show-on-map bridge, community/crossing/official popup presentation writers and shared condition formatter | Casing finding applies; no source authority change proposed |
| Empty / quiet states | Alerts authoritative quiet state, Search/POI status paths, Home Area no-results, KBYG/Location Context quiet copy | No blocker found |
| High-volume states | Alerts disclosure tree, Search/POI single sheet scroll, Settings sheet scroll | Alerts density finding confirmed |
| Landscape / wider viewport | responsive ownership boundary and landscape/desktop overrides | No code-established severe breakage; bounded owner sanity pass remains |

## 3. Confirmed launch blockers

**None.**

Current code inspection did not establish a core action that is prevented, critical awareness hidden, safety state materially miscommunicated, or the portrait shell visibly broken. This conclusion is deliberately conservative and remains subject to the owner physical-device checklist because automated browser rendering was unavailable in this environment.

## 4. Confirmed pre-launch polish findings

### LP243-P1

**ID:** LP243-P1  
**SURFACE:** Alerts; shared popup/condition presentation  
**SEVERITY:** PRE-LAUNCH POLISH

**OBSERVED CURRENT PROBLEM**  
The known `Construction` versus `flooding` observation remains possible in the current active path. `gridlyConditionDisplayLabel()` maps canonical keys to deliberate labels only for community/report/road-hazard source families. For official-roadway input, a non-underscore `trustedLabel` is returned unchanged. LP236 passes `OFFICIAL_ROADWAYS` plus the current condition text into that function, so provider casing such as `flooding` can survive while another record supplies `Construction`. LP236's group labels are canonicalized, but individual concise condition rows can still diverge.

**CONSUMER IMPACT**  
Adjacent conditions can look as though they were assembled by different products or imply an unintended difference in meaning or authority.

**CURRENT PRESENTATION AUTHORITY**  
`gridlyLP236ConciseCondition()` → `gridlyConditionDisplayLabel()`; group headings additionally use `gridlyLP236TypeLabel()`.

**LIKELY ROOT CAUSE**  
The shared label formatter has a complete community-category map but no equivalent canonical map/fallback casing policy for official-roadway labels; its trusted-label escape hatch is casing-preserving.

**BLAST RADIUS**  
Source-family-wide for official roadway conditions, with projection risk anywhere the same formatter/labels feed alerts or popups. It is not town-specific and does not implicate DriveTexas data authority.

**RECOMMENDED SHARED REPAIR BOUNDARY**  
Define one consumer label casing policy in `js/gridlyConditionDisplayLabel.js` and consume it at LP236's row and group presentation boundary. Preserve official event names and acronyms explicitly; do not mutate source records or scatter string replacements.

**PROTECTED SYSTEM RISK**  
Low if restricted to display labels. Do not alter provider normalization, alert generation, lifecycle, identity, geography, or source authority.

**OWNER VISUAL ACCEPTANCE NEEDED:** YES

### LP243-P2

**ID:** LP243-P2  
**SURFACE:** Alerts panel — populated/high-volume state  
**SEVERITY:** PRE-LAUNCH POLISH

**OBSERVED CURRENT PROBLEM**  
The current LP236 projection can require three disclosure layers—source, condition type, then roadway—before a condition row and `Show me` action are reached. Each source/type/roadway summary reserves a 44–48 px row, with additional nested left padding. This is controlled rather than broken, and the sheet body owns scrolling, but a mixed high-volume collection accumulates navigation chrome faster than actionable condition content.

**CONSUMER IMPACT**  
People scanning conditions before leaving may need repeated taps and scrolling to compare active items. Long collections can feel dense and tiring even though controls remain reachable.

**CURRENT PRESENTATION AUTHORITY**  
`gridlyLP236BuildModel()` and `gridlyLP236RenderAlertsPresentation()` own the disclosure hierarchy; `.gridly-lp236-*` rules own row heights, indentation, spacing, and condition actions; the Portrait V2 Alerts sheet owns scrolling.

**LIKELY ROOT CAUSE**  
The IA optimizes source/type/roadway provenance and identity completeness more strongly than first-glance consumer scan speed.

**BLAST RADIUS**  
Surface-wide for Alerts, most visible in communities with multiple source families, types, and roadways. Quiet and small collections are not materially affected.

**RECOMMENDED SHARED REPAIR BOUNDARY**  
Refine only the LP236 presentation projection and alert CSS: keep source truth and identity intact, but reduce redundant disclosure levels/labels where a group has one child, establish a deliberate default-open policy for the highest-value group, and retain the single sheet scroll owner. Do not add per-town rules or unbounded rendering.

**PROTECTED SYSTEM RISK**  
Medium if implementation accidentally changes membership or grouping. Keep the repair downstream of `getAlertsSurfaceSnapshot()` and do not touch awareness filtering, lifecycle, generation, sync, roadway authority, or weather authority.

**OWNER VISUAL ACCEPTANCE NEEDED:** YES

### LP243-P3

**ID:** LP243-P3  
**SURFACE:** Product-wide typography/copy; most visible in Alerts and Settings  
**SEVERITY:** PRE-LAUNCH POLISH

**OBSERVED CURRENT PROBLEM**  
Current consumer strings mix title case (`Current Alerts`, `Route Setup`, `Map Style`, `Text Size`, `Saved Places`, `Edit Home`, `Send Feedback`), sentence case (`Use my location`, `Tap the map`, `Show walkthrough again`), and all-caps source headings. Some variation is semantically useful, but there is no shared presentation authority that declares which role receives which casing. Alert condition rows then add the provider-preserving behavior described in LP243-P1.

**CONSUMER IMPACT**  
The UI reads inconsistently across adjacent sheets and controls, reducing the premium, unified feel. This does not prevent task completion.

**CURRENT PRESENTATION AUTHORITY**  
Literal strings in Portrait V2 sheet templates (`buildSettingsSurfaceHtml()`, `buildReportHazardSurfaceHtml()`, `sheetTemplates`), LP236 source/type labels, and `gridlyConditionDisplayLabel()`.

**LIKELY ROOT CAUSE**  
Presentation copy is owned by several active builders with no small shared casing/copy contract by semantic role.

**BLAST RADIUS**  
Surface-wide across active portrait sheets and any wider layouts that reuse their strings.

**RECOMMENDED SHARED REPAIR BOUNDARY**  
Document and apply a finite role-based contract: sentence case for actions and helper copy, deliberate title treatment for surface/section names, preserved acronyms/proper names, and canonical display labels for conditions. Update only active template/formatter authorities; do not introduce a framework or broad rewrite.

**PROTECTED SYSTEM RISK**  
Low. Copy/presentation only; preserve data keys, action attributes, and accessibility names' meaning.

**OWNER VISUAL ACCEPTANCE NEEDED:** YES

## 5. Post-launch enhancement candidates

### LP243-E1

**ID:** LP243-E1  
**SURFACE:** Close controls across sheets/modals  
**SEVERITY:** POST-LAUNCH ENHANCEMENT

**OBSERVED CURRENT PROBLEM**  
Several active or reusable surfaces render a literal `X` inside the shared close-control class while the dock and other controls use designed image/icon treatments. Shared CSS normalizes the hit target, but glyph weight and optical centering can differ by platform font.

**CONSUMER IMPACT**  
Minor visual inconsistency; accessibility is mitigated by explicit `aria-label` values.

**CURRENT PRESENTATION AUTHORITY**  
`gridly-surface-close`, `#gridlyPortraitV2SheetClose`, and modal/template markup.

**LIKELY ROOT CAUSE**  
Legacy text glyph retained while the broader icon system evolved.

**BLAST RADIUS**  
Control-family-wide, bounded to close actions.

**RECOMMENDED SHARED REPAIR BOUNDARY**  
Adopt one existing code-native close icon/glyph treatment through the shared close class/template while retaining labels and 44 px targets.

**PROTECTED SYSTEM RISK**  
Low; do not change close lifecycle or focus restoration.

**OWNER VISUAL ACCEPTANCE NEEDED:** YES

### LP243-E2

**ID:** LP243-E2  
**SURFACE:** Settings expanded sections  
**SEVERITY:** POST-LAUNCH ENHANCEMENT

**OBSERVED CURRENT PROBLEM**  
Expanded Settings repeats device-local/privacy explanation across multiple cards and sections. The accordion structure keeps the initial state calm, so this is not a launch defect, but expanded pages become copy-heavy.

**CONSUMER IMPACT**  
Longer scanning and more vertical travel for repeat users.

**CURRENT PRESENTATION AUTHORITY**  
`buildSettingsSurfaceHtml()` and `.settings-placeholder-note` within the contained Portrait V2 Settings sheet.

**LIKELY ROOT CAUSE**  
Trust explanations were added locally at each feature boundary rather than edited as one concise Settings narrative.

**BLAST RADIUS**  
Settings-only, expanded state.

**RECOMMENDED SHARED REPAIR BOUNDARY**  
After launch usage evidence, perform a bounded copy edit within the active Portrait V2 Settings builder; keep the important location and on-device assurances once each where context remains clear.

**PROTECTED SYSTEM RISK**  
Low; copy only.

**OWNER VISUAL ACCEPTANCE NEEDED:** YES

## 6. Alerts stacking / readability findings

- The active portrait panel has a single scrolling owner (`#gridlyPortraitV2SheetBody`) with overscroll containment and dock clearance. This avoids the most dangerous nested-scroll/unreachable-control failure.
- Condition actions reserve a 44 px row and `Show me` has a 44 px minimum target. Long roadway, location, title, and summary text are allowed to wrap rather than being silently ellipsized.
- Rows use divider-based stacking inside a grouped surface in the latest light-material override, avoiding a wall of individually elevated cards.
- The remaining issue is **hierarchical overhead**, not uncontrolled sheet growth: source/type/roadway summaries and indentation can dominate high-volume lists (LP243-P2).
- Quiet Alerts uses an explicit authority-aware state rather than pretending a failed source is “all clear.” Existing LP236 audit output distinguishes authority unavailable from an authoritative zero.
- `Show me` deliberately minimizes the sheet and preserves disclosure state, protecting map visibility and return context.

## 7. Capitalization / label consistency findings

The owner observation is verified as a current presentation-path risk. The shared `COMMUNITY_LABELS` map specifies `Flooding` and `Construction`, but the formatter only applies that map to community/report families. Official roadway labels may take the unchanged trusted label. LP236 independently canonicalizes group headings, so a group can read `Flooding / High Water` while a child condition retains `flooding`.

The repair should not be a search-and-replace. The shared contract needs to distinguish:

- canonical hazard/condition labels;
- official named weather events and proper names, which should preserve authoritative naming;
- acronyms and roadway names;
- surface/section titles;
- action labels; and
- all-caps source-family eyebrows, which are intentional only if consistently used as eyebrows.

## 8. Shared presentation authorities identified

1. **Active portrait DOM owner:** `#gridlyPortraitV2` and the strict portrait cleanup/containment gate.
2. **Shared portrait sheet lifecycle:** `openGridlyPortraitV2Sheet()`, `sheetTemplates`, `#gridlyPortraitV2Sheet`, backdrop, title/body/close nodes, focus restoration, and minimization.
3. **Alerts membership snapshot:** `getAlertsSurfaceSnapshot()`; protected upstream truth for the LP236 projection.
4. **Alerts presentation projection:** `gridlyLP236BuildModel()` and `gridlyLP236RenderAlertsPresentation()`.
5. **Condition display labels:** `js/gridlyConditionDisplayLabel.js`; presently complete for community categories but permissive for official trusted labels.
6. **Settings presentation:** `buildSettingsSurfaceHtml()` plus settings sheet runtime alignment.
7. **Reporting presentation:** `buildReportHazardSurfaceHtml()` and the shared hazard/subtype option registries.
8. **Search / POI presentation:** `#gridlySearchShell`, result writers, and LP241.19 `.gridly-poi-*` presentation rules.
9. **Responsive/safe-area authority:** late portrait rules in `css/styles.css`, using `100dvh`, safe-area insets, dock clearance, and one scroll owner per sheet.
10. **Existing owner helpers:** `gridlyLP236AlertsInformationArchitectureAudit()`, the Portrait V2 surface/close audits, settings surface ownership/performance audits, report experience audit helpers, and LP241 compatibility/visual-tour documents. These should support acceptance; no new audit framework is warranted.

## 9. Legacy/dead findings intentionally excluded

- The desktop side-panel Alerts markup and legacy `renderAlerts()` card construction were not treated as the portrait Alerts authority; Portrait V2 uses the current snapshot/LP236 projection.
- The legacy Settings modal markup was not scored as a duplicate current surface because portrait containment explicitly hides/inerts it while Portrait V2 Settings is active.
- Historical CSS backups were excluded; only `css/styles.css` was treated as loaded production CSS.
- Historical-intelligence prototypes, old audit helpers, version comments, archived reports, and hidden mobile shells were not converted into findings.
- Closed LP242.1 Home Area mechanics, canonical multi-county/place behavior, crossing inventories, DriveTexas geometry propagation, Location Context count authority, POI activation, and statewide source authorities remain closed.
- Raw internal terminology in audit objects and console-only diagnostic output was not considered consumer leakage unless it feeds active rendered markup.

## 10. Proposed finite repair sequence

1. **LP243 repair block A — casing contract (P1 + relevant portion of P3).** Extend the shared display-label authority for official-roadway consumer labels, specify exceptions for named events/acronyms, and route LP236 row/group labels through it. Add focused formatter and active-render tests.
2. **LP243 repair block B — Alerts scan density (P2).** Simplify redundant single-child disclosures and define a conservative initial-open rule inside the LP236 presentation boundary. Do not change snapshot membership/group truth.
3. **LP243 repair block C — active-template copy consistency (remainder of P3).** Apply the agreed role-based casing contract only to current Portrait V2 templates and accessibility-equivalent labels.
4. **Owner visual acceptance.** Exercise quiet, one-item, mixed-source, and high-volume Alerts plus all primary sheets on the device matrix before reclassification.
5. **Defer E1/E2.** Do not hold launch for close-glyph refinement or Settings copy compression unless the owner tour reveals a materially worse current result.

## 11. Owner visual acceptance checklist

### Primary portrait shell

- [ ] iPhone-class narrow portrait (including 360–390 px CSS width): map remains visible and useful behind the top awareness cluster and collapsed Location Context.
- [ ] Bottom dock clears the home indicator; labels/icons are not clipped; every target is comfortably tappable.
- [ ] Top controls, awareness brief, Location Context, and dock do not overlap at 200% text or the supported large-text setting.
- [ ] Long community name wraps without duplicating the name or displacing Search.

### Search and Nearby Places

- [ ] Open Search with the software keyboard visible; input, close action, selected result, and primary destination action remain reachable.
- [ ] Verify loading, no-result, error/unavailable, one result, and 20+ result states.
- [ ] Verify long business/place and county/community names wrap cleanly.
- [ ] Nearby category/radius controls read as part of the current area and return/close consistently with Search.
- [ ] Only the sheet scrolls; the page/map does not scroll underneath.

### Alerts

- [ ] Compare `Construction` and `Flooding` from community and official-roadway records after repair; condition casing is identical by semantic role.
- [ ] Verify quiet authoritative-zero and authority-unavailable states do not imply system failure or false safety.
- [ ] Verify one item, 10 items, and a mixed-source 30+ item fixture for rhythm, indentation, default disclosure state, fatigue, and reachable actions.
- [ ] Verify long roadway/location/title/summary strings wrap without collisions or horizontal overflow.
- [ ] Tap `Show me`; map receives focus, sheet minimizes, and prior disclosure state returns.
- [ ] Close via visible control, Escape where applicable, and system back; focus returns to the Alerts opener.

### KBYG and Location Context

- [ ] Quiet and active KBYG states are readable without duplicating the complete Alerts inventory.
- [ ] Collapsed Location Context remains exactly glanceable/actionable: community, active/quiet state, Search; no community-report total or crossings-watched total is restored.
- [ ] Expanded context scrolls independently and closes without changing the confirmed area.

### Settings and Home Area

- [ ] Settings sheet header stays visible while the body scrolls; final controls clear the dock/safe area.
- [ ] Home Area search shows one candidate card; selecting that same card marks it Selected and places `Use this Home Area` with it.
- [ ] No duplicate Selected card, no auto-save, and explicit confirmation remains required.
- [ ] Verify canonical multi-county display and long names without reopening identity authority.
- [ ] Verify keyboard open/close, no-results, back, close, and unsaved selection behavior.

### Reporting and popups

- [ ] Complete location and tap-map reporting paths: hazard, Other subtype, placement, confirmation, success, cancel/close.
- [ ] Primary/secondary action priority remains obvious and no button is hidden by keyboard/dock.
- [ ] Community, crossing, official roadway, and weather popups share readable title/location/freshness/trust hierarchy with no raw keys or markup.

### Wider sanity

- [ ] Short mobile landscape does not trap a sheet or hide its close control.
- [ ] Tablet/wide and desktop retain map/panel boundaries without horizontal overflow or giant mobile-styled sheets.
- [ ] Light, dark, and system themes retain readable populated and quiet Alerts, Search, Settings, Report, KBYG, and Location Context states.

## 12. Final classification

## **LP243_REPAIR_REQUIRED**

There are **zero confirmed launch blockers**, **three finite pre-launch polish findings**, and **two non-blocking post-launch enhancements**. The next block should begin with the shared condition-label casing authority and its LP236 consumers, then perform the bounded Alerts hierarchy refinement. Repairs must stay downstream of protected data, lifecycle, filtering, geography, and source authorities.
