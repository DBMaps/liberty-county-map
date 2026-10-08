# Dispatch disposable authentication safety gate

This fixture is LOCAL and SYNTHETIC only. It does not implement operational authentication.
Stage 1 is certified; Stage 2 is blocked pending owner review of a bounded authorized-context
read contract. No consumer, production, frozen backend package, or Dispatch application changes.

## Run the guard

From the Dispatch worktree, in PowerShell:

```powershell
.\tools\dispatch-auth-local\run.ps1 -GuardOnly -Supabase '<absolute path to Supabase CLI v2.119.0>' -Docker '<absolute path to Docker Desktop docker.exe>'
```

The runner creates an unlinked TEMP project, an isolated bridge, and a private TEMP Docker shim.
Only that runner's child PATH changes. The shim pins the local Linux named-pipe endpoint.
No persistent executable, credentials, container, volume or network survives cleanup.
Without `-GuardOnly`, operational execution is deliberately refused.

The exact long-running services are Postgres 17.11.0.002, Kong 2.8.1, Mailpit 1.31.3,
GoTrue 2.197.0 and PostgREST 16.4. Only these publications are accepted:

| Service | Explicit host publication |
| --- | --- |
| Kong | 127.0.0.1:54321 -> 8000/tcp |
| PostgreSQL | 127.0.0.1:54322 -> 5432/tcp |
| Mailpit | 127.0.0.1:54324 -> 8025/tcp |
| GoTrue, PostgREST | None |

The pinned CLI supplies host-port mappings without a host IP. The guard rewrites them before
`docker create`. Unknown ports, protocols, service identities, images, flags and lifecycle forms
fail closed. Before each service starts, Docker inspection checks the requested HostIp,
publication count, exact mapping and single project network. After startup, the runner checks
resolved HostIp and verifies that all three rewrites actually occurred. It does not rely on the
bridge's default binding option.

The CLI also runs a temporary GoTrue migration job. Only its documented `gotrue migrate`
command, pinned image, `--rm`, exact project labels, isolated network and key-only environment
arguments are accepted. It cannot publish ports. Unused Realtime and Storage are disabled in
the disposable config, rather than permitting unrelated migration jobs.

Adversarial checks reject explicit IPv4/IPv6 wildcards, unknown host/container ports, UDP,
publish-all, compact publish flags, host-network syntax and privileged creation. A stopped,
unsafe negative-control container is created through the real Docker CLI and refused by the
pre-start inspection; it is never started. Local TCP reachability and each available host
non-loopback IPv4 address are tested. These are host-side probes, not external-device tests.
IPv6 publication is not enabled.

Historical certification scripts remain unchanged. They are not guarded by this fixture and
must not be used as an operational Milestone 1 startup path. All future Milestone 1 disposable
Auth runs must use this guard and pass its inspection and reachability checks first.

## Current authorization boundary

The existing Data API exposes records, projections and narrow commands, but no authorized
organization/unit context read. Organizations and units have governed RLS policies, while
`authenticated` has no read-column grants on those tables. Operational records cannot establish
membership in an empty unit. Demo fixtures cannot supply authority.

The attempted invoker-only context adapter requested new column-read grants on private
organizations and units. Automatic approval review rejected that expansion. No SQL or adapter
was applied. Owner approval of an exact bounded context contract is required before Stage 2.
Do not infer approval to change existing owners, Auth-table grants, RLS, command dispatch,
service-role browser access or publication controls.

The smallest context proposal for owner review is:

- One disposable-only invoker RPC returning `{ organizationId, organizationLabel, unitId, unitLabel }` for each authorized unit; an empty result denies operational access.
- Exact new column-read scope: `organizations(id, display_name)` and `organization_units(id, organization_id, display_name)` for `authenticated` only.
- Existing forced RLS, `has_live_aal2()` and `unit_access(organization, unit, 'operations.read')` govern every read. No role, membership, Auth table or private payload columns are exposed.
- Scoped record reads reuse the existing security-invoker `dispatch_api.operational_records` view, with an explicit non-null authorized organization/unit pair.
- No changes to existing function owners, command dispatch, Auth grants, RLS policies, production schemas or publication capabilities.

This is a proposal, not applied SQL or a certified operational contract. Do not execute it without resolving the approval gate.
