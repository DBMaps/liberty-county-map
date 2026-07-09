# Gridly Story Engine V1

## Mission

Gridly Story Engine V1 turns information Gridly already has into one calm awareness story for Know Before You Go.

This is an awareness presentation layer. It does not add intelligence, call new services, change alerts, change reporting, or change protected runtime systems.

The product question remains:

> What do I need to know before I leave?

## Story Model

The canonical builder is `buildGridlyAwarenessStory()`.

The builder organizes existing awareness in this order:

1. Situation.
2. Evidence.
3. Confidence.
4. Recommendation.

The user interface primarily shows the situation and recommendation. Confidence can support the brief. Evidence is prepared for future use but is not exposed as a new panel in V910.

The normalized story object includes:

- `version` — Story Engine version.
- `template` — Consumer-facing story template family.
- `situation` — The short awareness headline.
- `summary` — Situation plus recommendation.
- `recommendation` — The suggested next action.
- `confidence` — Plain-language confidence wording.
- `area` — Consumer location label when available.
- `evidence` — Consumer-friendly evidence categories.

## Story Templates

V910 includes first-pass templates for these conditions:

| Template | Situation | Recommendation |
| --- | --- | --- |
| Quiet conditions | Community is quiet. | No significant travel concerns reported. |
| Community activity increasing | Community activity is increasing. | Check the map before leaving. |
| Train blocking crossing | Train blocking crossing. | Allow extra travel time. |
| Flooding | Flooding may affect local roads. | Never drive through water. |
| Heavy rain | Heavy rain may slow travel. | Drive with caution. |
| Multiple simultaneous conditions | Several conditions may affect travel. | Check your route before leaving and allow extra travel time. |
| No active concerns | No active concerns are showing right now. | Travel normally and stay aware. |

Templates are selected only from existing runtime text, active local records, and existing brief weather context when available.

## Evidence Preparation

V910 prepares evidence in consumer categories:

- `Community`
- `Weather`
- `Transportation`
- `Rail`

Evidence wording avoids provider names, internal records, raw fields, and engineering terms. The evidence object is intentionally ready for a future Evidence panel, but V910 does not add that panel.

## Consumer Wording

Story wording follows `GRIDLY-CONSUMER-LANGUAGE-STANDARD-V1`:

- Short sentences.
- Calm tone.
- Professional wording.
- Action-oriented recommendations.
- No provider names.
- No database language.
- No internal IDs.
- No technical source terminology.

## Future Expansion

Future versions may:

- Add a dedicated Evidence panel.
- Add richer freshness wording.
- Blend route relevance when route context is already available.
- Improve local place references.
- Add stronger prioritization when multiple conditions compete.

Future expansion should remain presentation-first and should not expose implementation details.

## Testing Checklist

1. Hard refresh the app.
2. Open Know Before You Go.
3. Confirm the brief reads as one coherent awareness story.
4. Run `window.gridlyStoryEngineAudit?.()`.
5. Confirm `safeForBeta: true`.
6. Confirm `storyBuilt: true`.
7. Confirm `consumerLanguagePass: true`.
8. Confirm `providerNamesExposed: []`.
9. Confirm `technicalTermsDetected: []`.
10. Run prior compatibility audits and confirm they remain safe for beta.

## Merge Recommendation Placeholder

Merge recommendation: pending final browser validation on the target beta device profile.
