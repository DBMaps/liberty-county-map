# Gridly Consumer Language Standard V1

## Purpose

This standard defines how Gridly should speak to people when presenting awareness. It supports the Awareness Intelligence Framework by keeping Gridly's language plain, calm, action-oriented, and free of internal system terminology.

Gridly should help people answer:

> What do I need to know before I leave?

Gridly should not require people to understand providers, data feeds, databases, records, IDs, or engineering systems.

## Core Writing Principles

Gridly language should be:

- Plain.
- Short.
- Local.
- Useful.
- Professional.
- Action-oriented.
- Evidence-supported.
- Calm unless immediate safety language is needed.

Gridly language should avoid:

- Provider names.
- API names.
- Database fields.
- Internal IDs.
- Engineering terms.
- Source payload language.
- Unexplained acronyms.
- Overconfident statements.
- Alarmist wording.

## Headline Style

Headlines should explain the condition in one short sentence. They should be understandable without opening details.

### Headline Rules

- Use sentence case.
- Prefer 4 to 9 words when possible.
- Lead with the condition or impact.
- Use `may` when evidence is developing.
- Avoid source names.
- Avoid technical measurements unless users need them.

### Preferred Headline Examples

- `Conditions look quiet right now.`
- `Heavy rain may slow travel.`
- `Flooding may affect local roads.`
- `A crossing may be blocked nearby.`
- `A nearby road closure may affect travel.`
- `Traffic may be slower than usual.`
- `Strong winds may affect travel.`
- `Fog may reduce visibility.`
- `Several conditions may affect travel.`
- `Local reports are increasing.`

### Avoid

- `NOAA alert detected.`
- `TxDOT incident active.`
- `Supabase report cluster found.`
- `FRA crossing event matched.`
- `Hazard confidence score exceeded threshold.`
- `Geospatial event intersection identified.`

## Recommendation Style

Recommendations should tell people what to consider doing next. They should be concise and tied to the awareness story.

### Recommendation Rules

- Start with a verb when possible.
- Keep one main action per recommendation.
- Avoid long explanations.
- Avoid legalistic language.
- Avoid navigation promises.
- Match urgency to evidence.
- Use safety language for flooding, visibility, severe weather, and blocked roads when appropriate.

### Preferred Recommendation Examples

- `Avoid flooded roads.`
- `Never drive through water.`
- `Allow extra travel time.`
- `Expect slower travel.`
- `Expect detours.`
- `Reduce speed.`
- `Use headlights.`
- `Check your route before leaving.`
- `Choose another crossing if possible.`
- `Watch for standing water.`

### Avoid

- `Execute alternate routing workflow.`
- `Proceed based on provider metadata.`
- `Route around event geometry.`
- `Review source payload details.`
- `Trust score indicates recommended avoidance.`

## Evidence Wording

Evidence wording should explain why Gridly is saying something without exposing implementation details.

### Evidence Rules

- Use user-facing source categories.
- Keep details scannable.
- Prefer counts, freshness, and simple condition labels.
- Use `nearby`, `in this area`, or named local context when useful.
- Never show internal IDs, table names, raw payload names, or provider labels.

### Preferred Evidence Labels

- `Community`
- `Weather`
- `Transportation`
- `Rail`
- `Location`
- `Map`
- `Confidence`

### Preferred Evidence Examples

- `Community: 4 recent reports.`
- `Latest report: 6 minutes ago.`
- `Weather: Heavy rain nearby.`
- `Transportation: Lane restriction nearby.`
- `Rail: 1 active crossing nearby.`
- `Location: This is close to your area.`
- `Map: Reports are clustered near the same road.`
- `Confidence: High.`

### Avoid

- `Provider: NOAA.`
- `Feed: TxDOT.`
- `Table: reports.`
- `Record ID: 18492.`
- `Crossing ID matched.`
- `Geometry intersection: true.`
- `Payload received at...`

## Confidence Wording

Confidence wording should help people understand how strongly the evidence supports the story.

Confidence should not sound like a guarantee. It should not imply that Gridly sees everything or replaces official emergency instructions.

### Low Confidence

Use when evidence is limited, old, conflicting, or early.

Preferred wording:

- `Limited evidence supports this right now.`
- `Early signs point to this.`
- `Gridly has limited recent evidence for this condition.`

Avoid:

- `Unverified truth state.`
- `Low model score.`
- `Insufficient confidence threshold.`

### Moderate Confidence

Use when some evidence supports the story, but the situation may still be developing.

Preferred wording:

- `Some recent evidence supports this.`
- `Conditions may be developing.`
- `Gridly sees a few signs of this nearby.`

Avoid:

- `Medium confidence classification.`
- `Partial source agreement.`
- `Moderate inference state.`

### High Confidence

Use when multiple recent signals agree or strong official evidence exists.

Preferred wording:

- `Several recent signals support this.`
- `Gridly sees strong evidence for this condition.`
- `Recent local evidence points to this.`

Avoid:

- `High confidence model output.`
- `Confirmed by provider payload.`
- `Confidence score: 0.86.`

### Very High Confidence

Use when evidence is recent, consistent, local, and strongly supported.

Preferred wording:

- `Recent local evidence and official information strongly support this.`
- `Gridly sees very strong support for this condition.`
- `Multiple recent signals agree.`

Avoid:

- `Very high confidence threshold met.`
- `Multi-provider deterministic agreement.`
- `Authoritative source priority override.`

## Community Wording

Community wording should describe what people nearby are experiencing.

### Preferred Community Phrases

- `People nearby are reporting water on the road.`
- `Local reports mention a blocked crossing.`
- `Recent reports are increasing in this area.`
- `Few recent community reports are visible right now.`
- `Reports are clustered near the same road.`
- `The latest report was a few minutes ago.`

### Avoid

- `User-generated incident rows.`
- `Crowdsource table entries.`
- `Report payload cluster.`
- `Reporter metadata.`
- `Supabase record freshness.`

## Official Wording

Official wording should communicate that roadway information is supported by an official source without naming provider infrastructure.

### Preferred Official Phrases

- `Official roadway information shows a closure nearby.`
- `Official roadway information shows a lane restriction.`
- `A reported roadway impact may affect travel.`
- `A closure is listed in this area.`
- `A detour may be needed.`

### Avoid

- `TxDOT feed confirms event.`
- `Official API event matched.`
- `Provider record indicates restriction.`
- `Source metadata confirms closure.`

## Weather Wording

Weather wording should describe conditions and likely travel impact.

### Preferred Weather Phrases

- `Heavy rain may slow travel.`
- `Rain is affecting the area.`
- `Standing water may develop in low spots.`
- `Fog may reduce visibility.`
- `Strong winds may affect driving.`
- `Storms are nearby.`
- `Roads may be slick.`

### Avoid

- `NOAA precipitation intensity detected.`
- `Weather connector returned alert.`
- `Meteorological threshold exceeded.`
- `Provider observation indicates...`

## Rail Wording

Rail wording should focus on crossing impact, not rail system internals.

### Preferred Rail Phrases

- `A crossing may be blocked nearby.`
- `Rail activity may affect this crossing.`
- `Local reports mention crossing delays.`
- `Choose another crossing if possible.`
- `Allow extra travel time near the tracks.`

### Avoid

- `FRA crossing matched.`
- `Rail runtime indicates active state.`
- `Crossing system event detected.`
- `Crossing identifier...`

## Location Wording

Location wording should make awareness feel local and relevant without overloading users with coordinates.

### Preferred Location Phrases

- `near you`
- `nearby`
- `in this area`
- `close to your route`
- `near the same road`
- `around this community`
- `in your county`

### Avoid

- `Latitude and longitude matched.`
- `Point-in-polygon result.`
- `Geofence intersection.`
- `Geometry match.`
- `Spatial index hit.`

## Situation Examples

### Quiet Day

Headline: `Conditions look quiet right now.`

Body: `Gridly does not see major local issues nearby. Conditions can change, so check again before leaving.`

Recommendation: `No major delays are visible right now.`

Evidence wording:

- `Community: Few recent reports.`
- `Weather: No major travel impact visible.`
- `Transportation: No nearby closure visible.`
- `Confidence: Moderate.`

### Heavy Rain

Headline: `Heavy rain may slow travel.`

Body: `Rain is affecting the area. Roads may be slick, and standing water may develop in low spots.`

Recommendation: `Leave extra time and watch for water on the road.`

Evidence wording:

- `Weather: Heavy rain nearby.`
- `Community: Reports are beginning to increase.`
- `Confidence: Moderate.`

### Flooding

Headline: `Flooding may affect local roads.`

Body: `Recent local evidence points to water near travel areas. Low spots and low-water crossings may become unsafe quickly.`

Recommendation: `Avoid flooded roads and never drive through water.`

Evidence wording:

- `Community: 4 reports mention water on roads.`
- `Weather: Heavy rain nearby.`
- `Transportation: Road impact nearby.`
- `Confidence: High.`

### Train Blocking Crossing

Headline: `A crossing may be blocked nearby.`

Body: `Local evidence points to rail-related delay near this area.`

Recommendation: `Allow extra travel time or choose another crossing.`

Evidence wording:

- `Community: Recent crossing delay reports.`
- `Rail: Activity near the crossing.`
- `Confidence: Moderate.`

### Road Closure

Headline: `A nearby road closure may affect travel.`

Body: `Official roadway information shows a closure in this area.`

Recommendation: `Expect detours and check your route before leaving.`

Evidence wording:

- `Transportation: Closure nearby.`
- `Map: Closure is near a local travel corridor.`
- `Confidence: High.`

### Traffic Congestion

Headline: `Traffic may be slower than usual.`

Body: `Local conditions point to congestion near this area.`

Recommendation: `Allow extra time.`

Evidence wording:

- `Community: Reports mention slow traffic.`
- `Transportation: Travel impact nearby.`
- `Confidence: Moderate.`

### Strong Winds

Headline: `Strong winds may affect travel.`

Body: `Wind conditions may make driving harder, especially for high-profile vehicles and open roads.`

Recommendation: `Use caution and keep both hands on the wheel.`

Evidence wording:

- `Weather: Strong winds nearby.`
- `Location: Open roads may be more affected.`
- `Confidence: Moderate.`

### Fog

Headline: `Fog may reduce visibility.`

Body: `Visibility may be limited in parts of the area.`

Recommendation: `Slow down, use headlights, and allow more space.`

Evidence wording:

- `Weather: Fog nearby.`
- `Location: Visibility may vary by road.`
- `Confidence: Moderate.`

### Multiple Simultaneous Conditions

Headline: `Several conditions may affect travel.`

Body: `Gridly sees more than one local issue, including weather and roadway impacts.`

Recommendation: `Check your route and leave extra time.`

Evidence wording:

- `Community: Recent reports nearby.`
- `Weather: Heavy rain nearby.`
- `Transportation: Roadway impact nearby.`
- `Rail: Crossing activity nearby.`
- `Confidence: High.`

### Community Activity Increasing

Headline: `Local reports are increasing.`

Body: `More people nearby are reporting conditions that may affect travel.`

Recommendation: `Check nearby details before leaving.`

Evidence wording:

- `Community: Reports increased recently.`
- `Latest report: 6 minutes ago.`
- `Confidence: Moderate.`

### Community Activity Quiet

Headline: `Community activity is quiet.`

Body: `Few recent local reports are visible right now.`

Recommendation: `No community-reported issues stand out nearby.`

Evidence wording:

- `Community: Few recent reports.`
- `Confidence: Moderate.`

## Tone Guide

Gridly should sound like a calm local companion, not a control room.

### Use This Tone

- `A nearby closure may affect travel.`
- `Recent reports mention water on the road.`
- `Conditions look quiet right now.`
- `Check your route before leaving.`

### Not This Tone

- `Incident telemetry indicates impact.`
- `User reports generated an alert state.`
- `Provider agreement confirms event.`
- `Automated intelligence produced recommendation.`

## Final Standard

Gridly should communicate the story, the support, and the practical next step.

The best Gridly message is one a person can understand in seconds:

> What is happening?
> Why does Gridly believe it?
> What should I consider before I leave?
