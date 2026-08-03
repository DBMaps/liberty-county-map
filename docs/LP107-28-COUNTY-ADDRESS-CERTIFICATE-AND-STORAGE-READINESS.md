# LP107 — 28-County Address Certificate and Storage Readiness

## Purpose and decision boundary

LP107 makes the 28 already-launched, locally generated TxGIO county packages certificate-complete and locally ready for a later controlled upload. At the start of LP107 all 28 gzip packages and their LP104.4 metadata existed locally; only Liberty had the production LP104.5 runtime certificate beside its package.

LP107 does **not** alter address data, rebuild packages, query TxGIO or NAD, upload to or prove existence in Supabase, activate any county remotely, deploy an Edge Function, or change address/search acceptance. Exact house number and canonical-road matching remain required; interpolation and nearby-house substitution remain forbidden.

## Certificate-generation contract

The generator uses the existing Liberty certificate schema and field order: `schemaVersion`, `milestone`, `countyId`, `county`, `fips`, `artifact`, `sizeBytes`, `sha256`, `sourcePackageModified`, and `acceptance`. The acceptance object retains `houseNumber: "exact"`, `road: "canonical_exact"`, `interpolation: false`, and `nearbyHouseSubstitution: false`.

For each governed county, the tool cross-checks the maintained initial-28 county identity, LP104 package manifest, and package sidecar; reads the governed `acceptedRecords` count from metadata; and independently hashes and sizes the existing gzip. It compares file identity before and after streaming the hash, fails closed on disagreement, validates output against the existing runtime certificate contract, writes missing certificates atomically, and leaves an already-correct certificate byte-for-byte unchanged.

The generated readiness inventory is local and untracked at `reports/lp107/storage-readiness.json`. Readiness requires the package and certificate to be present, their governed identity/size/SHA-256 values to agree, and the exact-address acceptance contract to validate. It is not evidence of a remote object.

## Private Storage naming for the later milestone

Bucket: `certified-addresses`

* Package: `lp104/txgio-addresses/<county>-<fips>.addresses.jsonl.gz`
* Certificate: `lp104/txgio-addresses/<county>-<fips>.runtime-certificate.json`

No keys, signed URLs, public URLs, user names, or absolute machine paths are emitted.

## Commands

Generate missing certificates for exactly the launched 28-county cohort and write the local inventory:

```bash
node tools/lp107/generate-runtime-certificates.mjs
```

Verify all governed package/certificate pairs without writing certificates:

```bash
node tools/lp107/generate-runtime-certificates.mjs --verify-only
```

Select one governed county when diagnosing local readiness:

```bash
node tools/lp107/generate-runtime-certificates.mjs --verify-only --county-fips 48291
```

Run focused tests:

```bash
npm run test:lp107
```

## Certification result and next step

The final governed run reports 28 packages present, 28 certificates present, 28 valid certificates, 28 package/certificate identities agreeing, and 28 counties locally ready for upload. The relevant LP099, LP102, LP104, LP104.5, LP104.7, LP105.2, and LP107 suites pass. Package hashes taken before and after generation agree, proving that LP107 did not modify a gzip package.

The remaining next step is a separately governed, controlled private Supabase Storage upload followed by remote runtime certification and activation. LP107 performs neither step.
