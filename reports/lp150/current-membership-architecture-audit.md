# LP150 Current Runtime Membership Architecture Audit

Generated at: 1970-01-01T00:00:00.000Z

## Authoritative Membership Path

1. LP138 records the current operational 28-county baseline in `evidence/lp138/county-geometry-membership-contract.baseline.json`.
2. The production runtime geometry manifest remains `assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json` and reports 28 packaged runtime counties.
3. LP148 statewide geometry is identity/readiness evidence only via `assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json` and must not expand production selection.
4. LP149 collects all 254 runtime identities in `data/lp149/runtime-county-registry.json`; identity recognition does not authorize membership.
5. LP150 adds a non-authorizing candidate contract at `data/lp150/candidate-membership-contract.json` and resolver output at `data/lp150/membership-transition-registry.json`.

## Coupling Findings

- Current runtime membership is governed by the LP138 baseline and current production runtime manifest.
- LP149 statewide identities are recognition-only and must not be used as runtime membership.
- Package and certificate evidence demonstrate readiness only; they do not imply approval, deployment, or activation.
- LP150 introduces validation-only transition gates and performs no runtime selection changes.
