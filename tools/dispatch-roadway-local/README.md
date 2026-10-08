# Governed roadway source registry — milestone 1

LOCAL DEVELOPMENT ONLY. No road graph, jurisdiction certification, permissions,
publication, backend changes, downloads or production connections.

Run from the repository root:

    node tools/dispatch-roadway-local/validate-registry.mjs
    node --test tests/dispatch-roadway-registry.test.mjs

The validator accepts no path/URL overrides and writes no artifacts. It reads
only two reviewed geometry inputs, the existing preview provenance, pinned statewide
roadway manifest and pinned Texas FIPS inventory. Statewide data/roadway-runtime-manifest.json remains the packaging
reference: its hash, 254-county count and Liberty source path/status are checked.
No remote asset is fetched. No current UI imports this module; the certified picker/composer and authenticated launcher remain unchanged.

## Identity and geometry contract

A reviewed manifest is the trust input. Never take it from browser-selected
organization, role or unit context. Identity is namespace + source feature ID +
geographic package + sorted applicable county FIPS. Names/routes are aliases.
Multi-county membership expresses package metadata, not verified line containment.
Geometry version separately retains source snapshot/version, complete input hash,
parent source hash and geometry digest. Operational segment identity is null.
The approved version labels are local registry labels, not invented provider release
versions; the provider snapshot is the existing source timestamp. Selections
additionally bind provenance hash and snapshot; changed inputs or
versions require explicit review. No nearest-road replacement or remapping exists.

Geometry digest is SHA-256 of UTF-8 JSON.stringify(geometry). This binds the parsed
numeric representation, not original feature text bytes. Full input SHA-256 pins
original file bytes. No rounding, simplification, snapping, joining or splitting
occurs. All returned geometry/provenance is deeply frozen. MultiLineStrings retain
separate components. Positions must be finite two-dimensional lon/lat in CRS84.
Missing/foreign CRS and unsupported structures fail closed; an absent GeoJSON CRS
member is accepted only with a reviewed explicit CRS84 manifest declaration.

Only VALID source geometry and GOVERNED_LOCAL identity are asserted. Topology,
boundary relationship and roadway authority remain UNVERIFIED; publication is
DISABLED. Geometry validity is structural, not surveyed positional accuracy.

## Actual source and license gate

Both approved inputs identify OpenStreetMap data and ODbL licensing. The original
Liberty source copyright/timestamp and existing preview provenance are reused;
preview attribution names www.openstreetmap.org. Preserve OpenStreetMap attribution
and ODbL notices: https://www.openstreetmap.org/copyright and
https://opendatacommons.org/licenses/odbl/1-0/ .

This milestone is local validation only; it creates no redistributed database or
public service. Any future exported/redistributed derived database must separately
review applicable ODbL attribution, license notice and share-alike obligations.
File presence is not a license approval for other sources. No new provider or
permission is inferred; future inputs with missing license/provenance are blocked
until a reviewed manifest and source evidence exist.

The preview contains 331 existing in-bounds OSM lines, not operational segments.
The original Liberty collection has 8,407 features. Its two Polygon features are
explicitly excluded from the road registry; 8,405 LineStrings are retained exactly.
The preview provenance pins their common parent source, timestamp and license.
Its 331 count/extraction description applies only to the preview; the validator's
Liberty descriptor explicitly records the separate count and exclusion policy.
No new source asset/fixture/manifest file is needed. Descriptor pins are reviewed
constants in validate-registry.mjs and are never regenerated at runtime.

## Bounds and Texas expansion

20 MiB input, 45,000 features, 1,000,000 positions, 50 selections and 40 search
results are hard local limits. The validator checks file size before reading and
processes the two packages sequentially; hashes occur before geometry parsing.
Search/map indexing and lazy geographic loading are later milestones. Do not load
statewide geometry into the browser. Reuse governed county/FIPS, hashes, package
versions and partition manifests; do not merge same-name or same-ID roads across
packages without separately certified lineage. This module is generic; only the
approved local validator descriptors identify Liberty and the existing preview.

Next gates: governed node/grade-separation topology, operational segment identity,
whole-line boundary certification, then independently evidenced issuing authority.
None is satisfied by this registry or by real authentication.