# LP244.66 Window 3B — public pin and native authority audit

## Result

**NOT READY FOR WINDOW 4 DEPLOYMENT REVIEW.** The production public verification key is pinned locally. Production native request admission, the admitted client invoke transport, and deployable verifier entrypoints remain absent. No remote function, job, paid admission, or reporting state was changed.

## Production public key

The owner-designated public SPKI decoded as 91 bytes of DER EC `prime256v1` / P-256. Its SHA-256 is **`963a8a6b5c79f20d0f3948f4cad187794d42276d4c71f40dd577830f865e0d7c`**, exactly the owner-provided fingerprint. The bundled public material is an exported base64 DER SPKI constant in `js/gridly-entitlement-public-key.mjs`. No private signing material was read or bundled.

`importProductionEntitlementKey` checks the DER digest and calls `crypto.subtle.importKey('spki', bytes, {name:'ECDSA', namedCurve:'P-256'}, false, ['verify'])`. Digest/import failure returns no key. `verifyAuthorityProof` accepts only signed ES256 Gridly v1 envelopes under the caller's pinned CryptoKey, checks nonce, Apple/Google platform, fixed product, production environment, bundle audience, proof freshness and period end. `accessDecision` admits only a verified snapshot still in its lease. There is no fetched key, response-selected key, configuration query parameter, or storage override.

The release uses **one pinned current key**. Version 1 has no `kid` in its signed header. For a future rotation, ship a new native release with a narrowly scoped current+next verifier change and fixed key identifiers, then wait for adoption before switching server signing. Keep the prior server signer available for old installed apps until their minimum supported version is retired; continue to validate at most 24 hours of old-key continuity (and never past its period end). Roll back the server signer while both app versions still accept it if cutover fails. Do not replace the version 1 pin in place or accept an unbounded/server-provided key ring. This is a design for a later reviewed release, not code active now.

## Paid configuration and startup

`index.html` loads `js/gridly-paid-bootstrap.js`, which imports `js/gridly-paid-ui.mjs`. That imports `productionPaidComposition` from `js/gridly-paid-config.mjs`, awaits key import, and passes the result into `createPaidAccess`. The config returns `{capacitor, plugin, publicKey, authority, continuityVault}`. The key is imported only when `isNativePlatform() === true` and platform is `ios` or `android`; browser/PWA and unknown native platforms receive `publicKey:null`. `authority` remains null because there is no trustworthy production admitted invoke port. The store plugin is withheld while authority is absent, preventing an unfinishable purchase in the production release. This preserves the denied protected runtime, even if a native store plugin or locally saved flag is present.

With a future admitted transport, iOS would select `GridlyStoreKit` → `createAppleVerificationAuthority` → `gridly-verify-apple-subscription`; Android would select `GridlyPlayBilling` → `createGoogleVerificationAuthority` → `gridly-verify-google-subscription`. Both store adapters already require server proof, verify it with the pinned CryptoKey, and call the entitlement delivery port before admission. Apple finishes only the proven transaction after delivery; Google requires server acknowledgment before signed entitlement. The native continuity vault can retain only a previously signed, unexpired authorization under the existing LP244.65 policy. The browser/PWA path has no native store and never loads protected runtime without verified access. Test/sandbox suites inject generated keys and synthetic ports directly into lower-level factories; this release config has no sandbox switch.

## Edge request and response contract

`STORE_VERIFIERS` fixes `/functions/v1/gridly-verify-apple-subscription` and `/functions/v1/gridly-verify-google-subscription`. The client authority factories call an injected Supabase-compatible `invoke(functionName, {body})` port. No production client `supabase.functions.invoke` port or custom native attestation header is composed. An anon/publishable key has no entitlement minting authority, and no service-role key belongs in the native bundle.

Both endpoints require POST, no query, `application/json`, a bounded JSON body, and one provider evidence item before a proof can be issued. Apple requires `platform`, `environment`, `nonce`, fixed `productId`, and `evidence.signedTransactions`; Google also requires fixed `basePlanId` and `evidence.purchaseTokens`. Optional `continuityBinding` binds the signed continuity authorization. The server `authorizeNative({request, body, nonce, environment})` must approve before provider verification or cache writes. A successful response is exactly `{proof: string}` with `Cache-Control: no-store`. The client rejects other response shapes and overlong proofs. Explicit Edge 401/403 is `authority_denied` and revokes continuity; 5xx, fetch failure, and bounded timeout are temporary verification failures and can use only an already valid LP244.65 continuity authorization. Raw provider evidence and transport errors are not logged or returned by these modules.

**PRODUCTION NATIVE AUTHORIZATION INCOMPLETE.** `authorizeNative` exists only as a required server port and as synthetic true/false test fixtures. It has no production implementation, challenge issuer, attestation validation, body-digest binding, replay consumption, or rate-limit backing store. The two `index.ts` entrypoints call `createHandler({platform})` without ports and return 503. They do not call `createProductionServer`. `supabase/config.toml` has no sections for them, so `verify_jwt` uses the Supabase default (true); that gateway check would still not establish native request admission. No credential should be invented from an installation ID, package name, email, public API key, client flag, or receipt. Provider signing credentials and the service-role key remain server-side in `server-setup.mjs`.

## Local fail-closed evidence

| Case | Local result |
| --- | --- |
| Missing public key | No store session can admit a proof |
| Invalid SPKI | Import fails; no key or purchase |
| Wrong public key | Signature fails; no access |
| Verifier unavailable | No new authority; existing signed continuity only if valid |
| Verifier 401 | Explicit denial; continuity revoked |
| Verifier 403 | Explicit denial; continuity revoked |
| Verifier 500 | Temporary verification failure; no new authority |
| Network timeout | Bounded failure; no late admission |
| Malformed signed proof | Shape verification fails; no access |
| Tampered signed proof | Signature verification fails; no access |
| Expired signed proof | Lease rejected; no access |
| Wrong platform | Proof rejected; no access |
| Wrong environment | Proof rejected; no access |
| Wrong product | Proof rejected; no access |
| Browser/PWA | No native key import or store authority; protected runtime denied |
| Continuity available | Existing LP244.65 bound, expiry and period rules apply only after earlier authority |
| Continuity unavailable | No access |

Local interoperability uses a generated P-256 test key: server `signResponse` → exported DER SPKI → WebCrypto `importKey('spki')` → `verifyAuthorityProof` → `accessDecision`. Production private signing material was not used. Existing LP244.61–.66 tests cover additional store/server/continuity cases.

The LP244.61–.66 suite passed when the two unchanged iOS certification source-contract files were excluded. The full first run reported three failures from `lp24465c-native-harness.test.mjs` and `lp24465i-ios-reset.test.mjs` because their diagnostic generator rejects the current, unchanged Swift vault source; the browser price assertion was updated for the closed verifier state and then passed. Native packaging, the public pin suite, real-browser gate, service-worker lifecycle assertions, native staging build/verification, source syntax, and `git diff --check` passed. The changed client runtime passed focused credential/private-key/log/bypass scans; the entire staged `www` tree had no PEM private-key marker or `sb_secret`/`sb_service_role` credential pattern. The Capacitor Android copy failure remains an unverified packaging step, not a successful artifact inspection.

## Store and package identity

Production bundle/package: `com.gridlygo.gridly`. Apple monthly product: `com.gridlygo.gridly.monthly`. Google monthly product: `gridly_monthly`, base plan `monthly`. The explicit store environment is `production`; price, trial, and free-tier constants were not changed.

`tools/native-web.mjs` allowlists the public-key module into `www`; `capacitor.config.json` uses `webDir: www` for Android and iOS. Native web staging and deterministic verification included exact source pin bytes. `service-worker.js` precaches the pin in a newly named closure cache and resolves closure assets only from that current cache, preventing an older cache from substituting the pin. The PWA remains denied regardless of its cache. The allowlist excludes tests, certification fixtures, owner-local files, and private secrets. No synthetic test key or vault was copied. Actual Android/iOS package copies and signed release artifacts were not certified: `npx cap copy android` failed within the CLI at `uv_os_get_passwd` (`ENOMEM`) before copying; iOS copy/build was not run on Windows.

## Window 4 deployment inventory

| Function | Entrypoint / `verify_jwt` | Custom auth, secrets, capability, closed state |
| --- | --- | --- |
| `gridly-verify-apple-subscription` | `supabase/functions/gridly-verify-apple-subscription/index.ts` / default true (no config section) | Needs production `authorizeNative`, Apple issuer/key/private `.p8`/app ID, bundle/environment, signing PKCS#8, fingerprint HMAC, Supabase URL/service-role and Apple roots/library. Currently 503; no authority. |
| `gridly-verify-google-subscription` | `supabase/functions/gridly-verify-google-subscription/index.ts` / default true | Needs production `authorizeNative`, Google service account, current ACK AES key/version, bundle/environment, signing PKCS#8, fingerprint HMAC, Supabase URL/service-role and ACK RPCs. Currently 503; no authority. |
| Subscription operations | **No Edge entrypoint** / not set | `createSubscriptionOperations` is a shared handler requiring a 64-hex operations token, fixed POST, retry and health ports. It is not deployable as a function yet. |

The two verifier entrypoints would transitively package `supabase/functions/_shared/entitlement/handler.mjs` today. Production composition would also require `server-setup.mjs`, `composition.mjs`, `core.mjs`, `providers.mjs`, `rpc-ports.mjs`, `google-oauth.mjs`, `acknowledgment.mjs`, and health/operations modules as applicable. Exact dependency packaging must be rechecked when real entrypoints are written. **Do not deploy the current entrypoints as entitlement minting functions.**

## Blocking work and owner decision

Define and implement the native attestation and server challenge contract, including nonce/body digest, replay store, and rate limits. Build the native invoke port and server `authorizeNative` against that contract, compose the two production entrypoints with official provider roots/libraries and scoped server credentials, then certify Android/iOS package bytes and the fail-closed matrix on physical builds. Resolve the unchanged iOS continuity certification source-contract failures before release. The next owner decision is approval of a specific native attestation and challenge architecture for local implementation; deployment requires a separate later authorization.
