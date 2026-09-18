# Phase 24 local real Supabase Auth integration

**LOCAL DISPOSABLE SYNTHETIC-DATA-ONLY VALIDATION — PASS**

**NOT A PRODUCTION MIGRATION**

This layer connects real local Supabase Auth evidence to the Phase 22 Dispatch
command context. It uses canonical Auth UUIDs, signed session claims, verified
same-user TOTP factors, live Auth sessions, and live Dispatch authorization
state. It never uses the Phase 23 synthetic Auth harness as evidence.

Files:

- `bootstrap.sql` provides the local Supabase pgcrypto compatibility binding.
- `apply.sql` creates the real-Auth bridge, invitation commands, and bounded
  PostgREST RPC surface.
- `run-local-real-auth.ps1` creates an isolated unlinked stack, runs the suite,
  stops all services, removes the Docker network, and deletes temporary state.

Prerequisites are Docker Desktop with a healthy Linux engine and the repository's
pinned Supabase CLI dependency. Run from the repository root:

```powershell
& tools/responder/phase24/run-local-real-auth.ps1
```

The runner uses loopback ports 54321 (API), 54322 (PostgreSQL), and 54324
(Mailpit). It aborts if its disposable project is linked or the API is not
loopback-only. Credentials and TOTP material remain ephemeral and are never
printed by the runner or committed.
