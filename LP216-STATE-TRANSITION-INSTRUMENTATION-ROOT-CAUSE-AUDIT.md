# LP216 — State-transition instrumentation and multi-county C/J audit

## Scope and inspected architecture

This milestone is diagnostic only. It changes no membership, presentation, crossing, roadway, DriveTexas, or geometry data. The audit inspected search construction and application, `resolveGridlyAwarenessArea`, `resolveGridlyAwarenessAreaForCounty`, canonical PLACE validation/projection, persisted precedence, `gridlySaveCanonicalMultiCountyPlaceHome`, active-county synchronization/setter, semantic camera dispatch, LP202.1 crossing hydration and stale-generation guards, LP202.2 active-county cleanup, LP213 convergence protections, roadway activation, awareness projection, and settings/profile persistence.

The intended pipeline is canonical PLACE → explicitly chosen governed membership → operational county → active county → camera and county-governed consumers. Static LP213 data correctly retains all 163 multi-county PLACE identities. Consumers do not choose from membership arrays: after active county is established, crossings and roadways consume active county, while awareness/settings/profile consume the persisted canonical key plus operational county.

## Instrumentation

`window.gridlyTransitionTrace` is one mutable audit ledger per selection transaction. `window.gridlyBeginCommunityTransitionTrace(input)` starts it and `window.gridlyRecordCommunityTransitionStage(stage, detail)` appends concise immutable stages. The schema is `LP216.community-transition.v1` and contains transaction identity/time, canonical label/key/PLACE GEOID, the complete governed FIPS set, selected and authoritative membership, previous/current active county, subsystem/county, presentation coordinate/camera target, stale-state classification, transition generation, and decision reason. Hooks cover explicit validation/blocking, authoritative resolution, active county, presentation, crossing source, roadway source, awareness, settings, and profile. Instrumentation has no state-selection return value and performs no product mutation except publishing/appending its console ledger.

## Deterministic reproductions

### Midland

Governed identity `PLACE 4848072` has memberships Martin `48317` and Midland `48329`. The owner intent is `midland-tx`. All three normal canonical callers invoke `gridlySaveCanonicalMultiCountyPlaceHome(result, source)` **without its required third argument**. The trace therefore ends at `selection_blocked`, reason `explicit_operational_membership_missing`; selected/authoritative membership is absent and no transition is committed.

The county-scoped workaround follows a different path: the county grouping creates distinct entries, but the save path reduces the chosen entry to the label `Midland`; `resolveGridlySettingsAwarenessSaveValue` then invokes global `resolveGridlyAwarenessArea`, whose `find` returns the first label match in registry order. Martin (`48317`) precedes Midland (`48329`), so the explicit `midland-tx` context has already been discarded when global label resolution reconstructs `martin-tx`. Active county then correctly drives crossing and roadway consumers to Martin. Thus LP202.2 and LP213 protect the wrong reconstructed authority rather than causing the substitution.

### Abilene

Governed identity `PLACE 4801000` has Jones `48253` and Taylor `48441`; owner intent is `taylor-tx`. The canonical path is blocked by the same missing third argument. The workaround collapses the county-scoped Taylor selection to `Abilene`, and global first-label resolution selects Jones because Jones precedes Taylor. The exact substitution occurs in `resolveGridlySettingsAwarenessSaveValue` → `resolveGridlyAwarenessArea` before persistence/active-county synchronization. Downstream `jones-tx` crossing behavior is coherent with that incorrectly reconstructed county.

### Stanton control

Stanton has only governed membership Martin `48317`. Label reconstruction therefore cannot cross a membership boundary, and active/crossing/roadway/settings/profile all remain `martin-tx`. This confirms the Martin crossing package is unrelated to Midland's defect.

The same generic risk applies to New Braunfels, Austin, Corpus Christi, San Diego, San Marcos, Monahans, Odessa, and Denver City whenever a county-scoped selection is collapsed to an ambiguous label; none is patched here.

## Findings and repair boundary

**A. Confirmed root cause.** Family C is the API contract mismatch: every canonical UI caller omits a now-mandatory explicit operational county, so the guarded save fails closed. Family J is identity loss at the county-scoped save boundary: an explicit county-qualified option is serialized as a community label and later reconstructed by global first-match lookup. Membership order is not explicitly indexed with `[0]`, but `Array.find` is an equivalent first-match shortcut after identity loss. Presentation coordinates do not make this choice; coordinate containment is only a later fallback when no explicit county reaches the operational resolver.

**B. Contributing race/stale state.** No race is required to reproduce either substitution. Prior active county may be used only by persisted canonical PLACE rehydration after profile/settings authority is absent; it is not the confirmed Midland/Martin or Abilene/Jones decision. LP202 generation guards cancel stale crossing/roadway work after the wrong active county is selected. Late crossing/awareness completion can explain staggered visual settling, but not the deterministic first-label county substitution.

**C. Unrelated symptoms.** Martin inventory health, handler duration, forced reflow, watched-count semantics, and late visual settling do not cause identity loss.

**D. Owner-browser unknowns.** Console evidence is still required to quantify competing generations and late subsystem completion in the owner's exact device/session. LP216 does not claim browser PASS or claim C/J repaired.

The next repair milestone should carry a single immutable selection transaction (canonical PLACE plus explicit governed county ID) through every caller and persistence boundary, prohibit label-only reconstruction for county-scoped results, and make all consumers converge on that transaction authority. It should not select the first membership or use presentation containment when explicit authority exists. Production repair is explicitly deferred.
