# LP244.66 Window 3 — production secret and key lifecycle preparation

**Verdict: PARTIAL / NOT READY FOR WINDOW 4 DEPLOYMENT REVIEW.** Source branch `LP244.66-production-subscription-verification-admission`, starting HEAD `5fbfc0fed12f0bc78c394004a336f073852c3709`. This window audited source and queried secret **names only** on 2026-09-28 UTC. No new secret was generated, entered, or configured by Codex: the owner prohibited disclosure of values to Codex, and this execution path cannot guarantee an owner-generated value would remain unseen. Owner-only offline generation and dashboard entry are the next actions. No Edge/Worker deployment, scheduler, purchase, paid admission, or reporting activation occurred.

## Source and live evidence

`server-setup.mjs`, `core.mjs`, `composition.mjs`, `acknowledgment.mjs`, `google-oauth.mjs`, `providers.mjs`, `operations.mjs`, the two dormant verifier entrypoints, `js/gridly-paid-config.mjs`, and the tracked Worker modules/config are the authoritative source contracts. Supabase CLI `secrets list --project-ref nhwhkbkludzkuyxmkkcj -o json` and Wrangler `secret list --name gridly-cleanup-alert-production --format json` were captured in memory and reduced to approved **name/presence booleans** before output. Neither raw list, digest, value, nor credential was printed. The CLI commands were read-only. `supabase/.temp/cli-latest` was not read or changed. Window 2B established the 19-version ledger, disabled reporting, consumed/unlaunched guard, empty queue, and two unchanged cleanup jobs; those database facts were **not freshly re-queried** in Window 3.

The tracked Cloudflare `wrangler.jsonc` still points to `worker.mjs`, one `* * * * *` cleanup trigger, and `ALERT_STATE`. The proposed `combined-worker.mjs` is not the configured entrypoint. Existing nonsecret Cloudflare runtime variables were last established in LP244.58, not freshly listed here. A secret name appearing in a store proves presence, **not** correctness, usable format, or deployment readiness.

## Exact configuration inventory

`P` = needed for the named **production component when activated**; `T` = needed for the corresponding isolated sandbox/test acceptance. `Y/N` under reuse means whether an existing Gridly value may be reused after owner verification. `U` means this value must be distinct to subscriptions. A dash means the field does not apply. All secrets live on the server side; none belong in a native bundle, client, repository, SQL, or log.

| Exact name | Class; purpose and source consumer | P/T | Rotate; reuse; U | Destination / live name presence |
| --- | --- | --- | --- | --- |
| `GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64` | OWNER/GRIDLY-GENERATED; ES256 entitlement and continuity signing, `server-setup` → `core.signResponse` | Y/Y | event; N; Y | Supabase Edge secret / **NO** |
| `GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64` | OWNER/GRIDLY-GENERATED; purchase-chain HMAC-SHA-256, `server-setup` → `core.fingerprint`, cache and ACK | Y/Y | event, migration plan; N; Y | Supabase Edge secret / **NO** |
| `GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON` | GOOGLE-ISSUED; server OAuth for Publisher GET/ACK, `server-setup` → `google-oauth`, `providers` | Google/Google | event; N; Y | Supabase Edge secret / **NO** |
| `GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION` | NON-SECRET CONFIG, Gridly-chosen key label, `server-setup` → `tokenCipher` | Google/Google | with key; N; Y | Supabase Edge config / **NO** |
| `GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64` | OWNER/GRIDLY-GENERATED; AES-256-GCM seal/open of ACK token, `server-setup` → `tokenCipher` | Google/Google | event/rotation; N; Y | Supabase Edge secret / **NO** |
| `GRIDLY_GOOGLE_ACK_AES_PREVIOUS_VERSION` | NON-SECRET CONFIG; optional prior decrypt label, `server-setup` → `tokenCipher` | N/rotation test | with key; N; Y | Supabase Edge config / **NO**, correctly unset initially |
| `GRIDLY_GOOGLE_ACK_AES_PREVIOUS_KEY_B64` | OWNER/GRIDLY-GENERATED; optional prior decrypt key, `server-setup` → `tokenCipher` | N/rotation test | retire; N; Y | Supabase Edge secret / **NO**, correctly unset initially |
| `GRIDLY_GOOGLE_ACK_AES_PREVIOUS_RETIRE_AT` | NON-SECRET CONFIG; absolute prior-key UTC cutoff, `server-setup` → `tokenCipher` | N/rotation test | each rotation; N; Y | Supabase Edge config / **NO**, correctly unset initially |
| `GRIDLY_APPLE_ISSUER_ID` | APPLE-ISSUED identifier; App Store Server API client, `server-setup` | Apple/Apple | if Apple changes; N; Y | Supabase Edge config / **NO** |
| `GRIDLY_APPLE_KEY_ID` | APPLE-ISSUED identifier; matches `.p8`, `server-setup` | Apple/Apple | with `.p8`; N; Y | Supabase Edge config / **NO** |
| `GRIDLY_APPLE_PRIVATE_KEY_P8` | APPLE-ISSUED secret; App Store Server API signing, `server-setup` | Apple/Apple | Apple revocation/rotation; N; Y | Supabase Edge secret / **NO** |
| `GRIDLY_APPLE_APP_ID` | APPLE-ISSUED nonsecret numeric App Apple ID; signed verifier, `server-setup` | production Apple / sandbox optional by source | identity change; N; Y | Supabase Edge config / **NO** |
| `GRIDLY_STORE_ENVIRONMENT` | NON-SECRET CONFIG; exact production or sandbox/test pin, `server-setup` | Y/Y | deployment change; N; Y | Supabase Edge config / **NO**; production value `production` |
| `GRIDLY_STORE_BUNDLE_ID` | NON-SECRET CONFIG; app package/bundle pin, `server-setup` | Y/Y | app identity change; Y only same app; N | Supabase Edge config / **NO**; value `com.gridlygo.gridly` |
| `SUPABASE_URL` | SUPABASE-PROVIDED nonsecret project URL; `server-setup` RPC client | Y/Y | project change; Y same project; N | Supabase built-in / **YES** |
| `SUPABASE_SERVICE_ROLE_KEY` | SUPABASE-PROVIDED privileged server key; `server-setup` RPC client | Y/Y | platform event; Y same project, server only; N | Supabase built-in / **YES** |
| `GRIDLY_SUBSCRIPTION_OPS_TOKEN` | OWNER/GRIDLY-GENERATED; fixed empty POST header, `operations` and `subscription-monitor` | operations/operations test | coordinated event; N; Y | Supabase Edge **NO**, Cloudflare Worker **NO** |
| `SUBSCRIPTION_OPS_URL` | NON-SECRET CONFIG; exact allowlisted subscription Edge URL, `subscription-monitor` | monitor/monitor test | endpoint change; N; Y | Cloudflare Worker variable / not live checked; expected `https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-subscription-ops` |
| `SUBSCRIPTION_DEADMAN_PING_URL` | EXISTING-INFRASTRUCTURE service type, **new distinct** Healthchecks check secret; `subscription-monitor` heartbeat | monitor/alert test | on compromise/check change; N; Y | Cloudflare Worker secret / **NO** |
| `EDGE_URL` | EXISTING-INFRASTRUCTURE nonsecret cleanup Edge URL; `worker.mjs` | existing cleanup / cleanup test | endpoint change; Y; N | Cloudflare variable / historical owner proof, not freshly checked |
| `GRIDLY_MONITOR_TOKEN` | EXISTING-INFRASTRUCTURE cleanup health auth; cleanup Edge and Worker | existing cleanup / cleanup test | coordinated event; Y for cleanup only; N | Supabase Edge **YES**, Cloudflare Worker **YES**; never reuse for subscription operations |
| `DEADMAN_PING_URL` | EXISTING-INFRASTRUCTURE cleanup Healthchecks check secret; `worker.mjs` | existing cleanup / cleanup test | check change; Y for cleanup only; N | Cloudflare Worker secret / **YES**; never reuse for subscription check |
| `RESEND_API_KEY` | EXISTING-INFRASTRUCTURE alert delivery secret; `subscription-monitor` and cleanup `resend.mjs` | monitor/alert test | provider event; Y for same Gridly sender/owner, subject to quota; N | Cloudflare Worker secret / **YES** |
| `ALERT_FROM` | EXISTING-INFRASTRUCTURE sender configuration; `subscription-monitor`/cleanup mail | monitor/alert test | sender/domain change; Y; N | Cloudflare variable / historical proof, not freshly checked |
| `ALERT_TO` | EXISTING-INFRASTRUCTURE owner destination; `subscription-monitor`/cleanup mail | monitor/alert test | recipient change; Y; N | Cloudflare variable / historical proof, not freshly checked |
| `ALERT_STATE` | EXISTING-INFRASTRUCTURE KV binding; subscription incident namespace and cleanup state | monitor/alert test | binding migration only; Y with distinct key prefix; N | tracked binding present; live binding not freshly checked |

Names in a dashboard are shared at the project/Worker scope, not scoped to one future function. Do not set `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` manually: Supabase supplies these legacy environment variables. [Supabase documents reserved `SUPABASE_` names and default variables](https://supabase.com/docs/guides/functions/secrets). The newer `SUPABASE_SECRET_KEYS` is a separate platform migration and is **not** silently substituted for the source's current `SUPABASE_SERVICE_ROLE_KEY` contract.

## Crypto contract and owner-only generation

1. **Signing:** `server-setup` imports base64-decoded DER **PKCS#8 EC P-256** private key with WebCrypto ECDSA, nonextractable, sign-only. `core.signResponse` emits compact ES256-style signed entitlement and continuity proofs using ECDSA/SHA-256. The public counterpart is **SPKI DER base64** (nonsecret), imported as `spki`/ECDSA P-256/verify by a future reviewed native composition. Record SHA-256 of SPKI DER as the nonsecret key fingerprint. Do not confuse this Gridly key with Apple's `.p8` or Google's RSA service-account key. The current proof header has no `kid`; the production native composition has `publicKey:null`. Key-specific pinning and a dual-pin/key-id rotation transition need separate review before release. Rotating this key in place would invalidate unexpired proofs/continuity, even though continuity itself is capped at 24 hours and period end.
2. **Fingerprint:** exactly **32 random bytes**, standard base64, imported nonextractable as HMAC-SHA-256. `core.fingerprint` signs platform, environment and original store reference separated by NUL, storing a lowercase SHA-256 hex chain fingerprint. It is independent of the signing key. Rotation changes lookup identities of existing cache/ACK rows; there is no dual-HMAC lookup or rekey. With a zero-row ACK queue, new issuance is simpler, but a future rotation still requires a separate cache/queue reconciliation plan. Do not rotate casually.
3. **ACK encryption:** exactly **32 random bytes** in standard base64, imported nonextractable as AES-256-GCM. `tokenCipher` uses random 12-byte IV, 128-bit tag, and associated data binding environment/fingerprint/version. Choose nonsecret initial label `ack-20260927-01` (matches `[A-Za-z0-9_-]{1,32}`); check it is not already used before entry. Initial `PREVIOUS_*` fields must remain absent. A future rotation sets all three previous fields together, with an absolute UTC `PREVIOUS_RETIRE_AT` at most one hour ahead, and preserves old decrypt access until old-version work is zero or expires/purges. The one-hour queue retention ceiling is unchanged. `LEAST`-style bounded expiration cannot be extended by retry or re-enqueue.
4. **Operations token:** `operations.mjs` and `subscription-monitor.mjs` require **32 random bytes encoded as 64 lowercase hex characters**, carried only in `X-Gridly-Subscription-Ops-Token` on a fixed no-body POST. The Edge handler validates shape, SHA-256 hashes both candidate and configured token and compares all digest bytes without early exit. Generate a distinct token; do not reuse `GRIDLY_MONITOR_TOKEN`. Rotate both Edge and Worker together in a separately approved operations window: source accepts one token, so there is no overlap capability today. Worker must remain on the cleanup-only entrypoint until a coordinated deployment is approved.

**Owner execution, outside Codex:** Use an owner-controlled password manager with cryptographic key generation, or run an offline Node.js 22+ script in an owner terminal to create one P-256 keypair and three independent `crypto.randomBytes(32)` values. Export the private EC key with `privateKey.export({format:'der',type:'pkcs8'}).toString('base64')`; export the public key with `publicKey.export({format:'der',type:'spki'}).toString('base64')`; encode the HMAC/AES buffers with `.toString('base64')` and the operations buffer with `.toString('hex')`. Validate public SPKI `createPublicKey(privateKey)` derivation, a synthetic WebCrypto ECDSA sign/verify round trip, two 32-byte base64 decodes, 64-lowercase-hex token shape, and AES-GCM encrypt/decrypt round trip **without printing private material**. Generate each value once, store it directly in the owner's password manager or an access-restricted, encrypted, temporary location outside Git/Codex, then enter only into the approved dashboards. Record only the SPKI SHA-256, version label, creation date and presence results in this register. Delete temporary plaintext files after verifying dashboard entry. Do not use shell command arguments, history, Git, app logs, or Codex chat for values. If the password manager cannot generate/export the exact required representations, pause and select an owner-controlled offline procedure before creating keys. No script was executed here, so no secret or fingerprint was produced.

Exact **owner-run** offline example below. First choose a full output path inside a pre-existing, access-restricted, encrypted directory **outside the repository and Codex workspace**; the script creates a new file and refuses overwrite. Windows ignores Node's POSIX `mode`, so the directory's Windows ACL and disk encryption must already protect it. Run this in an ordinary owner terminal, not a Codex terminal, chat, shared transcript, CI log, or shell with command tracing. The command text contains no secret and writes no secret to stdout. Move each value into the password manager and Supabase dashboard directly, then securely dispose of the temporary file after checking secret presence. On SSD/cloud-sync media, file deletion alone is not a reliable erasure guarantee; choose an encrypted, nonsynced directory from the outset.

```powershell
$ownerSecretPath = Read-Host 'New full path in the owner-protected encrypted directory (outside Git/Codex)'
@'
import { generateKeyPairSync, randomBytes, createHash, webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const destination = process.argv[2];
if (!destination) throw Error('protected output path required');
const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const privateDer = pair.privateKey.export({ format: 'der', type: 'pkcs8' });
const publicDer = pair.publicKey.export({ format: 'der', type: 'spki' });
const signing = await webcrypto.subtle.importKey('pkcs8', privateDer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const verifying = await webcrypto.subtle.importKey('spki', publicDer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const sample = new TextEncoder().encode('gridly-owner-offline-key-check');
const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signing, sample);
if (!await webcrypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifying, signature, sample)) throw Error('signing self-test failed');
const hmac = randomBytes(32), aes = randomBytes(32), operations = randomBytes(32);
const cipher = await webcrypto.subtle.importKey('raw', aes, 'AES-GCM', false, ['encrypt', 'decrypt']);
const iv = randomBytes(12);
const sealed = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, cipher, sample);
const opened = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv }, cipher, sealed);
if (Buffer.compare(Buffer.from(opened), Buffer.from(sample)) !== 0) throw Error('AES self-test failed');
const publicFingerprint = createHash('sha256').update(publicDer).digest('hex');
const output = {
  GRIDLY_ENTITLEMENT_SIGNING_PKCS8_B64: privateDer.toString('base64'),
  GRIDLY_ENTITLEMENT_FINGERPRINT_KEY_B64: hmac.toString('base64'),
  GRIDLY_GOOGLE_ACK_AES_CURRENT_VERSION: 'ack-20260927-01',
  GRIDLY_GOOGLE_ACK_AES_CURRENT_KEY_B64: aes.toString('base64'),
  GRIDLY_SUBSCRIPTION_OPS_TOKEN: operations.toString('hex'),
  GRIDLY_ENTITLEMENT_PUBLIC_SPKI_B64: publicDer.toString('base64'),
  GRIDLY_ENTITLEMENT_PUBLIC_SPKI_SHA256: publicFingerprint
};
writeFileSync(destination, JSON.stringify(output, null, 2), { flag: 'wx', mode: 0o600 });
process.stdout.write('SELF_TEST_PASS; PUBLIC_SPKI_SHA256=' + publicFingerprint + '\n');
'@ | node --input-type=module - $ownerSecretPath
```

The `GRIDLY_ENTITLEMENT_PUBLIC_*` names above label **owner record fields**, not server secrets. The private signing key, HMAC key, AES key and operations token are all independently generated. Configure the operations token on the future Edge endpoint and Worker only at their coordinated deployment boundary; generating it now does not authorize that deployment. Initial AES `PREVIOUS_*` values stay unset.

The owner should enter production values directly at **Supabase Dashboard → project `nhwhkbkludzkuyxmkkcj` → Edge Functions → Secrets**, using the exact names above; production and sandbox/test must use separate projects/namespaces and separate private material. Supabase's dashboard accepts a secret name and value and does not need an Edge redeploy to expose changed secrets to future function invocations. Avoid CLI `secrets set NAME=VALUE` because arguments/history can expose values. [Supabase secret workflow](https://supabase.com/docs/guides/functions/secrets). Do not enter an operations token into Cloudflare yet unless preparing a coordinated future Worker version: Cloudflare dashboard secret edits deploy a new Worker version, contrary to the no-deployment Window 3 boundary. [Cloudflare secret workflow](https://developers.cloudflare.com/workers/configuration/secrets/).

## Provider owner steps

**Apple — PENDING OWNER DASHBOARD INPUT.** In App Store Connect, select the Gridly app. Under **Users and Access → Integrations → Keys → In-App Purchase**, generate an **In-App Purchase key for the App Store Server API**, record issuer ID and key ID, download the `.p8` once, and store it in the owner's password manager. This is **not** the generic App Store Connect API key. Enter the three names only through Supabase's secrets UI; verify the corresponding key ID/issuer shape without sending the `.p8` to Codex. In the app's **General → App Information**, confirm numeric App Apple ID for `GRIDLY_APPLE_APP_ID`; verify bundle `com.gridlygo.gridly` and the already prepared monthly product. Source requires App Apple ID in production and permits it to be absent in sandbox. Apple Sandbox acceptance still requires a separately configured `sandbox/test` server namespace, trusted Apple library/roots, candidate and tester; production uses `production`. [Apple In-App Purchase key procedure](https://developer.apple.com/documentation/appstoreserverapi/creating-api-keys-to-authorize-api-requests), [App Apple ID location](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/).

**Google — PENDING OWNER DASHBOARD INPUT.** Use an owner-selected Google Cloud project (create one only if needed), enable **Google Play Developer API**, create a dedicated service account, and issue its JSON key into the owner's password manager. In Play Console **Users and permissions**, invite that service-account email and scope it to the Gridly app `com.gridlygo.gridly`; for the source's subscriptions-v2 GET and subscription ACK, Google's billing API setup requires **View financial data, orders, and cancellation survey responses** and **Manage orders and subscriptions**. Do not grant release, user-management, or broad account administration rights. Confirm the real product `gridly_monthly`, base plan `monthly`, and licensed test candidate when the downstream store window opens; no placeholder APK is authorized. JSON must have `type=service_account`, `private_key`, valid service-account `client_email`, and Google token URI; source imports its PKCS#8 RSA signing key nonextractably and requests only `androidpublisher` OAuth scope. Enter JSON into `GRIDLY_GOOGLE_SERVICE_ACCOUNT_JSON` only via Supabase secrets UI; never paste it here. Current Google guidance says a Cloud project need not be linked to the developer account, but service account Play Console permissions remain required. [Google Play Developer API setup and exact billing permissions](https://developers.google.com/android-publisher/getting_started), [API calls](https://developers.google.com/android-publisher/api-ref/rest).

## Public-key delivery, rotation register and validation

Production native key pinning is **MISSING**: `js/gridly-paid-config.mjs` returns `publicKey:null, authority:null`. Tests/synthetic harness inject test keys, but the release composition never imports or embeds a production SPKI. The server's fixed proof headers lack a key ID. Window 4 must review production SPKI delivery and pinning in both native packages, plus an overlap/retirement plan for active ≤24-hour continuity; no key-specific release change was made here. Directly server-distributing an unpinned key would defeat the client verification boundary.

| Register group | Owner; version/date now | Cadence or trigger | Overlap, rollback, retirement |
| --- | --- | --- | --- |
| Gridly signing private/public SPKI | Owner; **not generated**, date pending | compromise or planned release rotation | No in-place rollback/dual pin today. Review dual-pin/key-id migration or wait until all old proofs expire; signed continuity ≤24h and ≤period end. |
| HMAC fingerprint | Owner; **not generated**, date pending | compromise or planned linkage migration | No dual fingerprint today; reconcile cache/queue identities before swap. |
| ACK AES CURRENT | Owner; proposed label `ack-20260927-01`, **not configured** | compromise/planned rotation | New CURRENT plus former PREVIOUS ≤1h; retain until old-version count zero or TTL purge; rollback only if no new-version work stranded. |
| ACK AES PREVIOUS triplet | Owner; **unset initially** | only during key rotation | Absolute UTC retirement ≤1h; remove after old-version work zero/expired; never invent an initial previous key. |
| Subscription ops token | Owner; **not generated** | compromise/planned coordinated rotation | One token accepted; coordinate Edge+Worker, keep old Worker dormant until deployment review; no silent reuse. |
| Apple `.p8`/IDs | App Store Connect owner; **pending** | revoke/compromise/Apple key change | Keep matching issuer/key ID and `.p8`; revoke compromised key after reviewed cutover. |
| Google service-account JSON | Google/Play owner; **pending** | revoke/compromise/Google key change | Overlap only through separately reviewed server cutover; revoke old JSON key after verification. |
| Supabase service role/URL | Supabase owner; built-ins **present** | platform/project rotation | Preserve current functioning integrations; separate platform rotation plan. |
| Cleanup monitor/Resend/deadman and Worker variables/KV | Existing service owners; cleanup secrets **present by name**; variable values unverified | provider/check/binding event | Preserve deployed cleanup behavior; do not reuse cleanup token/ping for subscriptions. |
| Subscription deadman URL | Healthchecks owner; **not created/configured** | new check or compromise | Separate subscription check, independently test owner email before activation. |

**Fail-closed source checks:** Missing common environment/bundle/signing/HMAC/service binding causes `createProductionServer` to return closed handlers (503). Missing Apple inputs closes Apple independently; missing Google account/AES closes Google and retry independently. Missing or wrong operations token returns 503/401 before work; current operations has no deployed entrypoint. Native `publicKey:null` and `authority:null` deny paid access. These are source and focused-test assertions, **not** live purchase tests or proof that unconfigured functions have been deployed. Subscription Worker code remains review-only and cannot be reached by the configured cleanup-only entrypoint. The 19-version ledger, two jobs, `reporting_enabled=false`, protocol 2, and guard were last verified in Window 2B; no Window 3 database writes occurred.

## Window 3 status and next owner decisions

| Area | Result |
| --- | --- |
| Apple | **PENDING OWNER DASHBOARD INPUT** — In-App Purchase key/issuer/key ID/production App Apple ID and trusted library/roots remain to be certified. |
| Google | **PENDING OWNER DASHBOARD INPUT** — service account/Publisher API/Play permissions and product candidate remain to be certified. |
| Gridly-owned crypto | **BLOCKED pending owner-only generation and direct secure entry**; initial AES previous triplet intentionally unset. |
| Supabase secret configuration | **PARTIAL** — built-in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and existing `GRIDLY_MONITOR_TOKEN` present; all new subscription names absent. |
| Cloudflare subscription secret configuration | **NOT STARTED** — both new subscription names absent; existing cleanup alert secrets present. New Cloudflare secret entry can create/deploy a Worker version, so schedule it with the separately approved Worker deployment window. |
| Window 4 | **NOT READY FOR WINDOW 4 DEPLOYMENT REVIEW** — required signing/HMAC material absent, native SPKI pin and authority transport unresolved, and operations lacks an Edge entrypoint/composition. Provider inputs may remain absent only for a separately reviewed fail-closed deployment, never for store acceptance or admission. |

**Exact next owner action:** Run owner-only generation and secure storage of the four Gridly values outside Codex; record the nonsecret SPKI SHA-256 and AES version; enter the signing/HMAC/AES CURRENT and production environment/bundle values directly into the Gridly Supabase secrets dashboard. Retrieve Apple's In-App Purchase key and Google's Play service-account credential through their own dashboards and configure them only when available. Return **names/presence and nonsecret fingerprint/version/date only**, never values. Separately review the native key pin/rotation and the missing operations Edge composition before any Window 4 deployment request. No Cloudflare subscription secret, external check, scheduler, Edge function, purchase, paid admission, or reporting activation is authorized by this result.
