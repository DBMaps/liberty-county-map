# LP182 — Scope-Aware Physical-Device Validation Authorization Policy

## Decision

LP182 adds a second, independent authorization layer beside the immutable LP167/LP176 global-operation model. Every global operation remains `NOT_AUTHORIZED`. The new policy is available, but the current scope is `POLICY_READY_OWNER_APPROVAL_REQUIRED`; this milestone request is not treated as approval to execute.

The only eligible scope is `preview.gridlygo.com`, `PHYSICAL_DEVICE_VALIDATION`, `OWNER_APPROVED_TESTERS`, and the exact protected Git-blob set at candidate commit `6a1489aebd7cb8ad9e730ca87d08247a421747cf`. A changed commit or protected blob is stale and requires reassessment.

## Access and discoverability

Technical access control is required: an authenticated allowlist or equivalent owner-controlled admission mechanism. It is a prerequisite, not something LP182 configures. Obscurity, an unannounced URL, and `noindex` do not qualify. `noindex` is only supplemental. Marketing links, sitemap/canonical promotion, social announcements, and public-launch messaging are prohibited.

## Prerequisite boundary

Physical-device validation is not a prerequisite to starting that same bounded validation. Android/iOS release builds, Play/TestFlight, store accounts, and store assets are native-distribution prerequisites. Full legal approval remains a public-launch prerequisite because this preview requires owner-controlled admission and is not a public offering. Explicit scope-specific owner approval remains mandatory before scoped deployment or distribution.

## Rollback and restore

Before execution, a separate milestone must record a prior known-good preview artifact and an available manual mechanism to disable the preview or redeploy that artifact. The policy conditionally preauthorizes rollback solely to undo an authorized `preview.gridlygo.com` deployment; it never changes global Rollback authorization and never touches `gridlygo.com`. Restore is not applicable to this static preview scope, while global Restore remains `NOT_AUTHORIZED`.

## Closure

The validation window expires at the first of: completed Android and iPhone owner evidence, explicit owner closure, candidate identity change, or hostname change. A security defect, material runtime defect, owner revocation, or a rollback need without an available mechanism revokes the scope.

LP182 performs no deployment, distribution, DNS change, hosting configuration, activation, public launch, restore, or rollback. Runtime and protected systems are unchanged.
