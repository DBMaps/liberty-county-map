# Stage 4A design carried into Stage 4B

Source: the owner's approved Stage 4A chat report, classification `AUTHORIZATION_REPAIR_DESIGN_READY`, plus the preceding `reports/build19-labels-authorization/REPORT.md`. The Stage 4A report was delivered in chat and did not create a repository file. This file records its implementation decisions without changing that prior report.

- Keep `gridly-subscription-verification-v1`, existing subscription schema/RPCs, signed entitlement proofs and paid-report verification unchanged.
- Add only `gridly-labels-lease-v1` challenges, fixed to the Gridly consumer app, Sandbox StoreKit and production App Attest for this candidate.
- Add a private challenge table and three narrow procedures in the authoritative registry's database; use the existing registered key/counter row. No labels registration or second counter.
- Lock the labels challenge then its shared key; recheck wall-clock expiry after locks. Counter update and challenge consumption must commit/roll back together. Raise on post-mutation failure.
- Keep registry consumption separate from existing final labels admission. A later failure can burn a counter/challenge but cannot return a reusable grant or lease. Never rewind counters.
- Bind owner, exact paid-evidence digest and native tile P-256 fingerprint using the existing canonical labels binding.
- Reuse the unchanged App Attest cryptographic verifier and existing trusted Apple verifier/normalizer; never use client flags, continuity grants or subscription proofs alone as labels eligibility.
- Change the prototype identity only in an isolated consumer gateway composition. Preserve the signed fixed-path POST, five-minute/paid-period lease bound, quotas, replay controls, imagery fallback and disabled defaults.
- Add native-only helpers to candidate plugin copies using their existing state instances. Preserve bridge methods, Keychain, confirmation and purchase completion behavior. Labels requires a confirmed key and cannot register one.
- Genuine access to the existing consumer key requires an approved authoritative-registry connection and counter writes. Do not treat an isolated key/counter copy as cross-purpose replay protection.
- Stage 4B implements/tests locally only. Hosted certification, real services, consumer integration, signing and TestFlight are separate gates.
