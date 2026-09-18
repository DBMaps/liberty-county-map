# Phase 22 neutral Dispatch local RLS and command prototype

**LOCAL DISPOSABLE PROTOTYPE ONLY**

**NOT A PRODUCTION MIGRATION**

This layer is loaded after the Phase 21 schema and fixtures inside a fresh,
loopback-only PostgreSQL cluster. It adds production-shaped synthetic session
evidence, live AAL2/TOTP predicates, command receipts, recovery approvals,
command-owned mutations, and stricter RLS without changing production files.

Files:

- `apply.sql` creates the Phase 22 session, receipt, recovery, RLS, and internal
  authorization layer.
- `commands.sql` creates bounded mutation commands and grants only command
  execution to the local application role.
- `fixtures.sql` adds synthetic actors required for command and quorum tests.
- `rollback.sql` removes the Phase 22 layer; the runner then removes Phase 21.
- `run-local-prototype.ps1` creates, tests, and destroys the disposable cluster.

Synthetic session rows and PostgreSQL login-role bindings stand in for future
Supabase Auth evidence. They are controlled by the test harness, never accepted
from business-row payloads, and MUST NOT be copied into production.

Run from the repository root:

```powershell
& tools/responder/phase22/run-local-prototype.ps1
```
