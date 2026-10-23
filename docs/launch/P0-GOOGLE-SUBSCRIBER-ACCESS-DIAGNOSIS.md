# P0 Google subscriber access — targeted diagnostic checkpoint

Status: Historical pre-repair checkpoint, still BLOCKED on production signer identity.
See P0-GOOGLE-PROOF-CLOCK-REPAIR.md for the subsequently certified local clock repair.
No production repair is activated.
Recorded 2026-10-23. Source branch codex/p0-google-subscriber-access starts at
0e9eebd185dac45aa3382471870092852645941b, the specified Build 14 paid-access source.

## Established evidence

- Production Google verifier is ACTIVE version 12, function ID
  4ed60465-71b8-4f2b-8cad-6d1ffd196517. Retrieved bundle SHA:
  bb4a5ea8eb53ed38ec67baf73047ec325dd89ded3f266e4a9f27ab0814977fd9.
- Read-only bounded Edge metadata for 2026-10-23 15:10–15:35 UTC shows seven
  POST responses HTTP 200 from that verifier, between 15:17:42.385 and
  15:19:25.922 UTC, execution durations 772–1086 ms, function version 12.
  No request/response bodies, headers, purchase tokens or customer identities were collected.
- The supplied production observation established Google production ACTIVE /
  ENTITLED / error none through November 22. At 15:43:48 UTC the cache contained
  zero rows. Source cache retention is ten minutes with independent pruning;
  an absent expired cache row is not a subscription denial and was not recreated.
- Build 14's imported P-256 public SPKI SHA-256 is
  963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c.
  This establishes the CLIENT pin only.
- Historical Window 3B evidence says this was owner-designated public material,
  and interoperability was tested with a generated synthetic key. It does not
  independently bind the current production signing secret to that pin.
- The actual v12 handler/core/diagnostic/request-contract source is frozen,
  byte-for-byte, under tests/fixtures/p0-google-verifier-v12/. It was compared
  to the fetched deployment, not assumed to match repository HEAD. Production
  core lacks the later optional sandbox test-authority claim; production
  response claims otherwise match Build 14. Handler differences add bounded
  diagnostics; neither difference by itself reproduces the customer failure.

## The single authorization path

GridlyPlayBilling query/purchase/already-owned recovery → one bounded purchase
token held in memory → fresh nonce → server challenge / canonical request hash →
Play Integrity prepare/authorize → native HTTP → server native admission →
Google subscriptionsv2 verification → normalized current record → cache lineage
reconciliation → required server acknowledgment → ES256 entitlement proof →
createGoogleVerificationAuthority response shape check → verifyAuthorityProof →
deliverEntitlement / accessDecision → createPaidAccess entitled → UI admission.

The server signs only after its previous gates succeed. HTTP 200 says nothing
about subsequent on-device verification. The exact text “Your subscription
could not be verified” is the UI's unknown state. A transport timeout normally
has temporarily_unavailable text. In the Google client, invalid native evidence
can also produce invalid_authority before an HTTP call; the successful calls
support the later proof-validation boundary but do not provide per-device stage
telemetry or the exact failed predicate.

The verifier requires the fixed product com.gridlygo.gridly.monthly, production
environment, audience com.gridlygo.gridly, request nonce, exact allowed claim
set, canonical millisecond UTC dates, valid signature, five-minute maximum
lease, and live period end. The server uses a raw 64-byte ES256/P1363 signature,
which the unchanged Build 14 verifier accepts in the offline production-format
test. It does not emit basePlanId or private provider fields in the proof.

## Deterministic evidence, without a guessed fix

1. The actual v12 handler writes synthetic ACTIVE/ENTITLED/error-none cache
   metadata and returns HTTP 200. With its matching generated public key and
   client time one second after verification, Build 14 unlocks through launch,
   restore, resume, already-owned purchase and three reopened sessions.
2. The same setup signed by a synthetic key, when verified under the actual
   Build 14 pin instead, returns unknown / invalid_authority despite HTTP 200
   and ACTIVE cache. This demonstrates key mismatch behavior, NOT an actual
   production mismatch.
3. The correctly signed proof also returns unknown / invalid_authority if
   device time is one millisecond earlier than signed lastVerifiedAt. A direct
   cryptographic verification still succeeds. The installed verifier has zero
   tolerance for future lastVerifiedAt, and accessDecision independently rejects
   now < lastVerifiedAt. No customer clock measurement exists. This is a second
   explanation consistent with the current evidence, NOT an established cause.
4. No app or server source was relaxed to make these negative cases pass.
   Nonce/product/platform/environment/audience/time/extra-field/signature
   mutations remain denied. Native admission denial prevents provider/cache
   execution. Apple shared-signer compatibility and Apple bridge tests pass.

These distinguish local compatibility from customer acceptance. There is no
before/after repair claim and no verified restoration of the customer's access.

## Key-identity access result and smallest next step

Names-only checks found no production signer in process/User/Machine environment
or the checked project secret-file locations. The existing owner-local signing
filename is explicitly sandbox-only and was not read or treated as production.
Historical public-pin records contain no current production private-key binding.
The connected Supabase tools can inspect deployed source and metadata, but expose
no signing-secret read operation. The official Supabase Terraform provider states
that the management API returns secret-value SHA-256 digests, never plaintext:
https://raw.githubusercontent.com/supabase/terraform-provider-supabase/main/docs/resources/edge_function_secrets.md

After the owner explicitly authorized the existing Supabase GitHub sign-in,
the read-only inspection succeeded on 2026-10-23 with no additional OAuth
permission prompt. The original automatic-review rejection is resolved.

Project: Gridly Platform / nhwhkbkludzkuyxmkkcj / main PRODUCTION.
The existing Custom secrets table establishes:
- GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64 is present.
- Secret-value SHA-256 digest:
  c18dd74454b3401baf705650775a44dcacc801b554453d8df03d4b7f84562450
- Last updated: 2026-09-28 01:52:12 UTC
  (2026-09-27 8:52:12 PM America/Chicago).
- GRIDLY_STORE_ENVIRONMENT digest matches the expected literal production.
- GRIDLY_STORE_BUNDLE_ID digest matches com.gridlygo.gridly.
- A separately named sandbox entitlement signer is present, with a different
  secret-value digest. It was not opened or used as the production signer.
- No public SPKI identity record is listed among the project Custom secrets.

The previously retrieved deployed server setup imports the fixed production
GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64 as nonextractable ECDSA P-256/sign-only.
The signing port is common to production Google and Apple; the Google service
account RSA key is a separate provider credential, not this entitlement signer.
No in-place key update since the displayed timestamp is indicated by this
metadata. The timestamp does not prove correct original pinning.

Only NAME, DIGEST SHA256 and UPDATED were read. No secret-value or edit control,
Save, configuration mutation, API-secret export, or function deployment was used.
The signer digest is a hash of the stored base64 private-key VALUE, not a public
SPKI hash and not private key material. It cannot be transformed into the
public-key fingerprint. The independent production SPKI comparison remains
BLOCKED, rather than assumed to match.

Nonsecret screenshot evidence:
C:/Users/gulfi/.codex/visualizations/2026/10/23/01a168b6-aac5-7941-89dc-d259928093f5/p0-production-signer-metadata.png

No tests were repeated during this metadata-only follow-up. The prior 89/89
certification remains the completed local evidence.

A read-only local tool is ready:
tools/entitlement/signer-public-identity.mjs

Run it ONLY where the already-authorized production secret is already available
as GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64. Do not paste a key in command arguments,
chat, logs, files or a new environment here. It reads the fixed environment name,
imports PKCS#8 in memory, derives/exports only public SPKI, prints its SHA-256 and
a Build 14 match boolean, then clears the decoded private buffer. It makes no
network calls and cannot replace keys.

Command:
node tools/entitlement/signer-public-identity.mjs

To corroborate an existing source against the current project's nonsecret
secret-value digest obtained through an authorized metadata read:
node tools/entitlement/signer-public-identity.mjs --configured-secret-digest c18dd74454b3401baf705650775a44dcacc801b554453d8df03d4b7f84562450

The secret-value digest is NOT the public SPKI fingerprint. A local pin match
without authoritative source/configuration linkage is still not production proof.
Running the tool here returned only:
{"ok":false,"errorCategory":"signer_source_unavailable"}

The smallest secure next action is for the owner/custodian to run the existing
offline tool in the trusted environment where the original production key is
already available, using the exact dashboard digest above. The tool refuses a
key-value digest mismatch, derives only public SPKI SHA-256, and reports whether
it matches Build 14. Return only those public identity/match results; do not copy,
export, paste or replace the private key.

If no original owner-managed key source is accessible, the current read-only
dashboard and connected tooling cannot derive the actual signer identity.
No existing runtime identity endpoint is present in the inspected deployment.
An in-runtime fingerprint check would require a separately reviewed and
explicitly authorized diagnostic deployment; it has NOT been implemented,
requested for activation, or performed under this no-deployment authorization.
Do not rotate a key or release a build to test the mismatch hypothesis.

## Repair / release / activation decisions

- Backend-only fix possible: UNDETERMINED pending the key comparison and precise
  on-device rejection. A backend config repair is only a conditional possibility.
- Android bundled defect established: NO. Zero future-time tolerance is observed
  behavior, not evidence of this customer's clock. No emergency binary, version
  bump, Build 15 replacement, release or submission has been prepared.
- If an actual mismatch is established, review the original intended signer and
  every installed Apple/Google pin before proposing a minimal configuration
  restoration. Do not rotate or blindly restore signing secrets; verify proof
  and continuity compatibility, owner-managed rollback material and a controlled
  existing-subscriber restore acceptance first.
- If identities match, obtain bounded device-side proof-validation stage and
  clock difference under the unchanged verifier. Do not collect raw proof,
  purchase token, credentials or personal data. Device is currently unavailable.
- Live activation authorization has not been requested: there is no proven
  correction with a safe activation/rollback plan to approve yet.
- Customer acceptance: NOT VERIFIED; access restoration cannot be claimed.

## Local validation

One focused command passed 89/89, zero failures/skips:
node --test tests/p0-google-subscriber-access.test.mjs tests/p0-signer-public-identity.test.mjs tests/lp24461-subscription-entitlement.test.mjs tests/lp24463-apple-storekit.test.mjs tests/lp24464-google-play-billing.test.mjs tests/lp24465-paid-access.test.mjs tests/lp24466-window3b-public-pin.test.mjs tests/lp24466-window3c-native-authorization.test.mjs tests/lp24466-window3d-edge-transport.test.mjs

The 89 passing tests include baseline/security/Apple tests and fourteen new
incident/identity tests. They certify diagnostic behavior, not a repaired
production subscriber path. git diff --check passed; tracked application and
backend source are unchanged. New local diagnostic/fixture/test/report files
remain uncommitted; no repair commit is claimed.

Frozen deployment files (raw SHA-256):
- supabase/functions/_shared/entitlement/core.mjs: 2cc30e3c6664ac9c1300f4bf2353d3a01c87611c444436b76807825b1ed80d83
- supabase/functions/_shared/entitlement/handler.mjs: 751483372bfdf84a04e30b77ee47fc32c680fa1a26cf05e4243e0fb8b27a91e9
- supabase/functions/_shared/entitlement/verifier-stage-diagnostic.mjs: ff06bba37e1d04f4ee1aacc90749567080ad037ea29d7e8777efc55f294109b0
- js/gridly-store-verification.mjs: 3b001abae55c7801fa0566fb80bb999bd360370cc137641d4019996edf7fc795

## Production protection

No P0 production SQL mutation, entitlement grant, purchase or acknowledgment
request, email send, secret read/export/replacement, function deployment,
Worker change, customer data change, app build, store upload or release action
was performed. Production queries were bounded metadata/aggregate reads only.
The earlier LP244 monitoring work remains suspended at its separately recorded
completed handoff; this P0 task did not resume it or change its checkpoint.
