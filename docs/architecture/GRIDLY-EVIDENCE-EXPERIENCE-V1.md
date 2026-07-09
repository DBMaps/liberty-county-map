# Gridly Evidence Experience V1

## Mission

V911 introduces the first consumer-facing Evidence Experience for Gridly. It helps people answer: **Why is Gridly telling me this?**

The experience is presentation-only. It does not add AI, LLMs, providers, ingestion changes, reporting changes, or Story Engine logic changes.

## Purpose

Gridly remains **Awareness Platform First, Route Intelligence Second**. V910 answers what people need to know before they leave. V911 explains why the current awareness story is supported.

The user should understand the supporting evidence without needing to understand provider names, internal systems, raw data, technical fields, or implementation details.

## Evidence model

The Evidence Experience consumes the evidence object prepared by the Story Engine and formats it into plain-language sections. Empty unavailable categories are not shown.

The surface is embedded in the existing Know Before You Go expandable briefing so it does not create a new dashboard or permanent panel.

## Evidence categories

- **Community** — Recent local reports support this awareness.
- **Weather** — Weather conditions may contribute to travel impacts.
- **Transportation** — Official roadway information supports this awareness.
- **Rail** — Rail activity may affect nearby travel.
- **Confidence** — Plain-language confidence wording based on the Story Engine confidence text.

## Consumer examples

### Multiple sources

Community
Recent reports support this awareness.
4 recent reports

Weather
Weather conditions may contribute to travel impacts.

Transportation
Official roadway information supports this awareness.

Rail
Rail activity may affect nearby travel.
1 active crossing event

Confidence
High
Several recent signals support this awareness.

### One source

Community
Recent local reports support this awareness.

Confidence
Developing
Early signs support this awareness.

## Confidence wording

Confidence never displays percentages, scores, raw fields, or technical terms.

- **High** — Several recent signals support this awareness.
- **Medium** — Some recent evidence supports this awareness.
- **Developing** — Early signs support this awareness.
- **Calm** — No active concerns are showing right now.

## Future expansion

Future versions may add richer evidence ordering, recency summaries, and additional consumer education. Future expansion must keep provider names and implementation details hidden unless a later product standard explicitly changes that rule.

## Testing checklist

1. Hard refresh the application.
2. Open Know Before You Go.
3. Open **Why Gridly says this**.
4. Confirm Community evidence appears when available.
5. Confirm Weather appears only when available.
6. Confirm Transportation appears only when available.
7. Confirm Rail appears only when available.
8. Confirm Confidence appears.
9. Confirm provider names, raw data, internal IDs, and technical wording are not visible.
10. Run `window.gridlyEvidenceExperienceAudit?.()` and confirm `safeForBeta: true`, `consumerLanguagePass: true`, `providerNamesExposed: []`, and `technicalTermsDetected: []`.
11. Run previous audit helpers and confirm they remain safe for beta.

## Merge recommendation placeholder

Merge recommendation: _Pending final validation on target beta device/browser._
