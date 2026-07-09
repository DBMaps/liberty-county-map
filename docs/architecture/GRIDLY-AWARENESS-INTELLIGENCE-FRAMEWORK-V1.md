# Gridly Awareness Intelligence Framework V1

## 1. Mission

Gridly exists to help people know before they go.

Gridly is not a data-feed viewer. It is not another mapping application. It is not a place where people should need to understand which source, database, connector, or field produced a detail.

Gridly's product responsibility is to turn many signals into one useful awareness story. A person opening Gridly should quickly understand what matters near them, why it matters, and what they should consider before leaving.

The primary product question is:

> What do I need to know before I leave?

Everything in the Awareness Intelligence Framework should support that question. Internal systems may collect, normalize, compare, and rank information, but the user experience should remain simple, calm, and direct.

## 2. Core Philosophy

Gridly should communicate awareness, not infrastructure.

The framework follows this product chain:

```text
Raw Data
↓
Evidence
↓
Awareness
↓
Recommendation
```

### Raw Data

Raw data is unprocessed source material. It may include reports, observations, conditions, map features, road impacts, rail activity, timestamps, locations, and other details.

Raw data is useful internally, but it should not be the primary user experience.

### Evidence

Evidence is raw data translated into user-meaningful support for a situation. Evidence answers: "Why does Gridly believe this may matter?"

Evidence should be understandable without naming providers or exposing internal records.

### Awareness

Awareness is the consumer-facing story created from evidence. Awareness answers: "What is happening that may affect me?"

Awareness should be short, plain, and locally relevant.

### Recommendation

A recommendation is the concise action or expectation attached to awareness. It answers: "What should I consider doing now?"

Recommendations should be practical and conservative. They should not overpromise certainty, replace emergency guidance, or behave like turn-by-turn navigation.

## 3. Evidence Model

No single source owns awareness. Awareness emerges when multiple kinds of evidence describe a local situation.

### Community Reports

Community reports are best for what people are experiencing.

They may contribute evidence such as:

- Water over a road.
- A blocked crossing.
- Heavy traffic near a school or event.
- A hazard recently seen by people nearby.
- Repeated observations from different people.

Community evidence is powerful because it reflects lived local conditions. It should become stronger when reports are recent, consistent, and locally clustered.

### Weather

Weather is best for environmental conditions.

It may contribute evidence such as:

- Heavy rain.
- Strong wind.
- Fog.
- Severe storms nearby.
- Temperature or visibility conditions that may affect travel.

Weather evidence helps explain why conditions may be changing, even before many community reports appear.

### Transportation

Transportation evidence is best for official roadway impacts.

It may contribute evidence such as:

- Road closures.
- Lane restrictions.
- Construction impacts.
- Detours.
- Crash-related disruption.
- Officially identified travel delays.

Transportation evidence should be described as official roadway information, not by provider or feed name.

### Railroad Crossings

Railroad crossing evidence is best for rail movement and crossing impact.

It may contribute evidence such as:

- A crossing that appears active.
- A crossing reported as blocked.
- Nearby rail movement that may affect travel.
- Repeated local delay at a crossing.

Rail evidence helps Gridly explain delays that a standard road map may not make obvious.

### Location

Location evidence is best for local context.

It may contribute evidence such as:

- The user's county or nearby community.
- Nearby roads, low-water crossings, schools, downtown areas, or known corridors.
- Whether an issue is close enough to matter.
- Whether several signals describe the same local area.

Location turns general information into personally relevant awareness.

### Map

Map evidence is best for spatial understanding.

It may contribute evidence such as:

- Where a condition is located.
- What communities or roads are nearby.
- Whether multiple issues are clustered.
- Whether a person may pass through an affected area.

The map should support the awareness story. It should not force the user to interpret raw layers without explanation.

## 4. Awareness Story Model

Every awareness story should follow a simple reasoning path:

```text
Situation
↓
Evidence
↓
Confidence
↓
Recommendation
```

### Situation

The situation is the plain-language condition Gridly believes the user should know about.

Examples:

- Heavy rain may slow travel.
- A crossing may be blocked.
- A nearby road closure may affect routes.
- Community reports are increasing.
- Conditions look quiet right now.

### Evidence

Evidence explains what supports the situation.

Examples:

- Recent community reports mention water over roads.
- Heavy rain is occurring nearby.
- Official roadway information shows a lane restriction.
- Rail activity is present near a crossing.
- Few recent reports have been submitted nearby.

### Confidence

Confidence communicates how strongly the available evidence supports the awareness story.

Examples:

- Low confidence: early signal, limited support.
- Moderate confidence: some support, but not enough for a stronger statement.
- High confidence: several recent signals agree.
- Very high confidence: recent, consistent, and officially supported evidence.

### Recommendation

The recommendation is the concise action or expectation.

Examples:

- Avoid flooded roads.
- Allow extra travel time.
- Expect detours.
- Reduce speed.
- Check your route before leaving.

### Awareness Story Examples

#### Flooding

```text
Flooding
↓
Community reports + heavy rain + official roadway impact
↓
High confidence
↓
Avoid low-water crossings.
```

Consumer story:

> Flooding may affect local travel. Recent reports and rain conditions point to water on some roads. Avoid low-water crossings and do not drive through water.

#### Train Blocking Crossing

```text
Blocked crossing
↓
Community reports + nearby rail activity
↓
Moderate to high confidence
↓
Allow extra travel time.
```

Consumer story:

> A crossing may be blocked nearby. People in the area have reported delays, and rail activity is present. Allow extra travel time or choose another crossing.

#### Road Closure

```text
Road closure
↓
Official roadway information + map location
↓
High confidence
↓
Expect detours.
```

Consumer story:

> A road closure may affect travel nearby. Official roadway information shows an active closure in this area. Expect detours and slower travel.

#### Heavy Rain

```text
Heavy rain
↓
Weather + community reports increasing
↓
Moderate confidence
↓
Expect slower travel.
```

Consumer story:

> Heavy rain may slow travel. Conditions are changing, and local reports are beginning to increase. Leave extra time and watch for standing water.

#### Fog

```text
Fog
↓
Weather + location context
↓
Moderate confidence
↓
Reduce speed.
```

Consumer story:

> Fog may reduce visibility near you. Drive slower, use headlights, and allow more space.

#### Quiet Day

```text
Quiet conditions
↓
Few recent reports + no major weather or roadway impacts
↓
Moderate confidence
↓
No major local issues are visible right now.
```

Consumer story:

> Conditions look quiet right now. Gridly does not see major local issues nearby, but conditions can change.

## 5. Story Templates

These templates define the preferred consumer shape for common awareness situations. They are product guidance only and do not implement runtime behavior.

### Quiet Day

Headline: `Conditions look quiet right now.`

Body: `Gridly does not see major local issues nearby. Conditions can change, so check again before leaving.`

Recommendation: `No major delays are visible right now.`

### Heavy Rain

Headline: `Heavy rain may slow travel.`

Body: `Rain is affecting the area. Roads may be slick, and standing water may develop in low spots.`

Recommendation: `Leave extra time and watch for water on the road.`

### Flooding

Headline: `Flooding may affect local roads.`

Body: `Recent local evidence points to water near travel areas. Low spots and low-water crossings may become unsafe quickly.`

Recommendation: `Avoid flooded roads and never drive through water.`

### Train Blocking Crossing

Headline: `A crossing may be blocked nearby.`

Body: `Local evidence points to rail-related delay near this area.`

Recommendation: `Allow extra travel time or choose another crossing.`

### Road Closure

Headline: `A nearby road closure may affect travel.`

Body: `Official roadway information shows a closure in this area.`

Recommendation: `Expect detours and check your route before leaving.`

### Traffic Congestion

Headline: `Traffic may be slower than usual.`

Body: `Local conditions point to congestion near this area.`

Recommendation: `Allow extra time.`

### Strong Winds

Headline: `Strong winds may affect travel.`

Body: `Wind conditions may make driving harder, especially for high-profile vehicles and open roads.`

Recommendation: `Use caution and keep both hands on the wheel.`

### Fog

Headline: `Fog may reduce visibility.`

Body: `Visibility may be limited in parts of the area.`

Recommendation: `Slow down, use headlights, and allow more space.`

### Multiple Simultaneous Conditions

Headline: `Several conditions may affect travel.`

Body: `Gridly sees more than one local issue, including weather and roadway impacts.`

Recommendation: `Check your route and leave extra time.`

### Community Activity Increasing

Headline: `Local reports are increasing.`

Body: `More people nearby are reporting conditions that may affect travel.`

Recommendation: `Check nearby details before leaving.`

### Community Activity Quiet

Headline: `Community activity is quiet.`

Body: `Few recent local reports are visible right now.`

Recommendation: `No community-reported issues stand out nearby.`

## 6. Recommendation Framework

Recommendations should be concise, practical, and tied to the situation. They should not sound like legal, engineering, or provider language.

| Situation | Recommendation ownership | Preferred recommendation |
| --- | --- | --- |
| Flooding | Safety-first travel awareness | Avoid flooded roads. |
| Train blocking crossing | Travel-time awareness | Allow extra travel time. |
| Fog | Visibility awareness | Reduce speed. |
| Heavy rain | Weather travel awareness | Expect slower travel. |
| Road closure | Official roadway impact awareness | Expect detours. |
| Traffic congestion | Delay awareness | Leave extra time. |
| Strong winds | Driving condition awareness | Use caution on open roads. |
| Multiple conditions | Combined awareness | Check your route before leaving. |
| Quiet day | Normal-condition awareness | No major local issues are visible right now. |

Recommendation rules:

- Keep recommendations short.
- Use direct verbs.
- Prefer one action per recommendation.
- Avoid technical certainty when evidence is incomplete.
- Avoid navigation promises.
- Avoid naming data providers.
- Escalate to safety language only when the situation warrants it.

## 7. Confidence Framework

Confidence describes how strongly the evidence supports the awareness story. Confidence is not a legal guarantee, a safety certification, or a replacement for official emergency instructions.

### Low Confidence

Use when evidence is early, sparse, old, or uncertain.

Consumer wording:

- `Early signs point to this, but evidence is limited.`
- `Gridly has limited recent evidence for this condition.`

### Moderate Confidence

Use when some evidence supports the story, but support is incomplete or changing.

Consumer wording:

- `Some recent evidence supports this.`
- `Conditions may be developing.`

### High Confidence

Use when multiple recent signals agree or when strong official evidence supports the story.

Consumer wording:

- `Several recent signals support this.`
- `Gridly sees strong evidence for this condition.`

### Very High Confidence

Use when evidence is recent, consistent, locally relevant, and officially supported or strongly verified by multiple independent signals.

Consumer wording:

- `Recent local evidence and official information strongly support this.`
- `Gridly sees very strong support for this condition.`

### What Increases Confidence

- Community agreement.
- Freshness.
- Multiple evidence sources.
- Official confirmation.
- Recent observations.
- Local clustering.
- Consistency over time.
- Clear map relationship to the user's area.

### What Lowers Confidence

- Old reports.
- Conflicting reports.
- Sparse evidence.
- Rapidly changing conditions.
- Unclear location.
- Isolated single-source signals.
- Evidence outside the user's practical travel area.

## 8. Evidence Transparency

Gridly should offer a simple evidence experience that answers: "Why Gridly says this."

The evidence experience should support trust without exposing internal infrastructure.

### Example Evidence Experience

```text
Why Gridly says this

Community
✓ 4 reports
Latest: 6 minutes ago

Weather
Heavy rain nearby

Transportation
Lane restriction nearby

Rail
1 active crossing

Confidence
High
```

### Evidence Transparency Rules

Always use consumer labels:

- `Community`, not report-table names.
- `Weather`, not provider names.
- `Transportation`, not feed names.
- `Rail`, not internal crossing systems.
- `Location`, not coordinates-first language.
- `Confidence`, not score variables.

Never expose:

- API names.
- Provider terminology.
- Internal IDs.
- Database fields.
- Raw source payloads.
- Engineering classifications.

Evidence should be plain, compact, and understandable at a glance.

## 9. Consumer Language Standard

Gridly should sound calm, useful, and local.

Always use:

- Plain language.
- Short sentences.
- Action-oriented recommendations.
- Professional tone.
- Local context when useful.
- Conservative wording when evidence is incomplete.

Avoid:

- Database terminology.
- Provider terminology.
- Engineering language.
- Internal classifications.
- Acronyms that users do not need.
- Alarmist language unless there is a serious safety reason.
- Overly precise claims that evidence does not support.

Preferred language examples:

- Say `Heavy rain may slow travel.`
- Do not say `NOAA precipitation intensity exceeds threshold.`
- Say `A road closure may affect travel nearby.`
- Do not say `TxDOT event record matched route geometry.`
- Say `A crossing may be blocked.`
- Do not say `FRA crossing state indicates obstruction.`
- Say `Recent local reports support this.`
- Do not say `Supabase rows confirm incident cluster.`

## 10. Future Opportunities

These ideas are future concepts only. They do not define runtime behavior for this branch.

### Trust Reasoning

Gridly may eventually explain why one awareness story is trusted more than another when signals conflict.

### Historical Awareness

Gridly may eventually compare current conditions with patterns from similar days, seasons, events, or locations.

### Predictive Awareness

Gridly may eventually identify likely near-future impacts, such as flood-prone corridors during heavy rain or recurring crossing delays.

### Location-Based Verification

Gridly may eventually use proximity, direction of travel, or user-selected areas to determine which awareness stories matter most.

### Official Source Weighting

Gridly may eventually apply explicit weighting rules when official roadway information confirms or contradicts community reports.

### Travel Impact Summaries

Gridly may eventually summarize likely impacts for a county, corridor, commute, or destination area.

### Daily Awareness Briefing

Gridly may eventually provide a simple daily briefing that highlights what matters before common travel times.

## 11. Non-Goals

This framework does not implement:

- Runtime changes.
- Weather UI.
- Transportation UI.
- Notification systems.
- AI summaries.
- Prompt engineering.
- Provider changes.
- Routing.
- Navigation.
- Map behavior changes.
- API changes.
- Audit behavior changes.
- Existing intelligence changes.

This document is a product, documentation, and architecture blueprint only.

## 12. Product Vision

Gridly should become a trusted daily awareness companion that quietly combines community knowledge, official information, weather, railroad activity, and local context into one simple answer:

> Know Before You Go.
