# Phase 21 neutral Dispatch local prototype

**LOCAL DISPOSABLE PROTOTYPE ONLY**

**NOT A PRODUCTION MIGRATION**

This directory implements the Phase 20 neutral Dispatch contract only inside a
fresh loopback PostgreSQL cluster created by `run-local-prototype.ps1`.

Files:

- `apply.sql` creates the isolated `dispatch_phase21_local` prototype schema,
  local roles, constraints, indexes, RLS policies, and disposable helpers.
- `fixtures.sql` inserts synthetic multi-sector organizations and users.
- `rollback.sql` removes only the prototype schema and local group roles.
- `run-local-prototype.ps1` creates a temporary PostgreSQL 17 cluster, runs the
  Node test harness, stops the server, validates the cleanup path, and removes
  the temporary directory.

The harness replaces PostgreSQL host/port/user with its own local settings and
strips inherited password, service, Supabase, and `DATABASE_URL` connection
variables. It binds PostgreSQL only to `127.0.0.1`, creates its own random
database and login roles, and uses synthetic UUIDs. The
`local_actor_bindings` table and actor login roles are test-harness substitutes
for future production Auth. They MUST NOT be copied into a production design.

Run from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/responder/phase21/run-local-prototype.ps1
```
