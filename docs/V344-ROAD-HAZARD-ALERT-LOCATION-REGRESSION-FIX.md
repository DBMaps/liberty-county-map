# V344 — Road Hazard Alert Location Regression Fix

## Goal

Fix the V343 follow-up regression where active flooding incidents remain visible but alert cards can describe the same road hazard with a weaker fallback location than the top awareness headline.

## Root cause

The awareness headline already used the V322.2/V322.5 rendered road-hazard location identity, but alert-card shaping could enter through localized alert summaries or resolver fallback fields. In that path, a flooding card could keep a stale fallback such as `US 90 at Waco Street` even when the authoritative rendered incident identity was `FM 1960 2 Miles West of Dayton`.

## Fix

V344 adds a road-hazard authoritative-location bridge used by alert cards and popup consumer models. For road hazards, location resolution now prefers:

1. the final rendered awareness/headline location identity,
2. the stable V322.2/V322.5 road-hazard authoritative label,
3. normalized road-hazard road/location fields,
4. resolver fallback only as a last resort.

This preserves the rule: one road hazard should have one best available location identity across awareness, alert card, detail, and popup surfaces.

## Audit

`window.gridlyRoadHazardAlertLocationRegressionAudit?.()` returns the V344 contract, including `policyVersion`, mismatch/correction counts, expected/actual location labels, `us90WacoFallbackDetected`, `fm1960LocationPreserved`, and preservation flags for V322.2 and V343.

## Scope guard

V344 does not alter V343 suppression ordering, lifecycle rules, Supabase writes, marker placement, reporting UX, Route Watch, crossings, DriveTexas architecture, hazard taxonomy, or official-source ownership.
