# GRIDLY V915 — Trust & Evidence Ranking Audit

## Executive Summary

V915 certifies the current Gridly Story Engine as the canonical Trust & Evidence Ranking baseline for Awareness Intelligence. The audit confirms that Gridly ranks community, weather, transportation, and rail evidence into one primary Awareness Story, then uses the Evidence Experience to support that story rather than creating competing headlines.

The current model is safe for beta because it is deterministic, consumer-language first, and fail-closed. It does not add providers, UI, dashboards, or protected-system behavior.

## Scope

This audit covers the ranking behavior from the current Awareness Pipeline:

Community → Weather → Transportation → Rail → Story Engine → Evidence Experience → Know Before You Go

The review evaluates source availability, precedence, confidence wording, recency implications, reinforcement, conflicts, and consumer-language safety.

## Non-goals

- Do not redesign the Story Engine.
- Do not add evidence providers.
- Do not add UI or dashboards.
- Do not modify Shared Reports.
- Do not modify Route Watch.
- Do not modify Awareness Filtering.
- Do not modify Hazard Lifecycle.
- Do not modify Alert Generation.
- Do not modify Supabase Sync.
- Do not modify Production Crossing Runtime.

## Current evidence sources

1. **Community** — Active community records and active hazards are the base awareness source. When no active records exist, community evidence provides the calm-state fallback.
2. **Weather** — Meaningful weather impacts such as flooding, heavy rain, fog, storms, wind, freezing conditions, and extreme heat can become primary awareness.
3. **Transportation** — Significant roadway impacts such as closures, restrictions, detours, construction impacts, or roadway incidents can become primary awareness; routine maintenance is suppressed.
4. **Rail** — Rail/crossing language in active community records can support rail-related awareness, especially blocked crossing conditions.

## Current Story Engine ranking behavior

The current Story Engine gathers active community records, transportation records, weather impact, and rail/crossing evidence. It then selects a single situation/recommendation pair by ordered checks:

1. Multi-condition story when at least two meaningful concern kinds are active.
2. Flooding.
3. Heavy rain.
4. Other meaningful weather.
5. Rail block.
6. Transportation.
7. Community activity.
8. Calm/quiet state.

This behavior creates one primary Awareness Story while retaining source-specific evidence for the Evidence Experience.

## Evidence precedence analysis

- **Community only:** Community becomes the primary story when active community records exist and no higher-specificity weather, transportation, or rail condition applies.
- **Weather only:** Meaningful weather becomes the story; quiet weather is suppressed.
- **Transportation only:** Significant roadway impact becomes the story; routine maintenance is suppressed.
- **Rail only:** Blocking/crossing evidence becomes the story when rail-block language is present.
- **Community + Weather:** Flooding or weather impact can lead; community evidence reinforces the story.
- **Community + Transportation:** If both are meaningful, the story moves to a multi-condition frame rather than competing headlines.
- **Community + Rail:** Rail blocking leads when the record specifically indicates crossing/training blocking behavior; otherwise community remains the base story.
- **Weather + Transportation:** Multiple meaningful conditions produce a single combined travel-impact story.
- **Transportation + Rail:** Multiple meaningful conditions produce a single combined travel-impact story.
- **Community + Weather + Transportation:** The Story Engine produces a single “several conditions” story with supporting evidence sections.
- **Community + Weather + Transportation + Rail:** The Story Engine produces a single “several conditions” story with community, weather, transportation, and rail evidence support.

## Confidence interaction

Confidence is derived from the number of active signals and meaningful evidence categories. It strengthens or qualifies the selected story with consumer language:

- Several signals produce higher confidence.
- Some evidence produces medium confidence.
- One signal or early external condition is presented as developing.
- No active signals produce a calm confidence line.

The model avoids technical scoring, provider names, or raw confidence terminology.

## Recency interaction

The current Story Engine relies on upstream active-record filtering and active connector records rather than exposing raw timestamps in the story. This is appropriate for V915 because recency influences which records are considered active without causing rapid headline churn. Freshness remains supportive context and should not destabilize the selected primary story.

## Multi-evidence interaction

When multiple meaningful evidence categories are active, Gridly produces one combined travel-impact story. The Evidence Experience can show multiple supporting sections, but the story itself remains a single primary situation and recommendation.

## Reinforcing evidence behavior

Reinforcing evidence increases confidence and adds evidence sections. It does not create multiple headlines. Community, weather, transportation, and rail evidence can all support one selected story.

## Conflicting evidence behavior

Conflicts are handled by deterministic precedence and suppression rules. Quiet or routine signals defer to meaningful active evidence. Routine maintenance does not compete with weather, rail, or community awareness. Meaningful overlapping conditions become a combined travel-impact story rather than fragmented alerts.

## Consumer-language consistency

The Story Engine and Evidence Experience suppress provider names and technical terms in consumer-facing strings. The V915 audit specifically checks that visible story/evidence language does not expose:

NOAA, TxDOT, FRA, Supabase, API, database, provider, normalized, payload, schema.

## Risks / observations

- The current ranking model is intentionally simple. It is suitable as a canonical baseline but should remain documented as deterministic precedence, not predictive intelligence.
- Recency is mostly inherited from upstream active filtering, so future predictive features should add explicit stability rules before changing ranking.
- Multi-evidence stories compress several signals into one consumer headline. This is desirable for beta but should be monitored for over-general wording when future sources are added.

## Recommended canonical ranking model

V915 recommends Gridly treat Trust & Evidence Ranking as:

1. Build active evidence only from approved current sources.
2. Suppress quiet, routine, or irrelevant signals.
3. Detect meaningful evidence categories.
4. If two or more meaningful categories are active, produce one multi-condition Awareness Story.
5. Otherwise apply deterministic precedence: flooding, heavy rain, other weather, rail block, transportation, community, quiet.
6. Use confidence as consumer-language support, not a raw score.
7. Use recency as stability-aware eligibility/support, not a rapid headline flipper.
8. Render evidence as support for the selected story, never as competing headlines.
9. Keep provider names and technical terms out of consumer language.
10. Preserve protected systems unchanged.

## Final recommendation

Certify V915 as safe for beta. Use this audit as the canonical Trust & Evidence Ranking baseline before future work on predictive awareness, expanded intelligence, or additional evidence sources.
