# Gridly PWA Icon Foundation

This folder is a text-only planning and inventory location for Gridly PWA and future app-store icon assets.

## Current production assets

V275.1 does not add or duplicate binary icon files. The PWA manifest references the existing production icons already present in the repository:

- `assets/icon-192.png` — existing Gridly production 192x192 icon.
- `assets/icon-512.png` — existing Gridly production 512x512 icon.

## Future export inventory

Future native packaging and store submissions should add brand-approved exports only when the repository and PR flow can safely handle the binary assets:

- `assets/icons/icon-1024.png` — future Apple App Store / Google Play source export.
- `assets/icon-512.png` — current existing PWA large icon export.
- `assets/icon-192.png` — current existing PWA install icon export.

## Notes

- No alternate logo or branding system was introduced for V275.1.
- No PNG files were created, copied, modified, or added in this text-only recovery.
- The manifest uses GitHub Pages-compatible relative paths to the existing icon assets (`./assets/icon-192.png` and `./assets/icon-512.png`).
- The existing 512px asset is reused for the maskable manifest placeholder until a dedicated safe-zone maskable export is produced in a future binary-safe phase.
