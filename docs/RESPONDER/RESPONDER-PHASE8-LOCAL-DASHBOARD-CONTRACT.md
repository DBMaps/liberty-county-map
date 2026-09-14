# Responder Phase 8: disposable local dashboard read contract

Phase 8 is a PostgreSQL 17.10/PostGIS 3.6.2 contract fixture. It adds no production migration, Supabase integration, Auth mapping, live dashboard, publishing, consumer deployment, email delivery, or Cron. The frozen Phase 0 role/action/state contracts and the Phase 1–7 local SQL remain authoritative. The agency publishing gate remains false.

## Entry and organization context

The desktop-first dashboard has a left queue/filters, center map, and right selected-update inspector. `phase8_dashboard_entry()` returns exactly one bounded `accepted` or `forbidden` result, with organization ID and role only on acceptance. It relies on the Phase 4 server-bound synthetic PostgreSQL login, active aal2 session, current active membership, and verified active organization. VIEWER, RESPONDER, SUPERVISOR, and AGENCY_ADMIN may enter their own organization. GRIDLY_ADMIN has a separate governance context and no agency-dashboard membership. Unknown, aal1, inactive, suspended, revoked, and wrong-organization identities receive no agency data.

The existing `responder_organization_context` invoker view supplies only organization ID, canonical key, public name/type, verification state, and operation state. The private verification evidence, contacts, reasons, receipts, and program-control row are not projected. Gate availability is intentionally not in the read model: candidate action buttons cannot promise that a gate-dependent command will succeed.

## Membership, authority, and invites

`responder_membership_roster` remains the Phase 4 invoker projection of membership ID, organization ID, user ID, role, status, and joined time. VIEWER and RESPONDER see self only; SUPERVISOR and AGENCY_ADMIN see the own-org bounded roster. No email or unrelated organization's roster is available. A RESPONDER's active own membership read and a VIEWER's own-org dashboard entry execute frozen P20 and P01, respectively, without a business event.

`responder_current_authority` supplies current effective, approved county FIPS, authority version, status, and effective dates. Historical/revoked authority and geometry/source provenance remain private. County FIPS is the dashboard's jurisdiction label in this local model; no county outline or private geometry is sent to the map. `responder_invite_summary` is own-org AGENCY_ADMIN only and contains bounded invitation metadata. It excludes raw token and digest. Lower roles receive no rows.

## Queue, map, inspector, and filters

`phase8_dashboard_records` is one `security_invoker=true` operational projection of the Phase 4 RLS-scoped agency update row and the existing current-authority view. It converts the point to longitude/latitude and omits raw geometry, reviewer/author identity, audit metadata, operation tokens, receipts, and governance evidence. It emits `AGENCY_OFFICIAL` as a fixed source family. The queue, map, inspector, and candidate-affordance views all derive from that same record and carry the same `update_id`, stored status, derived display status, and revision where relevant.

The left `phase8_dashboard_queue` supplies ID, organization, condition/impact, lifecycle, title/location label, current county FIPS, revision, timestamps, author-self boolean, and source family. The center `phase8_dashboard_map` supplies only matching ID, condition, lifecycle, title/label, safe point coordinates, county, revision, and source family. The right `phase8_dashboard_inspector` supplies bounded operational detail, current jurisdiction version, lifecycle timestamps, point, and revision for a selected ID. Map selection resolves an inspector row by canonical ID. A view never broadens the Phase 4 role policy: VIEWER sees active/terminal rows, RESPONDER additionally sees own draft/pending rows, and SUPERVISOR/AGENCY_ADMIN see own-org review rows. No other organization's row can appear on one surface alone.

Stored lifecycle states remain `draft`, `pending_review`, `active`, `resolved`, and `withdrawn`. `expired` is derived when `expires_at <= now()` and writes no event. The three surfaces use the same rule; reads in one database transaction share its `now()` timestamp. The client must refresh all three surfaces after an expiry boundary rather than retain stale display data. Bounded V1 filters are lifecycle/display status, condition type, current county FIPS, `is_author`, and pending-review status. They operate on the scoped queue and cannot widen RLS. No search engine or new permissions are implied.

`phase8_dashboard_affordances` computes role/state candidate flags for edit draft, submit, return, both activation types, active edit, renew, resolve, and withdraw. It suppresses self-approval of `road_closed`, active mutations on derived-expired rows, and actions on terminal rows. It is only a UI hint: the Phase 7 command still independently verifies the live actor, organization, gate, county authority, point, revision, rate limit, and second actor. A gate-off activation candidate therefore receives `maintenance` from the backend. Direct SQL writes remain denied.

## Bounded N26 denial and privacy

`phase8_agency_governance_denial(jsonb)` is a narrow, invoker-rights, immutable agency-facing denial endpoint. It returns only `{"status":"forbidden"}` for a governance attempt and reads or writes no table. It neither calls nor grants EXECUTE on `phase6_governance_command`; ordinary agency roles still receive PostgreSQL permission denial if they try that private function directly. The bounded endpoint is the local dispatcher response for frozen N26. Tests exercise all four agency roles and prove no governance state, event, or receipt changes. The GRIDLY_ADMIN governance path remains separate and functional.

Dashboard readers cannot query raw verification/governance/update events, receipts, program controls, session bindings, or local Auth identities. The Phase 4 invoker views, underlying column grants, and live RLS policies remain in force. Phase 8 grants only bounded operational update columns needed to derive safe point/label/detail fields; it adds no table write policy or privilege. Cross-org and private-field denial are exercised as synthetic login roles, not as the fixture owner.

## Performance and fixture safety

The local suite runs queue, map, inspector, roster, and invite `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` reads. Existing organization/status/expiry, membership, invite, authority, and primary-key indexes cover their scoped predicates. Tiny fixture tables may reasonably use sequential scans; no new index is justified by this bounded fixture. The suite applies Phases 1–8 to a uniquely named disposable localhost database, loads the certified 254-county catalog, uses synthetic login roles, verifies PostgreSQL/PostGIS versions and the local data directory, drops its database and roles, and leaves `agency_publishing_enabled=false`. The runner stops the cluster and removes only a checked Temp directory. No remote database or production role is used.

The Phase 8 vector map records 51 previously complete vectors plus P01, P20, and N26 newly complete, for 54/54 frozen vectors. This is local contract certification only. Production Auth, dashboard implementation/deployment, source runtime authorization, publishing, and owner release review remain separate work.
