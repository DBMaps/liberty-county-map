# LP188.11 owner-controlled evidence handoff

Only evidence produced by execution of `LP18810-NP-001` in the owner-controlled protected/non-production environment belongs in `execution-results/`. Copy `template.json` to a new portable JSON file and add one result per attempted FIPS. Each result must bind `countyFips`, the LP188.5 `packageSha256`, and `schemaVersion`; contain `PASS`, `FAIL`, or `NOT_RUN` for deployment, runtime, regression, consumer, boundary, telemetry, rollback, and operational results; and contain executor and independent-review status plus portable identity references. Never include credentials, machine-local paths, production evidence, or activation authorization.

Evidence can be partial, but duplicate or unknown FIPS and identity mismatches fail closed. The template is ignored by ingestion. Run `npm run build:lp18811`, `npm run test:lp18811`, and `npm run verify:lp18811` after returning evidence.
