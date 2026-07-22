# LP044 — DriveTexas Community Authority Inventory

This deterministic repository artifact defines the LP044 passive inventory output location and schema. The repository does not contain a checked-in loaded DriveTexas provider cache, so the static artifact contains zero rows. In browser runtime, call `window.gridlyLp044DriveTexasCommunityAuthorityInventory?.()` after the existing DriveTexas connector has loaded retained normalized records to export the complete row set without fetches, polling, writes, storage writes, map movement, UI mutation, or Supabase writes.

## Static generation result

- Raw provider feature count: unavailable in repository artifact.
- Normalized record count: 0
- Unique sourceId count: 0
- Duplicate sourceId count: 0
- Point geometry records: 0
- LineString geometry records: 0
- MultiLineString geometry records: 0
- Missing geometry records: 0
- Invalid geometry records: 0
- Usable representative coordinate records: 0
- Neither usable geometry nor coordinates: 0

## Runtime certification scope

The passive helper evaluates trusted Point, LineString, and MultiLineString coordinates only. For roadway geometry it evaluates complete segment geometry against configured community authority circles and does not assign ownership from midpoint-only evidence. Nearest-community distance is informational only.
