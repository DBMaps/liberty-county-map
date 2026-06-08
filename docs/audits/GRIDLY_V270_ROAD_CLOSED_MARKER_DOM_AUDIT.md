# Gridly V270 Road Closed Production Marker DOM Audit

Scope: verify why the Road Closed marker could still appear like the legacy generic hazard marker even when the production PNG image is present and loaded.

## Finding

The production marker DOM path is active: `renderUnifiedIncidents()` builds a Leaflet `L.divIcon` with `gridly-production-marker-icon`, embeds a `.gridly-hazard-marker.has-production-marker`, and loads `assets/markers/png/road-closed.png` through `.gridly-production-marker-img`.

The visual mismatch was not caused by asset normalization. The runtime hazard stylesheet injected by `injectHazardStyles()` reintroduced legacy hazard-marker badge/ring styling after the earlier production-marker reset. Late rules such as severity, confidence, and count/age badge styling could win in the cascade because they appear later in the injected stylesheet. That left the production PNG loaded while legacy marker chrome remained capable of painting over or around it.

## Runtime audit additions

`window.gridlyProductionMarkerAudit().renderedProductionMarkerDomAudit` now focuses Road Closed markers first and reports:

- Road Closed production marker DOM count.
- `unifiedIncidentLayer` marker count and Road Closed layer count.
- Whether layer counts and DOM counts agree.
- Duplicate production-marker DOM buckets.
- Nearby Leaflet marker siblings that could overlay the focused marker.
- Computed wrapper/marker/image size, visibility, z-index, border, background, and box-shadow.
- Visible legacy child elements (`small`, `b`, `span`, `svg`, and marker wrapper variants).
- `document.elementsFromPoint()` stack at the marker center.
- A `screenshotEvidenceTarget.clip` rectangle for focused screenshot capture.

## Fix applied

The production-marker reset is now repeated after the legacy hazard rules in both the static stylesheet and the injected runtime stylesheet. The late reset removes legacy border/background/box-shadow from `.gridly-hazard-marker.has-production-marker` and hides legacy direct child badges (`small` age and `b` count) so the production PNG is the visible marker artwork.

## Not in scope

PNG master-size normalization remains intentionally untouched. The dimension audit is still expected to fail until the assets are normalized to `256x256` transparent canvases.
