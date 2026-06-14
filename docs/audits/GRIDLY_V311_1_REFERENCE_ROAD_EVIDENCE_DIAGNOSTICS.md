# Gridly V311.1 Reference Road Evidence Diagnostics

## Purpose

V311.1 is an audit-first diagnostics patch for road-name and reference-road evidence. It exposes which evidence each live surface consumes before any production wording, resolver selection, or formatter behavior is changed.

The new helper is:

```js
window.gridlyReferenceRoadEvidenceAudit?.()
```

## Behavior guarantee

This patch does **not** change visible app wording, report coordinates, Tap Map placement, hazard placement, crossing coordinates, FRA data, Supabase sync, alert generation, Route Watch behavior, directional display, data models, or resolver selection logic.

The helper only reads current runtime state, DOM datasets, active incident/report arrays, alert render caches, and unified incident records. It returns a structured audit object and logs the same object to the console.

## Diagnostic fields

Each audited row includes:

- `incidentId`
- `incidentType`
- `sourceType`
- `lat` / `lng`
- `primaryRoadDisplayed`
- `referenceRoadDisplayed`
- `crossingNameDisplayed`
- `cityAreaDisplayed`
- `nearestRoadCandidate`
- `nearbyRoadCandidates`
- `rawRoadFields`
- `normalizedRoadFields`
- `formatterPath`
- `surfacePath`
- `finalDisplayedText`
- `qualityClassification`
- `flags`

The helper inspects currently available evidence from these live/runtime surfaces:

- Awareness headline DOM
- Alert card DOM and alert render caches
- Leaflet popup DOM, when present
- Marker metadata DOM, when present
- Unified incident records
- Active incident records
- Active hazard models
- Active crossing/report models

## Quality classifications

Rows are classified as:

- `strong`: primary road plus a useful distinct reference road or crossing name.
- `acceptable`: primary road only, but still clear enough for audit purposes.
- `weak`: evidence is present but likely not the most useful human-facing reference.
- `mismatch`: surfaces disagree for the same incident/report key.
- `duplicate phrasing risk`: repeated primary/reference wording may produce text such as `US 90 at US 90 at Waco Street`.
- `missing evidence`: no usable road, reference, or crossing evidence was found.

## Waco/Sawmill risk

The helper specifically flags `waco-sawmill-reference-risk` when all of the following are true in the audited runtime evidence:

1. The primary road resolves as US 90.
2. Nearby/reference candidates include both Waco Street and Sawmill Road.
3. The displayed reference road is Sawmill Road.
4. The crossing/report context contains Waco evidence.

This is diagnostic only. V311.1 intentionally does not change the displayed text or resolver winner.

## Mismatch detection

The audit reports mismatches when rows sharing the same incident/report key use different reference roads or visibly different road labels across alert cards, popups, marker metadata, unified incident records, active incident records, and other inspected surfaces.

It also flags when the nearest road differs from the human-facing reference road, and when duplicate road phrasing appears likely.

## How to use

1. Load the app in the state to inspect, preferably mobile portrait for the US 90 / Waco Street scenario.
2. Ensure the target blocked crossing, road hazard, alert card, marker, and popup surfaces are active/open as needed.
3. Run:

```js
window.gridlyReferenceRoadEvidenceAudit?.()
```

4. Review:
   - `rows` for per-surface evidence.
   - `mismatchFindings` for disagreement between surfaces.
   - `wacoSawmillFindings` for the known US 90 / Waco / Sawmill risk.
   - `duplicatePhrasingFindings` for repeated road-label wording.
   - `nearestHumanReferenceDifferences` for cases where the technical nearest road differs from the displayed human reference.

## Recommended future fix scope

A future patch should remain separate from this audit. Recommended scope:

1. Add side-by-side reference-road candidate scoring that preserves current output while showing proposed output.
2. Prefer context-supported crossing/reference names over technically closest but weak candidates when confidence is high.
3. Keep primary-road resolution unchanged unless a separate audit proves a primary-road issue.
4. Add regression coverage for US 90 / Waco Street / Sawmill Road before changing production wording.
5. Roll formatter and resolver changes independently so alert cards, awareness headlines, popups, marker metadata, and route details can be compared before live text changes.
