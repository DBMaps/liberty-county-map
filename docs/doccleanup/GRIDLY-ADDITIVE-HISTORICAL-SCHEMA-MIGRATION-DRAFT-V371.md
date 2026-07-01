# V371 — Additive Historical Schema Migration Draft

## 1. Quick Summary

V371 creates draft SQL migration artifacts for future historical incident storage.

The migration is additive-schema-only and remains a draft. It was not applied to Supabase, it does not integrate the app, and it does not enable historical reads or writes.

## 2. Scope

Created draft migration files for future tables:

- `historical_incidents`
- `incident_events`
- `incident_recurrence_index`

The draft includes likely lookup indexes and conservative RLS posture for review.

## 3. Migration Is Draft Only

The V371 SQL files are review artifacts only.

They are not approval to run a migration, change Supabase, connect the app, or begin storing historical incidents.

## 4. Supabase Changes Applied

**NO.**

No Supabase migration was applied. No remote database was modified. No table, policy, index, trigger, function, or data row was changed in Supabase.

## 5. App Integration Changes

**NONE.**

V371 does not modify application integration. It does not modify `js/app.js`, `index.html`, or `css/styles.css`.

## 6. Production Read/Write Safety

- Production read changes: **NO**.
- Production write changes: **NO**.
- Historical writes enabled: **NO**.
- Historical reads enabled: **NO**.
- History UI added: **NO**.
- Backfill performed: **NO**.
- Lifecycle behavior changed: **NO**.
- Alerts changed: **NO**.
- Awareness changed: **NO**.
- Markers changed: **NO**.
- Route Watch changed: **NO**.
- DriveTexas changed or activated: **NO**.

## 7. RLS Assumptions

Current app auth requirements for historical storage remain unapproved.

The draft enables RLS on the new historical tables and creates explicit deny-read policies for `anon` and `authenticated` roles. It intentionally creates no anonymous or authenticated insert/update/delete policies.

Future service-role or back-office write behavior requires separate approval before applying this migration or enabling historical writes.

## 8. Rollback Plan

The companion rollback draft drops only V371 historical objects:

- historical read-deny policies
- `incident_recurrence_index`
- `incident_events`
- `historical_incidents`

Rollback must not touch `reports` or any production table. Because V371 is additive and no app dependency is introduced, rollback should not require production data restoration.

## 9. Future Review Requirements

Before any future application of this migration, require review of:

- exact SQL migration contents
- exact rollback SQL contents
- table names and columns
- index coverage and cost
- RLS policies and auth assumptions
- service-role write path, if any
- no production read dependency
- no production write dependency
- no app integration dependency
- post-migration inspection plan

## 10. Explicit Non-Approvals

V371 does **NOT** approve:

- applying migration
- historical writes
- historical reads
- app integration
- history UI
- production read changes
- production write changes
- lifecycle changes
- DriveTexas activation

## 11. Testing

Required local checks:

```sh
git status --short
git diff --check
```
