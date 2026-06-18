# Montgomery County Implementation Asset Structure

This directory reserves locations for future Montgomery County implementation artifacts. It does not contain runtime data, activation records, registry entries, Supabase changes, migrations, or Montgomery boundary GeoJSON.

## Source, Implementation, and Runtime Separation

- **Source Assets:** `assets/county-sources/montgomery/`
  - Local authoritative source materials are stored here, including `assets/county-sources/montgomery/census-tiger-2025/`.
  - Source assets remain reference materials only and are not implementation artifacts.
- **Implementation Artifacts:** `assets/county-implementation/montgomery/`
  - Future Montgomery implementation work products belong here after separate approval.
  - This structure is staged for organization only and does not activate or onboard Montgomery County.
- **Runtime Assets:** `data/`
  - Runtime assets are intentionally excluded from this milestone.
  - No implementation artifacts should be placed into `data/` until separately approved.

## Folder Purposes

- `boundary/` — Reserved for future approved Montgomery boundary implementation artifacts. No boundary GeoJSON is created by this milestone.
- `registry/` — Reserved for future approved county registry implementation artifacts. No registry records are created or modified by this milestone.
- `manifests/` — Reserved for future approved manifests that describe implementation artifact inventories or provenance.
- `containment/` — Reserved for future approved containment documentation or controls that keep Montgomery work isolated until activation is authorized.
- `rollback/` — Reserved for future approved rollback plans or rollback support artifacts.
- `activation/` — Reserved for future approved activation artifacts. Montgomery is not activated by this structure.
- `validation/` — Reserved for future approved validation outputs and checks.
- `evidence/` — Reserved for future approved evidence records supporting Montgomery implementation decisions.

## Protected Boundary

This structure-only milestone must not change Liberty boundary data, runtime county data, Supabase configuration, application code, historical systems, DriveTexas, Transportation Intelligence, Shared Reports, Route Watch, Awareness Filtering, Hazard Lifecycle, Alert Generation, or Supabase Sync.
