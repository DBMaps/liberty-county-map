# Phase 23 local Auth and invitation integration

**LOCAL DISPOSABLE PROTOTYPE ONLY**

**NOT A PRODUCTION MIGRATION**

Phase 23 uses option C, a faithful Auth/JWT/TOTP harness inside the disposable,
loopback-only PostgreSQL 17 environment. The host has neither Supabase CLI nor
Docker, and the repository has no disposable GoTrue pattern. No remote service,
project reference, API key, or persistent Auth state is used.

The layer is loaded after Phases 21 and 22. It supersedes Phase 22 actor/session
bindings with immutable server-controlled claim bindings plus normalized Auth
users, identities, sessions, factors, and AMR rows. All Dispatch commands retain
live database checks for membership, role, organization, scope, and capability.

The harness models factor enrollment and verification state exactly, but does
not generate or verify RFC 6238 codes and never stores a TOTP secret. A future
real local Supabase integration must exercise Enroll, Challenge, Verify, token
refresh, and session revocation APIs.

Invitation tokens are generated with 256 bits of entropy by `auth-harness.mjs`.
Only SHA-256 digests enter PostgreSQL; acceptance hashes plaintext inside the
security-definer command and excludes it from receipts and Dispatch audit.

Run from the repository root:

```powershell
& tools/responder/phase23/run-local-auth-prototype.ps1
```
