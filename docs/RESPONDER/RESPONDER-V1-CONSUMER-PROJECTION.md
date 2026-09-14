# Responder / Agency V1 consumer projection

Contract version: `responder.agency.v1.phase0.1`. The only consumer source family is the constant `AGENCY_OFFICIAL`. A consumer reads a server-shaped projection, never agency base tables, drafts, members, verification evidence, or audit history. The badge means the **organization identity** is verified; “Agency update” does not mean Gridly independently confirmed the condition.

## Exact public field allowlist

The output object may contain **only** these keys; optional fields are omitted or null, never replaced with internal metadata:

```json
{"publicFields":["update_id","organization_public_name","approved_department_name","verified_agency","verified_agency_label","condition_type","impact_level","title","detail","location","road_name","cross_street","crossing_id","source_family","activated_at","updated_at","expires_at","display_lifecycle_state"]}
```

`verified_agency` must be `true` for any returned row; `verified_agency_label` is exactly “Verified Agency”; `source_family` is exactly `AGENCY_OFFICIAL`. `location` contains only approved public latitude/longitude derived from the one server-held point. `display_lifecycle_state` is `active` for rows returned in V1; edits are represented by `updated_at`, not an independent lifecycle status. Title/detail and road labels obey [command bounds](RESPONDER-V1-COMMAND-CONTRACT.md); `crossing_id` must resolve to a governed crossing before release.

## Explicit private-field denylist

These fields cannot appear in the consumer projection, nested fields, diagnostics, exports, errors, URLs, or accessible labels:

```json
{"privateFields":["auth_user_id","employee_name","employee_email","internal_role","primary_contact","invite_token","invite_token_digest","operation_id","operation_token_digest","audit_snapshots","reviewer_user_id","verification_evidence","authority_approval_metadata","private_notes","internal_reason","membership_status","authority_version_id","organization_internal_id"]}
```

Unknown keys fail projection construction. A private field does not become public because its value is empty or because it is hidden with CSS. The client never receives it.

## Exact eligibility predicate

Return a row only when **all** conditions hold at server read time: independent `agency_publishing_enabled=true`; organization verification=`verified` and operation=`active`; a current, effective, approved, non-revoked authority version covers the stored point; update stored status=`active`; `server_now < expires_at`; an append-only Supervisor/Admin activation event establishes `pending_review` → `active` at an earlier or equal revision; exactly one lifecycle event matches the current revision and authority; that current event is the activation event, `update_edited`, or `update_renewed`; `road_closed` activation evidence proves author Auth ID differs from approver Auth ID; no suspension/authority hold applies; organization operation epoch matches the update activation epoch; and every serialized field is allowlisted and valid. An active edit or renewal keeps its original activation evidence and writes only its own current-revision event; the one-event-per-revision invariant remains intact. Missing or inconsistent event lineage fails closed. Otherwise return **no public row**, not a degraded verified badge. Authorization is rechecked on each read or through an equivalently invalidated bounded cache; stale public caches may not extend beyond expiry, suspension, or authority revocation.

Public examples: “City of Dayton Public Works · Verified Agency · Road closed · Agency update · Updated 2:14 PM · Expires 8:00 PM.” This is wording illustration only, not approval to use that agency as the pilot. Consumer identity remains organizational; no employee attribution is displayed.
