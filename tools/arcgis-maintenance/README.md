# ArcGIS maintenance preparation — November 5, 2026

Preparation only. No native build, sync, installation, provider request, upload or deployment is performed by the offline tests below. Do not run the existing `Prepare-GridlyNative.ps1` compose wrapper for this maintenance: it can regenerate the original provider input from local JavaScript.

## Frozen release inputs and explicit maintenance profile

- Android release: `86bf721ddaf5b85e8786b1d74da240a048c98f96`, 1.0.1 / versionCode16.
- iOS release: `71168111a133fa1c187620b9604b08e79fbf4687`, 1.0.1 / build17.
- The refs differ only in `tests/build13-native-pending-recovery.test.cjs`; shipping source is identical.
- Profile: `arcgis-satellite-labels-2026-11`.

`contracts.mjs` derives future metadata **in memory only**. Android accepts only the exact released Gradle file with versionCode17 and marketing version1.0.2. iOS accepts only the exact released project with build18 / version1.0.2 and the exact existing recovery source extended from 14/16/17 to 14/16/17/18. Whole-source inverse hashes reject other changes. Application identities, signing inputs, SDK36, Billing9.1.0, recovery logic and existing default checks are preserved.

The native project files remain at their released identities. Applying the derived metadata/recovery source is a separate owner-reviewed step. Numbers17/18 are provisional until the owner checks every uploaded build, including unreleased builds. No store number is reserved here. Android reviewer authorization is explicitly `UNVERIFIED_NOT_GRANTED`; no verifier or paid-admission authority is changed.

## Candidate staging boundary

The existing `tools/native-web.mjs --runtime-config-file` interface accepts a filename, never a credential value. Maintenance staging additionally requires:

1. `--arcgis-maintenance-profile arcgis-satellite-labels-2026-11`.
2. Explicit `--runtime-config-file` **candidate** and `--original-runtime-config-file` paths.
3. `--android-production` for Android; never license-test mode.
4. The exact future identity described above; the unchanged release projects intentionally fail this check.
5. A new, absent, ignored and untracked `www` output with no symlink/junction ancestors. Existing output is refused rather than deleted or merged.
6. A non-repository, non-synchronized candidate with owner-only protected Windows ACLs; SYSTEM/Administrators are allowed. Both file and parent directory are checked. On macOS the new read-only adapter requires an explicit `--maintenance-private-root`, owner600 file, owner700 root, safe ancestors and no ACL grants. Actual macOS execution remains ENVIRONMENT_UNAVAILABLE on Windows. A secure Mac-local input is not yet provisioned.

The JSON schema is exactly `arcgisStaticBasemapApiKey` and `driveTexas.apiKey`. Missing, extra, duplicate/escaped properties, empty/control-character/trim-damaged values and malformed JSON are rejected with fixed errors. The candidate ArcGIS value must differ; DriveTexas must match. Comparison uses fresh process-local HMACs that are never returned or recorded. Canonical runtime composition is additive and verified byte-for-byte; unrelated canonical settings remain intact. No default provider input or original-key fallback is accepted in maintenance mode.

Maintenance **verification** requires the same explicit candidate/original/profile inputs plus the recorded `--report-file`; it rechecks the staged runtime against the current private inputs. Apple maintenance attestation requires that same profile marker and retains existing clean-source, ancestry, entitlement, certificate/profile, signed-code, archive/IPA and file-inventory checks. A legacy/unmarked stage cannot pass maintenance attestation.

The `stageSyntheticMaintenanceRuntime` test writer accepts only values prefixed `SYNTHETIC_`, writes atomically outside repositories, refuses existing output and never writes native assets. Tests do not pass the real private candidate to this writer or to native staging.

## Diagnostic request gate

`diagnostic.mjs` is a host-side interception controller, excluded from the consumer script manifest and native web allowlist. It has no transport, native adapter, production import or automatic activation. It must receive an explicitly selected platform, private candidate in process memory, fixed owner run ID, observed native context, durable ledger and an authoritative interceptor installed before the first network operation across the whole isolated fixture.

Installation is unarmed. All traffic is denied until arming. Only unmodified GET requests to the documented Imagery Labels Static Basemap Tiles endpoint with exactly one matching token parameter can proceed. Other provider traffic, redirects, retries, wrong credentials, wrong origin and a third request are denied. Reserve before forwarding; one request may be in flight. HTTP/content/tile errors stop the session. There is no Referer or Origin fabrication.

`budget-ledger.mjs` atomically records reservations in a private host directory before dispatch. A stable run ID and the same ledger must survive controller/WebView restart. Never create a fresh ID to reset an exhausted test. Missing/corrupt/stale-locked budgets fail closed; existing budgets cannot be initialized again. An owner must bind one ledger/run to each platform for the entire separately authorized certification.

Evidence contains only request ordinal, platform, allowlisted origin/Referer classifications, HTTP status, allowlisted content type, structural PNG/CRC validity and rendering status. It excludes request URLs, query strings, raw headers, keys, token fingerprints and response bodies. PNG validation is structural, not native image decoding; a synthetic rendered flag is not native rendering evidence.

**Native interception is NOT runtime-certified.** Concrete diagnostic source is now provided under `native/android` and `native/ios`; it is excluded from production target membership. The original host controller still reports `nativeAdapterCertified:false`. Android source intercepts an owned fresh WebView and handles TLS without HTTP fall-through. iOS cannot intercept ordinary HTTPS using WKURLSchemeHandler: its source blocks WKWebView HTTP(S) and uses a separate explicit native TLS path with no fabricated headers. See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for source evidence, limitations and required native synthetic certification. No native compilation/execution or actual macOS certification is implied. Real provider testing remains blocked.

## Offline validation commands

Run from either isolated maintenance worktree, with already available dependencies. No dependency installation is required.

```powershell
node --import ./tests/arcgis-maintenance/no-network.mjs --test --test-reporter ./tests/arcgis-maintenance/safe-reporter.mjs tests/arcgis-maintenance/contracts.test.mjs tests/arcgis-maintenance/diagnostic.test.mjs
python.exe -B tests/arcgis-maintenance/run-python-tests.py
powershell.exe -NoProfile -NonInteractive -File tests/arcgis-maintenance/private-path.tests.ps1
```

Per baseline: Node18/18 PASS; Python28 PASS of29 with one macOS real-signing case ENVIRONMENT_UNAVAILABLE; Windows ACL7/7 PASS. Unsafe broad ACL descriptors are tested in memory with the same validator; safe/inherited/filesystem cases use disposable synthetic files. The host did not permit applying a broad test ACL. All private fixture cleanup validates its owned temporary root first.

Protected regressions: Android129 PASS /133, iOS130 PASS /133. Android's released recovery-test assertion and both refs' cartography asset-revision assertion are BASELINE_CONFIRMED against exact frozen source inputs. Browser startup is ENVIRONMENT_UNAVAILABLE because loopback networking is blocked; deterministic artwork generation is ENVIRONMENT_UNAVAILABLE because the offline child-process guard blocks generation. No tests were changed to suppress these failures. No new failures remain. These outcomes do not certify native startup, provider authorization, signed artifacts, policy compliance or store acceptance.

Preserve all existing worktrees, credentials, native packages, consumer source and notification development. Production reporting status, account declarations, public UGC operational compliance, Mac readiness and actual emitted native referrers remain separate unverified gates. Original credential expiration: November30,2026; replacement expiration November1,2027 is owner-confirmed, not independently verified by these tests.

**ARCGIS_PREBUILD_PARTIAL** — tooling and synthetic contracts prepared; no native/live authorization implied. Stop for owner review.

The subsequent infrastructure work is classified separately in `INFRASTRUCTURE.md`. Initial test counts above describe preparation; current infrastructure counts are reported there.
