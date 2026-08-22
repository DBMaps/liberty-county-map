# LP222 — Awareness Singular/Plural Semantics Reconciliation

## Scope and owner evidence

This milestone is a presentation-only reconciliation. The owner control in Sulphur Springs had one current governed road-hazard identity and agreement across governed eligibility, current visible incidents, displayed Location Context, and Alerts, while the compact KBYG/Community Pulse decision copy said “Several conditions may affect travel.” Pecos remains the positive control for two or more legitimate current conditions. Browser acceptance of both controls is still required; this artifact does not claim it.

## Audit and root cause

The production emitter for the observed sentence is `buildGridlyCommunityPulseDecisionPresentation`. Its former grammatical decision used `Math.max(selectedCommunityCount, activeAwareness.activeAwarenessCount)` and then allowed a mobility-pressure category (`building`, `elevated`, `high`, or `increasing`) to select the plural branch even when that maximum was one. The boolean pressure label, rather than cardinality of the governed KBYG condition identities, was therefore sufficient to emit “Several conditions may affect travel.” This was neither the LP219.3 governed active count nor Location Context count, and it was not evidence of stale cache data; it was a presentation-category override.

A second production plural path exists in `buildGridlyAwarenessStory`, whose story can feed the Travel Brief and other awareness presentation. It formerly counted detected concern-category booleans. Category cardinality is not condition cardinality and could not provide source identity or duplicate protection. Other inspected plural copy includes Travel Brief community group/count lines, confidence translation (“Multiple recent signals”), the legacy language standards/audits, and condition-specific Community Pulse mobility phrases. Those paths either already use their own scoped collection counts or are static certification fixtures; LP222 does not globally replace their wording.

## Repair and semantic authorities

The compact Community Pulse/KBYG decision now uses the unique IDs in the governed KBYG community projection whenever that production authority is present. Zero selects the existing quiet flow, one selects the already-approved singular reason “A community report is active nearby,” and two or more select the existing plural sentence and “Multiple recent signals.” Mobility-pressure labels no longer override grammatical number.

The Travel Brief story retains its wider, intentionally different scope: lifecycle-correct community records, relevant official-roadway records, and one active meaningful-weather condition. `gridlyStoryRelevantConditionAuthority` deduplicates identities inside that scope and returns its count, contributing IDs, and quiet/singular/plural selection. The story's multi-condition template now uses that count rather than signal-category booleans. No global count was introduced.

`window.gridlyAwarenessCardinalityLanguageAudit()` aggregates production models and reports each surface's semantic scope, authoritative count, contributing source IDs, selected grammatical number, actual compact and Travel Brief text, and parity when the contributing identity sets are the same. It is passive and performs no fetches or writes.

## Deterministic controls

- **Quiet:** zero governed current conditions retains quiet copy and emits no active singular/plural phrase.
- **Sulphur Springs singular:** one governed active hazard produces singular compact wording; “Several conditions,” “Multiple conditions,” and “Multiple recent signals” are absent.
- **Official-roadway singular:** one relevant official roadway condition has a Travel Brief authority count of one.
- **Pecos plural:** two legitimate current conditions retain the existing plural contract.
- **Mixed sources:** one governed community condition plus one official-roadway condition is plural in the wider Travel Brief scope.
- **Cleared, stale, duplicate, and old-area protections:** LP219 governance filters these before compact grammar; story authority deduplicates retained identities. They cannot inflate grammatical number.
- **Consumer parity:** compact and Travel Brief select the same grammatical number whenever they describe the same governed identity set. The audit reports parity as not applicable when their intentionally different scopes contribute different identities.

## Protected systems

LP222 changes no lifecycle/count eligibility, consumer propagation policy, Alerts or KBYG eligibility, Location Context counting, crossing policy, persistence, Supabase, DriveTexas acquisition/normalization, Weather/NWS acquisition, Route Watch, county/community identity, map behavior, or performance behavior. LP219.3 and LP219.4 remain the upstream authority. Blocked-crossing policy remains explicitly unchanged.

## Browser acceptance still required

Owner browser validation must still confirm Sulphur Springs remains Location Context `1`, Alerts `1`, KBYG active, and visibly singular, and that Pecos with multiple current policy-relevant conditions remains plural. LP221 Val Verde, LP220 crossing viewport, LP219.4 propagation, LP219.3 lifecycle, Eastland crossing, and Del Rio quiet KBYG controls remain required protected checks. No browser acceptance is claimed here.
