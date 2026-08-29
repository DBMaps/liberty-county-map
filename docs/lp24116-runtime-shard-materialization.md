# LP241.16 frozen-authority runtime-v2 materialization

This is local-input, non-production build tooling. `--authority-input <path>` takes precedence over the repository-relative default `owner-local/lp24111/identity-governed-eligible.parquet`. The input remains ignored and is never copied into Git. The dependency audit found no existing Node Parquet reader and found that the DuckDB CLI is optional/missing in repository tests rather than a reliable prerequisite. The build therefore uses exactly pinned `hyparquet@1.17.0`, an Apache-2.0 pure-JavaScript ESM package with no native compilation or dependency tree, solely in LP241.16 development tooling. Its random-access file adapter and required-column projection avoid a second whole-file buffer; the one projected object representation for 391,772 compact rows is bounded local-build memory. Python is not used.

The exact projection is `id` → `id`, `display_name` → `displayName`, `gridly_category` → `gridlyCategory`, `latitude` → `latitude`, `longitude` → `longitude`, and `county_fips` → exact `data/lp149/runtime-county-registry.json` equality lookup → `countyContextId`. Non-empty `brand_text` becomes optional `brand`. No provenance summary is emitted because the frozen schema has no certified compact representation. The frozen standalone schema does not retain the richer authority's `sources` struct, so license conservation is bound to the frozen identity count and certified release-manifest aggregate; if row-level `sources` is supplied to the bounded projection API, it is counted and must match exactly.

The command validates bytes and SHA-256 before Parquet parsing, then validates schema, rows, identity, coordinates, county cardinality, licenses, legal bindings, two byte-identical builds, and every shard. Publication to `poi/lp24111-d5-standalone-2026-08-28/runtime-v2` is an atomic directory rename after success. Existing output is restored on publication failure.

```powershell
npm ci
npm run test:lp24116
npm run build:lp24116 -- --authority-input owner-local/lp24111/identity-governed-eligible.parquet
npm run verify:lp24116 -- --authority-input owner-local/lp24111/identity-governed-eligible.parquet
```

Until those owner-local build and verification commands succeed, only tooling—not the 391,772-row shard set—is certified.
