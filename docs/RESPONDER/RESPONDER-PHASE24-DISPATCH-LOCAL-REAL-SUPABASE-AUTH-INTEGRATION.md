# Gridly Responder / Dispatch — Phase 24 Local Real Supabase Auth Integration

## 1. Executive Summary

Phase 24 is blocked. A real local Supabase Auth service could not be started, so
no synthetic substitute was used and no real-Auth success claim is made.

## 2. Environment / Tooling

- Supabase CLI: cached npm CLI 2.117.0, callable offline
- Docker CLI: 29.8.0
- Docker Desktop: 4.91.0 installed, engine unavailable
- Native PostgreSQL: 17.10
- Node.js: 24.17.0
- Go, native GoTrue, Podman, and nerdctl: unavailable
- WSL 2: Ubuntu and Docker Desktop distributions present

## 3. Local Supabase Isolation

Existing Supabase link metadata was detected but neither its identifier nor any
credential was read or used. No `supabase link`, remote database command, or
remote Auth request ran. The intended implementation would use a separate
disposable directory and loopback-only network.

## 4. Auth User Model

Not exercised because no real local Auth service became available.

## 5. Email / Identity Verification

Not exercised. No local or production Auth user was created.

## 6. Session Model

Not exercised. No access token or refresh token was issued.

## 7. JWT Claims

Not exercised. Phase 23 findings remain architectural evidence only and were not
represented as Phase 24 real-Auth results.

## 8. JWT Signature Validation

Not exercised because no local signing service or JWKS endpoint was available.

## 9. TOTP Enrollment

Not exercised. No TOTP seed was created or stored.

## 10. Challenge / Verification

Not exercised. No real challenge or verification API was reachable.

## 11. AAL / AMR Results

No actual AAL1/AAL2 or AMR evidence was generated.

## 12. MFA Freshness Conclusion

Phase 24 cannot validate the Phase 23 AAL2-only MVP recommendation. The decision
remains `OWNER_DECISION_REQUIRED FOR STEP-UP` until real local evidence exists.

## 13. Refresh Token Results

Not exercised. No refresh token existed.

## 14. Factor Removal Results

Not exercised. The critical stale-AAL2-token behavior after unenrollment remains
unverified locally.

## 15. User Disable/Delete Results

Not exercised against real Supabase Auth.

## 16. Auth-to-Dispatch Bridge

Not implemented. Phase 23's synthetic trusted-claim bridge was not reused as a
substitute.

## 17. Existing User Invitation

Not exercised with a real Auth user.

## 18. New User Invitation

Not exercised with a real signup/session/TOTP lifecycle.

## 19. Multi-Organization Results

Not exercised with a real JWT/session identity.

## 20. Revocation Results

Not exercised against a still-valid real Auth session.

## 21. Platform Admin Results

Not exercised with a real Auth actor.

## 22. Spoof Resistance

Real JWT tampering, invalid-signature, expiry, and cross-user factor probes were
not possible without a running Auth service.

## 23. Concurrency

Invitation concurrency was not rerun because Phase 24 requires real Auth users.
Phase 22/23 transactional evidence is unchanged but is not counted as Phase 24.

## 24. Auth / Dispatch Audit Boundary

No Auth or Dispatch events were emitted during the availability audit.

## 25. Secrets Hygiene

No JWT, refresh token, TOTP secret, password, service-role key, signing key,
project reference, or production URL was written to these artifacts. Existing
link metadata contents were deliberately not read.

## 26. Production Gaps

Every real-Auth success criterion remains open: canonical Auth user, real
session/JWT, signature validation, TOTP lifecycle, AAL2, refresh rotation,
factor removal, invitation binding, multi-org operation, revocation, spoofing,
platform separation, and real-Auth concurrency.

## 27. Deviations

The availability audit found the cached CLI only after checking the npm cache.
Docker Desktop was installed but stopped. One bounded startup attempt failed
because its backend could not rename a stale local runtime socket. The exact
zero-byte socket was verified with no Docker process using it; deletion failed
both before and after WSL shutdown. Retrying or resetting Docker state was not
safe or useful. Independent GoTrue fallback was impossible without a GoTrue
binary, Go toolchain, or working container engine.

Supabase's current local-development documentation requires the CLI and a
Docker-compatible runtime and recommends loopback isolation. That second
prerequisite was not met.

## 28. Phase 25 Recommendation

Do not begin Phase 25. Repair the local container runtime or provide a pinned
native GoTrue stack, then resume Phase 24 and obtain the required real-Auth
evidence first.
