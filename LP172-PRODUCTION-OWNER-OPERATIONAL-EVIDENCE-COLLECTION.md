# LP172 — Production Owner Operational Evidence Collection

LP172 collects metadata-only owner attestations for monitoring, backup, operational ownership, rollback ownership, and launch operations. The canonical input is `evidence/lp172/owner-operational-evidence.json`; unknown facts must remain `OWNER_ACTION_REQUIRED`. Secret material, credentials, tokens, and connection strings are prohibited.

Run `npm run build:lp172` to regenerate the six canonical reports and `npm run verify:lp172` to check deterministic byte identity. Collection is read-only with respect to protected systems. It does not deploy, activate, distribute, restore, roll back, modify runtime or production configuration, or authorize launch. All authorization states remain fail closed for a future LP167 reassessment.
