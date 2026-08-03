# LP120 — Adjacent County Manufacturing Wave 1

## Scope and safety result

LP120 ran the existing LP114 top-level orchestrator for Lee (48287), Milam (48331), and Robertson (48395) Counties as one geographically coherent, inactive-candidate wave. The run reused LP115 crossing manufacture, LP116 roadway source handling, LP117 generalized asset manufacture, and the LP118 TIGER source contract. No manufacturing limitation was found, so no pipeline, runtime, protected-system, certificate-schema, or county-specific behavior was changed.

The run was candidate-only. It performed no upload, Supabase mutation, deployment, activation, promotion, selector expansion, production manifest/package replacement, or production authorization. Generated working reports remain local under `reports/lp120-wave-1/`; only the standardized governed readiness record is retained in `evidence/lp120/`.

## Reproducible execution

The baseline was `bd68e4d1`. The operator ran:

```text
node tools/lp114/manufacture-county-bundle.mjs --fips 48287,48331,48395 --reports reports/lp120-wave-1 --crossing-source Crossing-Packages/Texas/fra-crossings-tx.geojson --roadway-boundaries assets/boundaries/texas-counties-boundaries.geojson --dry-run
```

`--dry-run` prevents the orchestrator from attempting address manufacture without the owner-controlled TxGIO geodatabase; it does not suppress available LP115 or LP117 candidate manufacture. The exact source hashes, candidate counts, certification outcomes, blockers, and review states are recorded in `evidence/lp120/adjacent-county-manufacturing-wave-1-readiness.json`.

## Authoritative-source preflight

| Source family | Result | Evidence and classification |
| --- | --- | --- |
| TxGIO addresses | `SOURCE_UNAVAILABLE` | No owner-local TxGIO 2026 geodatabase or prebuilt package existed for any wave county. Address manufacture and certification are `NOT_RUN`; this is not a pipeline failure. |
| FRA crossings | `PASS` | The governed statewide FRA source at `Crossing-Packages/Texas/fra-crossings-tx.geojson` was readable and selected/certified independently by LP115. |
| TIGER 2025 county roads | `SOURCE_UNAVAILABLE` | Requests for each canonical Census `tl_2025_<FIPS>_roads.zip` URL returned HTTP 403 from the environment proxy, and no owner-local archive existed. LP118/LP116 roadway extraction, packaging, and certification are `NOT_RUN`; this is not a manufacturing limitation. |
| County boundary | `PASS` | Each FIPS matched exactly one feature in `assets/boundaries/texas-counties-boundaries.geojson`; LP117 produced one inactive boundary candidate per county. |
| ZIP coverage | `PASS` | LP117 selected county relationships from `data/generated/gridly-zip-county-source-v1.json`, preserving split-county ambiguity. |

Temporary download attempts were made only under `/tmp/lp120-tiger` and produced no archive. They are not repository artifacts.

## Independent county results

| County | Boundary | Crossings | ZIP relationships | Addresses | Roadways | Human gates | Readiness |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| Lee (48287) | 1 (`PASS`) | 47 (`PASS`) | 11 (`PASS`) | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `REVIEW_REQUIRED` | `BLOCKED` |
| Milam (48331) | 1 (`PASS`) | 110 (`PASS`) | 3 (`PASS`) | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `REVIEW_REQUIRED` | `BLOCKED` |
| Robertson (48395) | 1 (`PASS`) | 169 (`PASS`) | 4 (`PASS`) | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `SOURCE_UNAVAILABLE` / `NOT_RUN` | `REVIEW_REQUIRED` | `BLOCKED` |

All three crossing certifications passed. No address or roadway certification was claimed because its authoritative input was unavailable. Community/locality candidates contain zero invented records; curated destinations contain zero inferred records. Community/locality, curated-destination, search, candidate-promotion, and production-authorization decisions remain human governed. Candidate promotion is `REVIEW_REQUIRED`, while production authorization is `BLOCKED`.

## Readiness decision and next gate

Each county is independently `BLOCKED`, not failed: the owner must supply the authentic TxGIO source and TIGER 2025 archives, rerun LP114, and retain the new technical certificates. Named reviewers must then complete community, curated-destination, and search review. Promotion and activation require a separate authorized milestone after those gates; LP120 makes no merge-to-production recommendation.
