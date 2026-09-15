# Responder Phase 15A — controlled production Auth / MFA verification

## 1. Objective

Phase 15A is an owner-operated, one-identity production verification and cleanup plan. The production verification is complete: it measured actual Gridly Platform Supabase Auth behavior for password `aal1`, TOTP enrollment and challenge, `aal2`, JWT/AMR shape, Auth-table correlation, session revocation, factor removal, stale tokens, refresh, and fresh post-reset sign-in. It created no responder schema, membership, public content, report, migration, policy, grant, or publishing path.

Phase 15 established a **CONDITIONAL GO** against project `Gridly Platform`, reference `nhwhkbkludzkuyxmkkcj`, while Auth was empty. The completed Stage 5 and Stage 6 observations close B01 **WITH IMPLEMENTATION REQUIREMENTS**. Final deletion of the marked temporary identity remains separately owner-controlled cleanup, followed by mandatory read-only zero-state certification.

Official behavior references used to design this procedure are the Supabase [MFA guide](https://supabase.com/docs/guides/auth/auth-mfa), [TOTP flow](https://supabase.com/docs/guides/auth/auth-mfa/totp), [sessions guide](https://supabase.com/docs/guides/auth/sessions), [JWT fields](https://supabase.com/docs/guides/auth/jwt-fields), [user management](https://supabase.com/docs/guides/auth/managing-user-data), and the upstream [Auth REST OpenAPI](https://github.com/supabase/auth/blob/master/openapi.yaml). Observations from this project take precedence over assumed behavior.

The machine-readable [Phase 15A production evidence](../../reports/responder/responder-phase15a-production-auth-mfa-verification.json) contains only safe identifiers, status codes, assurance/method values, counts, and conclusions. It contains no email, token, password, TOTP value, key, header, or response body.

### Completed production evidence

- **Stage 5 — native session revocation:** disposable session `ea8d0111-0830-4c95-ba71-c7e3d89a76fc` was `aal2` with password+TOTP AMR. Before logout, Auth user and zero-row PostgREST probes were 200. Local logout returned 204. Reusing the exact same unexpired token produced Auth 403 but PostgREST 200; read-only correlation returned `requested_session_count=0` and `transaction_read_only=on`.
- **Stage 6 — verified-factor removal:** Admin deletion of factor `5afa5b22-4797-416a-8144-b71dab682c40` returned 200 without explicit logout/session/user deletion or replacement enrollment. The exact old unexpired AAL2 token for session `cf4af3f6-0d78-4555-83dd-a1ec2aa6330e` still produced Auth 200 and zero-row PostgREST 200. Its old refresh token was accepted once, retained the same session ID, and returned `aal1` with password-only AMR.
- **Managed reset state:** read-only correlation showed former AAL2 session `cf4af3f6-0d78-4555-83dd-a1ec2aa6330e` survived with `aal1`, null `factor_id`, password-only AMR, and no factor. Historical Stage 4 session `ebae3ce4-a615-40ea-a80e-35eee5280af6` was likewise downgraded to `aal1` with null `factor_id`. Fresh password session `099e2aee-b8be-4bc1-8580-bad0f9d3c7d4` was `aal1`, password-only, with no factors. The observed user-scoped refresh-token count was 6.

These results select Stage 6 Outcome B: sessions survive but are downgraded. They also prove that the already-issued JWT can retain stale AAL2/TOTP claims after the live managed state is downgraded.

## 2. Production mutation authorization boundary

Codex prepared these files and ran local contract tests only. It performed **no production mutation and changed no production Auth user**.

Every mode that creates a user/session/factor, verifies MFA, signs out, removes a factor, or deletes the user refuses to run without `-AuthorizeProductionMutation`. That switch records deliberate operator authority; it is not a blanket approval. Run one stage, inspect its safe output, and stop on any mismatch. Never invoke the Node helper directly for production work.

Only the owner may run blocks marked:

> **OWNER EXECUTION REQUIRED**

Never paste or save an access token, refresh token, password, TOTP code/seed/URI, secret/service-role key, database password, or QR source. The scripts do not output raw session tokens. Secret prompts use `Read-Host -AsSecureString`; values exist only in the current process tree and prompted values are cleared on exit. The enrollment QR exists as one randomly named file below the operating-system Temp directory, is opened locally, and is deleted in `finally` after the owner confirms it was scanned.

## 3. Operator session setup

Use Windows PowerShell 5.1 or PowerShell 7. Use a fresh terminal that is not transcripted. Disable any shell transcript or command-output recorder first. Do not use `Tee-Object`, `Start-Transcript`, shell history expansion containing secret values, or redirection on these commands.

The dedicated email must be owner-supplied. It must not be an owner, responder, GRIDLY_ADMIN, shared, or community-reporting identity. The helper creates the visible label `Gridly Responder Auth Verification Test` and an administrative marker with the same value. Do not commit the email.

The scripts accept `GRIDLY_SUPABASE_SECRET_KEY` or the legacy `GRIDLY_SUPABASE_SERVICE_ROLE_KEY`. Prefer the current secret key. Neither is exposed to browser code or printed. The publishable/anon key is used only with the temporary user's Auth calls.

## 4. Staged verification procedure

### Stage 0 — preflight

**Purpose.** Prove the exact worktree, branch, project reference, Auth/admin reachability, database read-only posture, empty-or-recoverable test identity state, community reporting disabled, agency publishing absent/disabled, and both responder schemas absent.

**Preconditions.** Phase 15A commit checked out cleanly; Node and `psql` installed; the owner has the production publishable key, secret key, and database password; no transcript is active.

**OWNER COMMAND — READ ONLY. This is the first owner action.**

```powershell
cd 'C:\GitHub\liberty-county-map\.artifacts\worktrees\RESPONDER-PHASE0-v1-contract-freeze'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$env:GRIDLY_RESPONDER_TEST_EMAIL = Read-Host 'Dedicated temporary test email'
$env:GRIDLY_SUPABASE_URL = 'https://nhwhkbkludzkuyxmkkcj.supabase.co'
$env:PGHOST = 'db.nhwhkbkludzkuyxmkkcj.supabase.co'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres'
$env:PGSSLMODE = 'verify-full'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode Preflight `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj'
```

The execution-policy change is scoped to this PowerShell process and enables the reviewed local script; it does not change machine/user policy or production. Keep later stages in this same terminal. The script securely prompts for the publishable key, secret/service-role key, and database password if they are not already present in the process environment. It never prints their values. Supabase CLI is reported but is not required because this bounded procedure uses `psql` and the documented Auth REST API.

**Expected output.** Three safe JSON objects report tool/worktree identity, Auth endpoint/admin credential success, and the read-only SQL snapshot, followed by exactly one status line. A brand-new run ends with `PREFLIGHT_PASS_NEW_USER_ALLOWED_AFTER_OWNER_REVIEW`. An interrupted earlier run ends with `PREFLIGHT_RECOVERY_REQUIRED_DO_NOT_CREATE_DUPLICATE` and includes only its safe recovery user UUID.

**Pass condition.** `transaction_read_only=on`; project reference matches; `reporting_enabled=false`; `agency_private_present=false`; `responder_public_present=false`; `agency_publishing_object_count=0`; and either all five Auth populations remain zero or exactly one correctly marked test user exists for recovery.

**Fail condition.** Wrong worktree/branch/project, dirty worktree, tool/auth/database failure, reporting enabled, either responder schema present, an agency-publishing object present, a conflicting email, more than the one marked recovery user, or any unexpected Auth population.

**Rollback / stop.** This stage cannot need rollback. Stop. Do not create a user, clean/reset/stash the worktree, change a gate, or delete an unexpected Auth row. Preserve the safe output for review.

**Paste back.** Paste all safe JSON and the final preflight status line. Do not paste prompts, entered values, or screenshots containing secrets.

### Stage 1 — create the temporary Auth test user

**Purpose.** Create exactly one confirmed password identity carrying the dedicated test marker. No responder membership or application row is created.

**Preconditions.** Owner and Codex reviewed a fresh Stage 0 `PREFLIGHT_PASS_NEW_USER_ALLOWED_AFTER_OWNER_REVIEW`. Never run after the recovery status.

> **OWNER EXECUTION REQUIRED**

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode CreateTestUser `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -AuthorizeProductionMutation
```

Enter a newly generated temporary password only at the secure prompt. Do not reuse it. Copy the returned safe UUID into a PowerShell variable:

```powershell
$TestUserId = [guid](Read-Host 'Paste only the created user_id UUID')
```

**Expected output.** `created=true`, one `user_id`, safe `created_at`, and `label=Gridly Responder Auth Verification Test`. No email or credential is emitted.

**Pass condition.** Exactly one new UUID is returned. Run Stage 5 with no session ID to confirm `user_count=1`, marker match true, and all session/factor/AMR counts zero.

**Fail condition.** Duplicate/conflicting user, missing marker/UUID, unexpected response, or any unrelated Auth count change.

**Rollback / stop.** Stop further testing. If a marked UUID was created, use Stage 10 with that exact UUID. Never retry creation blindly.

**Paste back.** Safe creation JSON and the Stage 5 JSON. Do not paste the email or password.

### Stage 2 — establish an AAL1 session

**Purpose.** Perform a real password sign-in and capture only claim names and safe scalar evidence.

**Preconditions.** One exact `$TestUserId`; no factor yet.

> **OWNER EXECUTION REQUIRED**

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectAal1 `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -AuthorizeProductionMutation
```

Copy only the safe `claims.session_id`:

```powershell
$Aal1SessionId = [guid](Read-Host 'Paste only claims.session_id')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectCorrelation -TestUserId $TestUserId -SessionId $Aal1SessionId
```

**Expected output.** `aal=aal1`, UUID `session_id`, integer `iat` and `exp`, `amr_shape`, method names, a 16-hex subject digest, claim-name list, no factors, and a matching SQL session row.

**Pass condition.** Subject is internally checked against `$TestUserId`; `aal1`; the requested session count is one; session ownership matches; and no token is output or written.

**Fail condition.** Missing/noninteger claims, `aal2` before MFA, factor unexpectedly present, subject mismatch, or absent/mismatched session row.

**Rollback / stop.** Stop. Stage 10 can globally revoke and delete the marked user.

**Paste back.** Entire safe Auth JSON plus correlation JSON.

### Stage 3 — enroll one TOTP factor

**Purpose.** Create exactly one unverified authenticator-app factor and transfer its QR secret directly to the owner's authenticator without permanent evidence.

**Preconditions.** Stage 2 passed; zero factors; owner can scan a QR immediately.

> **OWNER EXECUTION REQUIRED**

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode EnrollTotp `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -AuthorizeProductionMutation
```

Scan the displayed QR. Close its tab, press Enter in PowerShell, and confirm `TEMPORARY_TOTP_QR_DELETED`. Copy only the factor UUID:

```powershell
$FactorId = [guid](Read-Host 'Paste only factor_id')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectCorrelation -TestUserId $TestUserId
```

**Expected output.** One `factor_id`, `factor_type=totp`, `status=unverified`, and QR temporary-file true; SQL shows one unverified TOTP factor.

**Pass condition.** Exactly one unverified TOTP factor exists and the temporary QR file is deleted. Supabase enrollment necessarily creates `unverified`; the requested “verified factor” condition belongs to Stage 4, not Stage 3.

**Fail condition.** A preexisting/second factor, non-TOTP type, QR not removed, or factor not bound to the exact user.

**Rollback / stop.** Do not enroll again. If the QR or seed was exposed, use the exact unverified-factor recovery below after separate owner authorization. Use Stage 10 only if the owner intends to retire the entire test identity.

**Paste back.** Safe enrollment and correlation JSON only. Never paste QR, seed, URI, or TOTP code.

#### Stage 3 recovery — delete one compromised unverified TOTP factor

**Purpose.** Remove one exact compromised `totp/unverified` factor through the supported server-side Auth Admin factor-deletion endpoint while preserving the marked test user, every session, and every refresh token. This recovery performs no sign-in, enrollment, challenge, verification, logout, user deletion, SQL DML, or application/responder mutation.

**Preconditions.** Bounded correlation proves one exact marked test user and identifies the exact unverified TOTP factor UUID. The owner has separately authorized deletion of only that UUID. Do not use this mode for a verified factor: Supabase documents that deleting a verified factor signs the user out of all active sessions.

> **OWNER EXECUTION REQUIRED — EXACT UNVERIFIED FACTOR ONLY**

```powershell
$TestUserId = [guid](Read-Host 'Paste only the marked test user_id UUID')
$FactorId = [guid](Read-Host 'Paste only the compromised unverified factor_id UUID')

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode RecoverUnverifiedTotpFactor `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -FactorId $FactorId `
  -AuthorizeProductionMutation
```

The mode securely prompts only for the production secret/service-role key when it is not already present in the operator process. It fetches the exact user and requires `app_metadata.gridly_operator_test=Gridly Responder Auth Verification Test`; lists factors only for that user; requires exactly one factor matching `$FactorId`; rejects any returned cross-user ownership; requires `factor_type=totp` and `status=unverified`; then sends one exact admin factor `DELETE`. UUID validation rejects wildcard/all-factor targets.

**Expected output.** One safe JSON object reports `mode=RecoverUnverifiedTotpFactor`, the exact user/factor UUIDs, `user_marker_verified=true`, `matching_factor_count=1`, `factor_type=totp`, `prior_status=unverified`, `deleted=true`, `session_operation_performed=false`, `refresh_token_operation_performed=false`, `user_delete_operation_performed=false`, `password_sign_in_performed=false`, and `totp_challenge_performed=false`. It emits no key, email, token, password, QR, seed, URI, or response body.

**Read-only correlation.** After the safe deletion JSON, run only:

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectCorrelation `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId
```

**Pass condition.** The marked user remains; the previously observed sessions remain unchanged and `aal1`; the managed refresh-token count is recorded exactly as observed; `factors=[]`; no `aal2` session exists; and `transaction_read_only=on`.

**Fail condition.** Missing/wrong marker, missing or duplicate matching factor, non-TOTP type, status other than `unverified`, any session/user/refresh-token change, or any unexpected output.

**Rollback / stop.** Factor deletion is irreversible. Never rerun this recovery mode after `deleted=true`. If the deletion result is uncertain, run bounded correlation only. If the factor is absent, stop; if it remains, stop and request review rather than signing in, challenging, enrolling, revoking, deleting the user, or using SQL DML against `auth`.

**Paste back.** The complete safe deletion JSON and the complete correlation JSON. Never paste the admin key or any secret-bearing value.

### Stage 4 — challenge TOTP and achieve AAL2

**Purpose.** Challenge the enrolled TOTP, verify it, and observe whether the same session ID is elevated or replaced.

**Preconditions.** One exact unverified `$FactorId` is present in the authenticator.

> **OWNER EXECUTION REQUIRED**

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode VerifyTotp `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -FactorId $FactorId `
  -AuthorizeProductionMutation
```

Copy only `after.session_id`:

```powershell
$Aal2SessionId = [guid](Read-Host 'Paste only after.session_id')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectCorrelation -TestUserId $TestUserId -SessionId $Aal2SessionId
```

**Expected output.** Before/after safe claims, explicit `same_session_id`, `after.aal=aal2`, actual `after.amr_methods`, `totp_in_amr`, one verified factor, and bounded SQL rows for the session/factor/AMR evidence.

**Pass condition.** Real TOTP succeeds; `aal1` becomes exact `aal2`; factor is verified; session replacement/elevation is recorded rather than assumed; JWT AMR and live metadata can identify TOTP.

**Fail condition.** Alternate method only, missing/malformed AMR, no verified TOTP factor, no live session correlation, or AMR/session/factor contradictions.

**Rollback / stop.** Stop and retain the exact IDs. Do not create another factor. Continue only to Stage 10 unless the owner explicitly authorizes investigation.

**Paste back.** Verify JSON and correlation JSON in full; redact nothing further unless an unexpected field appears, in which case stop and describe the field name only.

### Stage 5 — factor/session correlation

**Purpose.** Read `auth.users`, `auth.sessions`, `auth.refresh_tokens`, `auth.mfa_factors`, and `auth.mfa_amr_claims` only for the dedicated UUID and optional session UUID.

**Preconditions.** Exact `$TestUserId`; optionally exact `$Aal1SessionId` or `$Aal2SessionId`.

**OWNER COMMAND — READ ONLY.**

```powershell
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectCorrelation `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -SessionId $Aal2SessionId
```

**Expected output.** One JSON object with user count/marker, safe session timestamps/AAL/factor ID, refresh-token count only, factor type/status/timestamps, AMR method/timestamps, and `requested_session_count`.

**Pass condition.** JWT `session_id` maps to `auth.sessions.id` for the same user. Record whether `sessions.factor_id` equals the TOTP factor and whether `mfa_amr_claims` contains `totp` for the same session.

**Fail condition.** Cross-user row, unbounded output, missing expected row, or key contradiction.

**Rollback / stop.** Read-only; stop and analyze. Never modify managed `auth` tables with SQL.

**Paste back.** The full single JSON object.

### Stage 6 — simulate the Gridly cutoff locally

**Purpose.** Prove second-precision comparison behavior without creating any production schema.

**Preconditions.** Copy the old token's safe integer `iat`; optionally copy a post-event candidate token `iat`.

**OWNER COMMAND — LOCAL ONLY.**

```powershell
$OldIat = [long](Read-Host 'Paste old token iat integer')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode SimulateCutoff `
  -ObservedOldIssuedAt $OldIat
```

After a new token exists, the optional second calculation is:

```powershell
$NewIat = [long](Read-Host 'Paste candidate new token iat integer')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode SimulateCutoff `
  -ObservedOldIssuedAt $OldIat `
  -CandidateNewIssuedAt $NewIat
```

**Expected output.** `minimum_iat=old_iat+1`, comparison `jwt.iat >= minimum_iat`, old and same-second tokens denied, equality at the new boundary accepted, and optional new-token result.

**Pass condition.** Old `iat` is denied and no token minted in the old second is accepted.

**Fail condition.** A rule using `iat >= floor(event_time)` accepts an old token with `iat == cutoff`, or a token is reissued before the boundary.

**Rollback / stop.** Local calculation only.

**Precision decision.** Do not store an arbitrary fractional `timestamptz` and compare through implicit conversions. The future private control should store an integer `minimum_iat` (or rigorously convert a named timestamp to integer seconds). On a security event: disable the principal first; atomically set `minimum_iat = greatest(existing, floor(database_epoch)+1, observed_old_iat+1 when available)`; revoke sessions; then re-enable only after a fresh verified TOTP session both has `iat >= minimum_iat` and passes the live-session check. Equality is valid at the deliberately advanced boundary. This eliminates the `old iat == event-second cutoff` race. The live-session requirement covers unknown tokens and clock skew while revocation converges.

**Paste back.** The complete local JSON result.

### Stage 7 — controlled stale-token/session-revocation verification

**Purpose.** This is the owner-controlled Stage 5 stale-token experiment. It creates **one new disposable password session**, challenges the exact already-verified TOTP factor, confirms that the same new session reaches `aal2`, probes it, revokes only that new session with `scope=local`, and probes the exact same still-in-memory token again. It does not target or accept the historical Stage 4 session `ebae3ce4-a615-40ea-a80e-35eee5280af6` as a revocation credential. It does not revoke any earlier AAL1 session.

**Preconditions.** Factor/session correlation passed; the supplied factor remains exact, TOTP, and verified. The operator knows the dedicated test email and password and has a current authenticator code. The helper refuses `-SessionId` in this mode. The report probe is the GET-only request `/rest/v1/reports?select=id&limit=0`; an accepted response must parse as an empty array or the helper stops with the body suppressed. It cannot return application rows, mutate a report, activate reporting, or require a responder schema.

> **OWNER EXECUTION REQUIRED**

```powershell
cd 'C:\GitHub\liberty-county-map\.artifacts\worktrees\RESPONDER-PHASE0-v1-contract-freeze'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$TestUserId = [guid]'f01c5e50-854b-49ab-a65f-0ba81744943a'
$FactorId = [guid]'5afa5b22-4797-416a-8144-b71dab682c40'
if (-not $env:GRIDLY_RESPONDER_TEST_EMAIL) {
  $env:GRIDLY_RESPONDER_TEST_EMAIL = Read-Host 'Dedicated temporary test email'
}
$env:GRIDLY_SUPABASE_URL = 'https://nhwhkbkludzkuyxmkkcj.supabase.co'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode RevokeSession `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -FactorId $FactorId `
  -AuthorizeProductionMutation
```

Expect three secret prompts when their process environment variables are absent: production publishable/anon key, temporary test-user password, and current authenticator TOTP code. PowerShell uses `Read-Host -AsSecureString`; none is displayed. Never paste any of them into chat.

The helper keeps both session responses and the one AAL2 bearer token in process memory only. It uses the same `staleAccessToken` variable for the pre-probes, local logout, and post-probes. Its `finally` block nulls the bearer variable and clears access, refresh, and provider-token fields from both in-memory session responses before the Node process terminates. It never hashes the bearer token, puts it in an environment variable, writes it to a file, or emits a response body or Authorization header.

Safe JSON shape, with observed values in place of angle-bracket descriptions:

```json
{
  "mode": "RevokeSession",
  "session_scope": "new_disposable_aal2_session_only",
  "new_password_session_created": true,
  "same_session_elevated_to_aal2": true,
  "verified_factor_id": "5afa5b22-4797-416a-8144-b71dab682c40",
  "historical_session_id_accepted_as_credential": false,
  "revoked_session": "<new session UUID>",
  "pre_revocation": {
    "aal": "aal2",
    "session_id": "<same new session UUID>",
    "iat": 0,
    "exp": 0,
    "amr_methods": ["password", "totp"],
    "auth_user_http_status": 0,
    "postgrest_zero_row_http_status": 0
  },
  "logout_scope": "local",
  "logout_http_status": 204,
  "same_token_reused": true,
  "post_revocation": {
    "auth_user_http_status": 0,
    "postgrest_zero_row_http_status": 0,
    "token_exp_still_in_future": true
  },
  "factor_removed_or_reset": false
}
```

The pre/post probe status values are observations rather than pass values; only successful local logout is fixed at `204`. Copy only `revoked_session` from this safe JSON and inspect it:

```powershell
$RevokedSessionId = [guid](Read-Host 'Paste only the new revoked_session UUID from safe JSON')
& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectRevocation `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -SessionId $RevokedSessionId
```

The correlation command prompts only for the production database password if `PGPASSWORD` is absent. It runs `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, scopes every Auth lookup to `$TestUserId` and the exact `$RevokedSessionId`, and rolls back.

**Expected output.** Safe `aal2` claims and AMR method names; pre-revocation Auth and zero-row PostgREST statuses; logout `204`; `same_token_reused=true`; post-revocation statuses; `token_exp_still_in_future`; and correlation with `transaction_read_only=on`, `user_count=1`, `requested_session_count=0`, the verified TOTP factor still present, and all unrelated test-user sessions still listed.

**Pass condition.** The new session reached `aal2` through TOTP; both pre-probes completed; local logout returned `204`; the same token was reused; the token remained unexpired during the post-probes; and the exact revoked session row is absent afterward. Record endpoint behavior rather than forcing an expected outcome. If Auth rejects the old token, PostgREST accepts it, and `requested_session_count=0`, Gridly must treat the missing live `auth.sessions` row as immediate authorization failure even though the JWT remains cryptographically valid and works against stateless PostgREST.

**Fail condition.** Wrong/multiple factor, factor not verified TOTP, new session not `aal2`, session ID changes during elevation, logout not `204`, token expired before the post-probes, revoked session persists, an accepted PostgREST probe returns anything other than zero rows, an earlier session is missing unexpectedly, factor state changes, or any secret/body/header is emitted.

**Rollback / stop.** Stop immediately after the Stage 5 JSON and its bounded read-only correlation. Do not remove/reset the factor, revoke another session, delete the user, or run cleanup without separate owner authorization. Revocation of the one new disposable session is intentionally irreversible; its absence is the expected recovery state.

**Paste back.** The complete safe revocation JSON and complete single-object correlation JSON. Never paste credentials, tokens, authenticator codes, headers, or response bodies.

### Stage 8 — Stage 6 verified-TOTP reset experiment

**Purpose.** This is the owner-controlled Stage 6 reset experiment. It verifies the exact marked identity and verified TOTP factor through the server-side Admin API before mutation; creates one new password session; elevates that same session to `aal2`; probes it; administratively deletes only the exact factor; reuses the exact old access token for the same probes; attempts the exact old refresh token once; and performs one fresh password sign-in. It determines whether production removes the session or retains it with downgraded managed assurance while the already-issued JWT remains stale.

**Preconditions.** Stage 5 passed; `$TestUserId` and `$FactorId` are exact; the factor remains `totp/verified`; the owner has the dedicated email/password, a current authenticator code, the production publishable/anon key, and a server/operator Admin credential. `-SessionId` is prohibited in the mutation mode. The historical Stage 4 session is observation evidence, not a removal credential.

**Later production mutations.** One pre-removal password sign-in; one TOTP challenge/verification; exact Admin deletion of one factor; one old-refresh-token grant attempt, which may rotate managed refresh state if accepted; and one post-removal password sign-in. The helper performs no explicit logout, session deletion, user deletion, factor replacement, application write, or SQL DML.

> **OWNER EXECUTION REQUIRED**

```powershell
cd 'C:\GitHub\liberty-county-map\.artifacts\worktrees\RESPONDER-PHASE0-v1-contract-freeze'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$TestUserId = [guid]'f01c5e50-854b-49ab-a65f-0ba81744943a'
$FactorId = [guid]'5afa5b22-4797-416a-8144-b71dab682c40'
if (-not $env:GRIDLY_RESPONDER_TEST_EMAIL) {
  $env:GRIDLY_RESPONDER_TEST_EMAIL = Read-Host 'Dedicated temporary test email'
}
$env:GRIDLY_SUPABASE_URL = 'https://nhwhkbkludzkuyxmkkcj.supabase.co'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode RemoveFactor `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -FactorId $FactorId `
  -AuthorizeProductionMutation
```

The concealed prompts, when values are absent, are: production publishable/anon key, production secret/service-role key, temporary test-user password, and current authenticator TOTP code. Never paste any prompt value into evidence or chat. The dispatcher clears the password, TOTP code, publishable key, and both accepted Admin-key environment names in `finally`, even when they existed before invocation.

The exact factor mutation is `DELETE /auth/v1/admin/users/{userId}/factors/{factorId}` with the Admin credential in this operator-side Node process. The response body is discarded. The helper never calls the user-side factor-delete path, `/logout`, a session-delete path, a user-delete path, or a factor-enrollment path.

Safe JSON shape; numeric/status placeholders are replaced by observations:

```json
{
  "mode": "RemoveFactor",
  "session_scope": "new_disposable_aal2_session_only",
  "marked_user_verified": true,
  "verified_factor_id": "5afa5b22-4797-416a-8144-b71dab682c40",
  "same_session_elevated_to_aal2": true,
  "pre_removal": {
    "aal": "aal2",
    "session_id": "<former disposable AAL2 session UUID>",
    "iat": 0,
    "exp": 0,
    "amr_methods": ["password", "totp"],
    "token_exp_still_in_future": true,
    "auth_user_http_status": 0,
    "postgrest_zero_row_http_status": 0,
    "postgrest_zero_rows_confirmed": true
  },
  "admin_factor_delete": {
    "factor_id": "5afa5b22-4797-416a-8144-b71dab682c40",
    "http_status": 200,
    "explicit_logout_performed": false,
    "explicit_session_delete_performed": false,
    "user_delete_performed": false,
    "factor_replacement_performed": false
  },
  "post_removal_old_access_token": {
    "same_token_reused": true,
    "auth_user_http_status": 0,
    "postgrest_zero_row_http_status": 0,
    "postgrest_zero_rows_confirmed": true,
    "token_exp_still_in_future": true
  },
  "old_refresh": {
    "attempted": true,
    "accepted": false,
    "http_status": 0,
    "refreshed_aal": null,
    "refreshed_session_id": null,
    "refreshed_iat": null,
    "refreshed_exp": null,
    "refreshed_amr_methods": []
  },
  "fresh_password_sign_in": {
    "aal": "<observed AAL>",
    "session_id": "<fresh post-removal session UUID>",
    "iat": 0,
    "exp": 0,
    "amr_methods": ["<observed methods>"],
    "sub_sha256_16": "<safe subject digest>",
    "factors": []
  }
}
```

If refresh succeeds, `accepted` is `true` and only the safe refreshed AAL/session/`iat`/`exp`/AMR fields are populated. The old refresh token is attempted exactly once and is never retried, printed, hashed, or persisted. All access, refresh, provider-token, Admin-key, password, and TOTP references are cleared in `finally` before the helper process exits.

Copy `pre_removal.session_id` and `fresh_password_sign_in.session_id` only, then run both exact read-only correlations:

```powershell
$FormerAal2SessionId = [guid](Read-Host 'Paste only pre_removal.session_id')
$FreshPasswordSessionId = [guid](Read-Host 'Paste only fresh_password_sign_in.session_id')

$env:PGHOST = 'db.nhwhkbkludzkuyxmkkcj.supabase.co'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres'
$env:PGSSLMODE = 'verify-full'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectReset `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -SessionId $FormerAal2SessionId

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode InspectReset `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -SessionId $FreshPasswordSessionId
```

Both correlations use repeatable-read read-only transactions, exact UUID predicates, short timeouts, one safe JSON row, and rollback. They report all sessions only for `$TestUserId`; `mfa_amr_claims` is restricted to the requested session.

**Interpretation.** Classify from production evidence only:

- **OUTCOME A — SESSION REVOKED:** former `requested_session_count=0`. Old Auth and refresh behavior are recorded independently; PostgREST may still accept the unexpired JWT.
- **OUTCOME B — SESSION SURVIVES BUT IS DOWNGRADED:** former `requested_session_count=1`, live session `aal=aal1`, `factor_id=null`, and TOTP AMR absent from live managed state. The stale access token may still claim `aal2`/TOTP and remain endpoint-accepted.
- **OUTCOME C — UNEXPECTED STATE:** factor remains, session remains `aal2`, factor association or TOTP AMR contradicts removal, fresh sign-in retains TOTP capability, response returns application data, or any other cross-layer inconsistency occurs.

Current Supabase Auth source and its 2.193.0 changelog implement Admin deletion by downgrading factor-associated sessions and stripping the applicable MFA AMR evidence, while the public Admin API reference still describes all-session logout. This discrepancy is why production observation controls the Gridly decision.

**Expected output.** Exact safe pre/post statuses; confirmed zero-row reads; Admin delete `200`; one old-refresh result; one fresh-sign-in claim summary and factor list; then two SQL objects with `transaction_read_only=on`, `user_count=1`, marker true, exact `requested_session_count`, safe user-scoped sessions, refresh-token count, factors, and requested-session AMR evidence.

**Pass condition.** Exact factor is gone; old access/refresh behavior is measured while unexpired; the former session is unambiguously classified A or B; AMR/session/factor state agrees; fresh sign-in behavior is measured; and the evidence can select the smallest fail-closed combination of live session, live assurance/factor/AMR, and `minimum_iat`.

**Fail condition.** Any input/marker/factor mismatch; different-session elevation; missing password/TOTP AMR; nonempty PostgREST result; wrong deletion endpoint/status; refresh retry; token expiry before comparison; unclassified/contradictory state; factor replacement; user/application mutation; SQL write; or secret-bearing output.

**Rollback / stop.** Factor removal is irreversible. Stop immediately after the safe helper JSON and two bounded correlations. Cleanup, replacement enrollment, session revocation, and user deletion remain separately authorized. On failure, preserve IDs and paste only safe field names/statuses; do not retry factor deletion or the old refresh token.

**Paste back.** Complete safe RemoveFactor JSON and both complete correlation JSON objects. Never paste credentials, tokens, authenticator codes, response bodies, headers, email, or factor secrets.

### Stage 9 — optional re-enrollment

**Purpose.** Repeat Stages 3–4 only if the returned Stage 8 evidence cannot establish a clean post-reset `aal2` transition.

**Preconditions.** Owner and Codex explicitly agree the missing proof requires re-enrollment. Ordinary completion skips this stage.

> **OWNER EXECUTION REQUIRED — OPTIONAL**

Use the exact Stage 3 and Stage 4 blocks once, assigning the returned new factor UUID to `$FactorId`. Do not create a second user or concurrent factor.

**Expected output / pass.** Same as Stages 3–5, with a post-reset factor and session. **Fail / rollback.** Stop on any duplicate or contradiction; Stage 10 removes the one marked identity and all of its remaining factors.

**Paste back.** Only the same safe outputs required for Stages 3–5.

### Stage 10 — retire the test identity

**Purpose.** Verify the one frozen UUID, email, administrative marker, and live user state; create one cleanup session; require supported global logout HTTP 204; remove only factors listed by the Admin API for that exact user; hard-delete only that marked user through the Admin API; then separately certify zero residual rows.

**Preconditions.** Exact `$TestUserId` `f01c5e50-854b-49ab-a65f-0ba81744943a`; dedicated email unchanged; current test-user password available; production publishable and server/operator Admin credentials available; no shell transcript; clean expected responder worktree. The current observed factor list is empty. Any UUID other than the frozen test UUID is rejected before credentials are requested.

> **OWNER EXECUTION REQUIRED — CLEANUP IS NOT AUTHORIZED BY THIS COMMIT**

```powershell
cd 'C:\GitHub\liberty-county-map\.artifacts\worktrees\RESPONDER-PHASE0-v1-contract-freeze'
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force

$TestUserId = [guid]'f01c5e50-854b-49ab-a65f-0ba81744943a'
if (-not $env:GRIDLY_RESPONDER_TEST_EMAIL) {
  $env:GRIDLY_RESPONDER_TEST_EMAIL = Read-Host 'Dedicated temporary test email'
}
$env:GRIDLY_SUPABASE_URL = 'https://nhwhkbkludzkuyxmkkcj.supabase.co'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode Cleanup `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId `
  -AuthorizeProductionMutation
```

Concealed prompts are production publishable/anon key, production secret/service-role Admin key, and the temporary test-user password. The helper creates one cleanup session only so `POST /auth/v1/logout?scope=global` can retire all managed sessions/refresh state. HTTP 204 is mandatory; failure stops before factor or user deletion. The helper then uses only exact Admin URLs below and suppresses response bodies:

- `DELETE /auth/v1/admin/users/{exact-user-id}/factors/{factor-id}` only for factors returned for that exact user;
- `DELETE /auth/v1/admin/users/{exact-user-id}` with hard-delete semantics.

Expected safe cleanup JSON:

```json
{
  "mode": "Cleanup",
  "target_scope": "one_exact_marked_phase15a_test_user_only",
  "user_id": "f01c5e50-854b-49ab-a65f-0ba81744943a",
  "marked_user_verified": true,
  "email_match_verified": true,
  "user_not_deleted_verified": true,
  "cleanup_session_created": true,
  "session_retirement": {
    "method": "authenticated_global_logout",
    "scope": "global",
    "http_status": 204
  },
  "factor_cleanup": {
    "listed_count": 0,
    "removed_count": 0,
    "exact_user_only": true
  },
  "user_delete": {
    "method": "admin_hard_delete_exact_user",
    "http_status": 200,
    "hard_deleted": true
  },
  "sql_dml_performed": false,
  "application_or_responder_mutation_performed": false
}
```

Run certification as a separate read-only owner step after reviewing the cleanup JSON:

```powershell
$env:PGHOST = 'db.nhwhkbkludzkuyxmkkcj.supabase.co'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGUSER = 'postgres'
$env:PGSSLMODE = 'verify-full'

& '.\tools\responder\phase15a-auth-mfa-verification.ps1' `
  -Mode CertifyCleanup `
  -ProjectRef 'nhwhkbkludzkuyxmkkcj' `
  -TestUserId $TestUserId
```

Certification is an exact-UUID, repeatable-read, read-only transaction with short timeouts and rollback. It emits `transaction_read_only=on`, five zero counts, `cleanup_certified=true`, then `CLEANUP_CERTIFICATION_PASS`.

**Pass condition.** Global logout is 204; exact hard deletion is 200; test user, sessions, refresh tokens, factors, and joined AMR rows all equal zero; and `cleanup_certified=true`. Global Auth counts return to the Stage 0 baseline. Reporting remains false and responder schemas remain absent when Stage 0 is rerun.

**Fail condition.** UUID differs from the frozen cleanup UUID; Admin response UUID, marker, live state, or email mismatches; global logout is not 204; an Admin deletion fails; any residual count is nonzero; or any unrelated Auth user is addressed.

**Rollback / stop.** Deletion is intentionally irreversible. Stop after the cleanup JSON; review it before certification. Stop after `CLEANUP_CERTIFICATION_PASS`. On partial failure, do not substitute another UUID, directly delete managed Auth rows, or improvise a broader operation. Preserve the exact UUID and safe completed-step/status fields for review before any retry.

**Paste back.** Complete safe Cleanup JSON, complete CertifyCleanup JSON, the pass marker, and a final Stage 0 read-only preflight JSON. Never paste secrets.

## 5. Recovery procedure for an interrupted run

Always begin recovery with Stage 0. If it returns a `recovery_user_id`, set `$TestUserId` to only that UUID and run `InspectCorrelation` without a session ID. Never rerun CreateTestUser while recovery is reported.

| Detected state | Detection | Safe next action | Cleanup action |
| --- | --- | --- | --- |
| User exists, no session/factor | `user_count=1`; empty sessions/factors | Resume Stage 2 or stop | Stage 10 |
| User + AAL1 session | session `aal1`; no factor | Resume Stage 3 | Stage 10 globally revokes then deletes |
| User + TOTP factor, not verified | one `totp/unverified` | If the factor is compromised/unusable, run exact unverified-factor recovery after separate authorization; otherwise resume Stage 4 only with an intact secret | Exact recovery preserves user/sessions; Stage 10 only when retiring the user |
| User + verified factor | `totp/verified`; no proved AAL2 session | Resume Stage 4 with exact factor | Stage 10 |
| User + AAL2 session | session/AMR/factor correlate | Resume Stage 5 or 7 | Stage 10 |
| Session revoked | requested session count zero; user/factor remain | Resume Stage 8 | Stage 10 |
| Factor removed | factor list empty | Skip Stage 9 unless needed; proceed to cleanup | Stage 10 |
| Partial cleanup | cleanup output or certification is incomplete | If the exact user is absent, run `CertifyCleanup`; if it remains, inspect exact state and obtain review before retry | Never delete rows with SQL or use an all-user operation |

If the marked user exists but its password is unavailable, the prepared Stage 10 mode fails closed because it cannot prove global logout HTTP 204. Do not bypass that precondition or fall back to direct Auth-table DML. Recover the dedicated credential or obtain a separately reviewed owner authorization for a revised supported Admin cleanup path. If hard deletion already succeeded, do not rerun mutation; run `CertifyCleanup` only.

## 6. Evidence handling and redaction

Permitted evidence is limited to tool versions, project reference/name, UUIDs needed for correlation, safe timestamps/statuses, `aal`, integer `iat`/`exp`, AMR method names/shape, claim names, a truncated SHA-256 subject digest, counts, HTTP status/acceptance booleans, and gate/schema booleans.

Never persist or paste email, password, access/refresh token, complete JWT, authorization header, secret/service-role/publishable key, database password, TOTP code/seed/URI, QR source, IP, user agent, cookie, device identity, or unrelated Auth/application rows. If unexpected output includes any of these, do not paste it; state only the stage and unexpected field name.

The Node helper parses issued JWTs only to select allowed evidence. It never verifies authorization from local decoding. Production authorization conclusions use observed Auth endpoint behavior and bounded database correlation. The stale-token PostgREST probe is a GET with `select=id&limit=0`; it cannot return or write a report row.

## 7. Final authorization contract selected from observations

**Selected minimum: live principal + live session assurance + current authorization.** Stage 5 showed that an unexpired token can outlive its session for stateless PostgREST. Stage 6 showed that a verified-factor reset can leave a session row alive while downgrading its managed AAL, clearing `factor_id`, deleting the factor, and removing TOTP AMR; the old JWT still claimed and exercised stale AAL2 state. Therefore neither JWT claims nor live session existence alone is sufficient.

The minimum Phase 16 control is:

- private active/enabled principal state for an immediate Gridly eligibility kill switch;
- exact signed `session_id` parsed as UUID and matched to a live `auth.sessions` row owned by `auth.uid()`;
- live session `aal=aal2`;
- non-null live `factor_id` joined to a same-user `auth.mfa_factors` row with `factor_type=totp` and `status=verified`;
- live `auth.mfa_amr_claims` TOTP method for that session;
- signed JWT `aal2` and TOTP AMR as fail-closed consistency checks, never as substitutes for live state;
- current active membership, organization verification/operation, role, county authority, publishing gate, command rule, and separate GRIDLY_ADMIN grant where applicable.

`valid_after`/integer `minimum_iat` is **optional defense in depth**, not required by the minimum production-proven predicate. Native logout is immediately caught by the missing live session. Admin factor reset is immediately caught by live `aal1`, null factor binding, missing factor, and missing TOTP AMR. A cutoff remains useful for incident containment, partial provider failures, behavior drift, reconciliation, or ensuring pre-incident sessions cannot become useful after re-enable. If implemented, use integer JWT-second semantics and treat it as an additional fail-closed predicate; never use it instead of live session/assurance/authority checks.

The live checks require a narrowly owned private `SECURITY DEFINER` helper because client roles have no direct managed-Auth table reads. It must use an empty search path, fully qualified names, revoked default `PUBLIC` execute, minimum caller grants, no dynamic SQL, no general Auth-table reader, and no managed `auth` modification or trigger. Production acceptance must pin and test the managed columns/relationships and fail closed on provider drift.

## 8. Frozen TOTP-specific predicate

The final predicate is:

1. signed JWT `aal` is exactly `aal2`;
2. JWT `amr` is a well-formed array containing method `totp`;
3. JWT `session_id` belongs to `auth.uid()` and is live;
4. the same session's `auth.mfa_amr_claims` records TOTP authentication;
5. if observed consistently, `auth.sessions.factor_id` identifies a currently `verified`, same-user `auth.mfa_factors.factor_type='totp'` row;
6. current active principal and authorization rows pass;
7. when the optional cutoff is deployed, integer JWT `iat >= minimum_iat` also passes.

`aal2` alone is insufficient because phone/WebAuthn can also establish it. Missing, malformed, alternate-only, cross-user, removed-factor, or inconsistent evidence fails closed. Production Stage 4 established the session/factor/AMR relationship; Stage 6 established that factor reset clears the live relationship even while the old JWT remains stale. Both the factor join and live AMR check are required implementation constraints.

## 9. Production safety invariants

At every stage: `reporting_enabled` remains false; agency publishing remains absent/disabled; `agency_private` and `responder_public` remain absent; community reporting data is unchanged; no application data is mutated; no agency content is published; no GRIDLY_ADMIN grant, migration, RLS policy, function, trigger, schema, table, role, grant, or configuration is created/changed; and no Auth user other than the exact marked test UUID is mutated.

The procedure intentionally performs only Auth mutations required by the stage. It never executes SQL DML. All SQL begins a repeatable-read read-only transaction, sets short timeouts and UTC, emits one bounded JSON row, and rolls back.

## 10. Final B01 disposition

**B01 CLOSED WITH IMPLEMENTATION REQUIREMENTS.** Owner evidence proved:

1. one marked user was created and no other user changed;
2. real password sign-in produced correlated `aal1` session evidence;
3. one TOTP enrollment created `unverified`, then challenge/verify made it `verified` and produced exact `aal2`;
4. actual JWT claim names, AMR shape/methods, `session_id`, `iat`, and `exp` were captured safely;
5. session elevation versus replacement was observed;
6. JWT/session/factor/AMR keys correlated without contradiction;
7. TOTP can be distinguished from generic `aal2` with a minimum supported predicate;
8. local integer cutoff tests deny the old/same-second token;
9. session revocation row behavior, Auth `/user` behavior, and normal zero-row PostgREST JWT behavior were separately measured;
10. factor removal effects on the old access token, refresh, session, fresh sign-in, factor row, and AMR evidence were measured;
11. the final authorization recommendation is selected from A–D based on those measurements;
12. the minimum authorization contract is live principal + live session ownership + live AAL2 + live verified TOTP factor + live TOTP AMR + current responder/governance authorization.

Temporary identity cleanup and zero-state certification remain mandatory Phase 15A operational exit work, but no authentication-behavior uncertainty remains open under B01. Phase 16 implementation acceptance remains blocked until the frozen predicate is implemented and tested; closure is not deployment authorization.

## 11. What the owner must paste back

After each stage paste only the complete safe JSON/status named in that stage. Preserve field names and values exactly; do not summarize `same_session_id`, AMR methods, HTTP statuses, counts, or timestamps. UUIDs in these outputs are intentional correlation evidence. Never paste entered environment values, secure prompts, QR/seed, TOTP code, email, password, or token.

The remaining review checkpoints are mandatory: owner review before Stage 10 cleanup, review of the cleanup JSON before read-only certification, and final Stage 0 read-only preflight after certification.
