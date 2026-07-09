# Gridly Transportation Evidence Promotion V1 (V913)

## Mission

Promote meaningful official transportation information into the Gridly Awareness Story and Evidence Experience when it materially affects travel decisions.

Gridly remains an awareness platform first and route intelligence second. Transportation is supporting evidence for the question: “What do I need to know before I leave?”

## Transportation philosophy

Transportation information is not a destination, viewer, or provider experience. It is blended into one coherent awareness story only when official roadway information changes what a person should know before leaving.

Community remains primary. Weather, transportation, and rail support the same single awareness story.

## Promotion rules

Transportation may influence Situation, Recommendation, and Evidence when official roadway information includes:

- Road closures.
- Lane closures or roadway restrictions.
- Bridge closures or bridge restrictions.
- Emergency roadway incidents.
- Construction that affects traffic, closures, restrictions, detours, or delay.
- Detours.

## Suppression rules

Transportation is suppressed when it is not meaningful enough to change awareness, including:

- Routine maintenance.
- Minor shoulder work.
- Administrative notices.
- Informational messages.
- Any roadway record that does not materially affect travel.

Suppressed transportation does not appear in the story or Evidence Experience.

## Story examples

### Road closure

- Situation: Road closure may affect nearby travel.
- Recommendation: Expect detours.
- Evidence: Transportation.

### Lane closure

- Situation: Traffic may be slower nearby.
- Recommendation: Allow extra travel time.
- Evidence: Transportation.

### Construction

- Situation: Construction may affect travel.
- Recommendation: Check your route before leaving.
- Evidence: Transportation.

### Blended story

When community reports also exist, transportation is blended into the same story rather than creating a second story:

- Flooding continues nearby.
- Construction may slow alternate routes.
- Allow extra travel time.

## Evidence examples

Transportation evidence may appear as:

- Transportation — Official roadway information supports this awareness.
- Transportation — Roadway restrictions may affect local travel.
- Transportation — Construction activity may affect nearby roads.

Transportation evidence is hidden when transportation does not contribute to the current awareness story.

## Consumer wording

Allowed wording includes:

- Official roadway information supports this awareness.
- Roadway restrictions may affect travel.
- Construction activity may affect nearby roads.
- Traffic may be slower nearby.

Do not expose provider names, API names, engineering terms, internal classifications, or ingestion details.

## Future opportunities

- Tune impact scoring by distance from the selected area.
- Blend closure and weather impacts into stronger alternate-route warnings.
- Add non-provider-specific severity levels for major closures.
- Expand safe consumer wording for prolonged restrictions.

## Testing checklist

- Run `node --check js/app.js`.
- Run the V910 Story Engine test.
- Run the V911 Evidence Experience test.
- Run the V912 Weather Evidence Promotion test.
- Run the V913 Transportation Evidence Promotion test.
- Run relevant transportation connector tests without changing provider ingestion.
- Run `git diff --cached --check`.
- Browser validation: confirm Transportation is hidden without meaningful impacts.
- Browser validation: confirm meaningful transportation impacts contribute to Situation, Recommendation, and Evidence.
- Browser validation: run `window.gridlyTransportationEvidencePromotionAudit?.()` and confirm `safeForBeta: true`.
- Browser validation: verify prior audits remain `safeForBeta: true`.

## Merge recommendation placeholder

Merge recommendation: Pending final reviewer validation and beta audit confirmation.
