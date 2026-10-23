# Owner-only proof-clock component acceptance

See docs/launch/P0-GOOGLE-PROOF-CLOCK-REPAIR.md for the tested artifact hash,
production gates and exact limits.

This fixture reproduces certified Build 14's Google UNKNOWN transition, then
exercises the local correction with synthetic P-256 proofs. No customer, account,
purchase, store, production network, signing secret or real payment is involved.

Generate a NEW directory:
node tools/entitlement/prepare-proof-clock-android.mjs .artifacts/p0-google-access/owner-cert-new

Set the existing JAVA_HOME and ANDROID_HOME, then run that generated project's
gradlew.bat with -p pointing to its android directory, --offline --no-daemon
assembleDebug. Install the resulting debug APK only on an owner-controlled
device and open com.gridlygo.proofclockcert. Tap Run proof-clock checks.
All 24 cases should pass. Close/reopen and repeat.

The package ID differs from Gridly and the app is debug-only. Release tasks
are deliberately blocked. Do not modify production configuration or bypass
those guards. The component uses controlled clock ports, not OS setting changes.
No physical device was connected during the local certification.

A successful synthetic component run does NOT prove active production signer
identity or full Google Play Billing/Integrity admission. Those remain separate
owner-only gates using an existing valid production subscription and, later,
a separately authorized Play-recognized corrected candidate.
