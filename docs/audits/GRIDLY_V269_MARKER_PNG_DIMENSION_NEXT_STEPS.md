# Gridly V269 Marker PNG Dimension Audit and Normalization Next Steps

## Required production marker master size

Every file in `assets/markers/png/` must be a `256x256` PNG on a transparent canvas before any additional production marker visual rendering is merged.

## Current audit command

Run this repository-local audit after any marker asset change:

```bash
node scripts/audit-marker-png-dimensions.mjs
```

The command reports each PNG filename, `naturalWidth`, `naturalHeight`, and `expectedSizePass`. It exits non-zero until every marker PNG is exactly `256x256`.

## Normalization workflow

1. Open each original marker artwork from the design/source file, not from a screenshot.
2. Remove all labels, text captions, opaque backgrounds, and decorative backplates that are not part of the marker artwork.
3. Place the visible marker artwork on a transparent square canvas.
4. Scale the visible marker artwork proportionally so it preserves the current marker appearance and visual weight.
5. Center the artwork horizontally and vertically on the transparent canvas.
6. Export each file to the same filename under `assets/markers/png/` as PNG with alpha transparency.
7. Re-run `node scripts/audit-marker-png-dimensions.mjs` and do not continue until it passes.
8. Re-run `window.gridlyProductionMarkerAudit()` in the browser and verify `summary.productionPngAssetDimensionPass === true` and `summary.visualRenderingMergeGate` starts with `PASS`.

## ImageMagick normalization template

If the existing source PNG already contains only the marker artwork on transparency, use this command pattern per file:

```bash
magick input.png -background none -alpha on -resize 220x220 -gravity center -extent 256x256 assets/markers/png/output.png
```

Use a smaller or larger resize box only when necessary to preserve the visible marker appearance across the full marker set. Do not flatten onto a background color.

## Merge gate

Do not merge additional visual rendering work until both checks pass:

```bash
node scripts/audit-marker-png-dimensions.mjs
```

```js
window.gridlyProductionMarkerAudit().productionMarkerAssetDimensionPass === true
```
