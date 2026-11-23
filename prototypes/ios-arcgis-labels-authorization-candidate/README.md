# Gridly labels authorization — isolated Stage 4B candidate

No entrypoint starts a listener, reads secrets, connects to a registry, or installs a provider transport. `gateway/index.ts` exports an inert factory. Missing server dependencies leave admission closed. Do not deploy this tree, apply its SQL to a shared database, or add real credentials under Stage 4B authorization.

The reviewed Stage 4A design is recorded in `DESIGN.md`. Results, source limitations and the A–X handoff are in `REPORT.md`.

From the repository root:

```powershell
node --test prototypes/ios-arcgis-labels-authorization-candidate/tests/server.test.mjs prototypes/ios-arcgis-labels-authorization-candidate/tests/preservation-and-reporting.test.mjs
& ./prototypes/ios-arcgis-labels-authorization-candidate/test-disposable-postgres.ps1
node prototypes/ios-arcgis-labels-authorization-candidate/reference/prototypes/ios-arcgis-labels-gateway-deploy/verify-sources.mjs
node prototypes/ios-arcgis-labels-authorization-candidate/tools/verify.mjs
```

Windows PostgreSQL 17 is required at the script's default path. The runner creates a fresh, password-protected loopback-only cluster under `.scratch/pg-<uuid>`, asserts its actual data-directory identity before loading fixtures, uses independent `psql` connections, stops its own process and removes only that generated cluster. It restores inherited process environment. It never uses an existing PG connection or Supabase configuration. The process sandbox could not validate local startup; the successful authorized run used elevated tool execution for that disposable cluster only.

`tools/prepare.mjs` and `tools/assemble.mjs` are one-shot local source acquisition/assembly records. They reject existing destinations. Do not rerun them over this candidate. `evidence/source-copies.json` records all 141 original byte hashes and origins; `tools/verify.mjs` compares them again against both copies and originals, and checks the 32-entry gateway certification manifest. No dependencies were installed.

## Server composition

`createLabelsRpcPorts({connect})` accepts only a trusted server connection factory. The supplied client implements `query(text, values, {signal})` and `destroy()`. The driver MUST implement cancellation and connection destruction. Each call begins a transaction, sets local statement/lock deadlines (2000/750 ms), sets the limited verifier role, performs a parameterized call and commits. A 3000 ms caller deadline fences unknown outcomes by destroying the connection. No real driver is wired in this candidate.

`createConsumerRuntime` takes explicit reviewed configuration, labels state, registry ports, the EXISTING Apple verifier adapter, a server-held HMAC fingerprint key, and an optional provider transport. The App Attest adapter defaults to the unchanged copied Build 18 cryptographic implementation. Injected test verifiers are trusted construction dependencies, never HTTP fields, URL switches, environment flags or deployable fixture modes. A real composition must retain the verified Apple adapter; flags in client evidence are rejected.

The only public challenge body is `{keyId, spki, paidEvidenceHash}`. Purpose, identity, environments, challenge UUID and expiry are server-owned. The digest is an evidence commitment at challenge issuance, not a paid verdict. The same exact JWS bytes must subsequently pass independent Apple verification before a lease can issue. Existing lease fields and the signed fixed-path POST tile contract are unchanged.

## Registry boundary and recovery

The new schema contains challenges only. Its procedures read and advance `subscription_ops.apple_app_attest_keys.assertion_counter`; no second App Attest counter exists. Existing subscription procedures and constraints are imported unchanged as fixtures. Labels never registers/resets a key. The verifier role has procedure execution only, no table access or subscription RPC access.

Labels challenge consumption and shared counter advancement commit together. Existing labels-database admission remains a separate transaction. If paid verification, cancellation or final lease issuance fails after registry consumption, the counter/challenge can remain consumed with no lease returned. Obtain fresh evidence; never roll back a committed counter, reuse an assertion, or perform unbounded retries. Initial key registration/confirmation remains the subscription flow's responsibility.

The existing gateway pending-challenge record is a local admission guard. Challenge issuance across the registry and labels database can leave an orphan when interrupted; it expires and is cleaned up. It cannot authorize a lease by itself. SQL issuance removes at most 500 expired challenge rows and caps outstanding storage at 1024 and 16 unconsumed challenges per key. Existing ingress quotas remain in place.

For a future genuine trial, both purposes must reach the SAME authoritative registry. A copied production key/counter in an isolated database is not an acceptable integration. Provisioning the registry execution role/connection and permitting its counter writes require separate review. Do not distribute a reporting database credential, subscription service-role key or registry connection to the native client.

## Native assembly boundary

Candidate copies retain existing Capacitor methods, Keychain service and state machines. New native-only helpers reuse the SAME registered plugin instances. The labels helper requires an already confirmed key and cannot enter initial registration. It never finishes a purchase. The new adapter implements the existing transport's evidence closure. `LabelsBindingContext` gains public SPKI bytes only; the native P-256 private key remains inside `HTTPSLabelTransport`.

Later assembly must pass the same StoreKit/App Attest instances used by the existing bridge, and connect background/entitlement-loss handling to both adapter invalidation and transport invalidation/scheme suspension. Network recovery obtains a fresh challenge/lease. This repository's shipping bridge and consumer files were not touched.

The transport uses the certified `FixedPathTile` request builder, retaining native signature generation and existing lease validation. No fabricated Referer, new account, unrestricted provider key, direct-provider workaround or alternate map architecture is included.

Swift/Capacitor compilation, runtime cancellation/background behavior and physical-device certification remain unverified on Windows. They require the separate hosted macOS scope in `REPORT.md`.
