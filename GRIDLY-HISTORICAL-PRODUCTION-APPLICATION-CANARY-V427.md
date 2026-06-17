# V427 — Manual Supabase Production Application & Canary Capture

## 1. Quick Summary

V427 did not apply production changes and did not execute the one-event historical capture canary from this environment.

The repository implementation remains complete, and the approved V425 artifacts are present locally. The verified blocker is still outside the repository: this execution environment does not have the authorized Supabase production administration context required to update the Supabase/PostgREST exposed schema list, run the production migration, inspect database grants/RLS policies, or capture browser runtime canary evidence against production.

The only live production network probe attempted from this environment was blocked before reaching Supabase/PostgREST by the outbound CONNECT tunnel:

```text
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
server: envoy
```

Therefore, V427 success path **B** applies: the next verified production boundary beyond PGRST106 is still authorized production access/network reachability for Supabase administration and PostgREST validation. No historical reads, UI exposure, monitoring access, retention access, analytics consumption, DriveTexas work, or history-based product behavior was enabled.

## 2. Exact Production Changes Applied

None from this environment.

The approved V425 production changes that still require manual application in the authorized Supabase environment are:

1. Supabase API/PostgREST exposed schemas:
   - `public`
   - `graphql_public`
   - `history_capture`
2. Apply migration:
   - `supabase/migrations/202606170425_history_capture_schema_exposure.sql`
3. Preserve rollback migration without executing it unless required:
   - `supabase/migrations/202606170426_rollback_history_capture_schema_exposure.sql`

Repository evidence remains aligned with the approved change set:

- `supabase/config.toml` tracks `history_capture` in the approved exposed schema list.
- The V425 migration grants `anon` usage on `history_capture`, grants INSERT on `history_capture.historical_events`, revokes reads and non-insert mutation privileges, keeps monitoring and retention tables isolated, enables RLS on historical tables, and creates the approved insert policy.
- The V425 rollback migration remains available and was not executed.

## 3. Pre-Canary Validation Results

Production pre-canary validation could not be completed because production changes were not applied and the production Supabase REST endpoint could not be reached from this environment.

| Verification | Result | Evidence |
| --- | --- | --- |
| `history_capture` exposed | Not verified | Requires Supabase API settings access or reachable PostgREST response; current probe was blocked by CONNECT tunnel HTTP 403. |
| `historical_events` reachable through PostgREST | Not verified | `curl` to `/rest/v1/historical_events` with `Accept-Profile: history_capture` failed before Supabase/PostgREST. |
| `anon` has schema usage | Not verified | Requires production database privilege inspection after migration. |
| `anon` has INSERT on `historical_events` | Not verified | Requires production database privilege inspection or successful controlled insert. |
| `anon` lacks SELECT | Not verified | Requires production database privilege inspection or reachable PostgREST denial evidence. |
| `anon` lacks UPDATE | Not verified | Requires production database privilege inspection or reachable PostgREST denial evidence. |
| `anon` lacks DELETE | Not verified | Requires production database privilege inspection or reachable PostgREST denial evidence. |
| `anon` lacks TRUNCATE | Not verified | Requires production database privilege inspection. |
| `writer_monitoring_events` inaccessible | Not verified | `curl` probe failed before Supabase/PostgREST. |
| `retention_runs` inaccessible | Not verified | `curl` probe failed before Supabase/PostgREST. |
| RLS enabled on all historical tables | Not verified | Requires production database inspection. |
| Approved insert policy present | Not verified | Requires production database policy inspection. |

### Network Probe Evidence

Command executed:

```bash
SUPABASE_URL='https://nhwhkbkludzkuyxmkkcj.supabase.co'
SUPABASE_KEY='[public publishable key from repository]'
for path in "/rest/v1/historical_events?select=*&limit=1" "/rest/v1/writer_monitoring_events?select=*&limit=1" "/rest/v1/retention_runs?select=*&limit=1"; do
  curl -sS -i "$SUPABASE_URL$path" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Accept-Profile: history_capture" \
    -H "Content-Profile: history_capture"
done
```

Raw output:

```text
--- /rest/v1/historical_events?select=*&limit=1
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Wed, 17 Jun 2026 16:11:26 GMT
server: envoy
connection: close

--- /rest/v1/writer_monitoring_events?select=*&limit=1
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Wed, 17 Jun 2026 16:11:26 GMT
server: envoy
connection: close

--- /rest/v1/retention_runs?select=*&limit=1
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
content-length: 9
content-type: text/plain
date: Wed, 17 Jun 2026 16:11:26 GMT
server: envoy
connection: close
```

## 4. Canary Results

The one-event canary was **not executed**.

Reason: the requested sequence requires production application and pre-canary validation before the controlled event. Since neither production schema exposure nor migration application could be verified from this environment, starting a canary would have violated the V427 governance boundary.

Target remains:

```text
eventsObserved: 1
eventsWritten: 1
writerErrors: 0
protectedSystemsUnchanged: true
```

Observed in this environment:

```text
eventsObserved: not executed
eventsWritten: not executed
writerErrors: not executed
protectedSystemsUnchanged: true by repository scope; production runtime not mutated
```

## 5. Runtime Diagnostic Output

The requested browser runtime diagnostics were not captured because the canary was not executed:

```js
window.gridlyHistoricalCanaryAudit?.()
window.gridlyHistoricalCanaryStatus?.()
window.gridlyHistoricalWriterDiagnostic?.()
```

No runtime writer error was produced in this environment. The exact failure category for V427 is **PostgREST configuration / production access boundary**, specifically: production PostgREST validation and Supabase administration could not be reached or performed from this environment. This is not evidence of a writer implementation failure, payload validation failure, RLS failure, or role mismatch.

## 6. Protected-System Review

No production mutation was applied and no repository code path was changed in V427. The following protected systems remain unchanged by this V427 report:

- Shared Reports
- Route Watch
- Awareness Filtering
- Hazard Lifecycle
- Alert Generation
- Supabase Sync

DriveTexas remains designed, validated, governed, and paused. No DriveTexas work was restarted.

## 7. Rollback Recommendation

Do not execute rollback based on this V427 attempt.

No V425 production mutation was applied from this environment, and no canary write was attempted. Keep `supabase/migrations/202606170426_rollback_history_capture_schema_exposure.sql` preserved for authorized production use only if the approved V425 changes are applied and then a verified failure requires rollback.

## 8. Merge Recommendation

Merge this V427 evidence report only as an operational boundary record. Do not treat it as a successful production application or successful historical evidence canary.

The next authorized production action remains unchanged:

1. In the authorized Supabase environment, expose exactly `public`, `graphql_public`, and `history_capture`.
2. Apply `supabase/migrations/202606170425_history_capture_schema_exposure.sql`.
3. Validate the listed pre-canary grants, denials, RLS state, and insert policy.
4. Execute exactly one controlled canary event.
5. Capture raw outputs from:
   - `window.gridlyHistoricalCanaryAudit?.()`
   - `window.gridlyHistoricalCanaryStatus?.()`
   - `window.gridlyHistoricalWriterDiagnostic?.()`

No scope expansion is recommended.
