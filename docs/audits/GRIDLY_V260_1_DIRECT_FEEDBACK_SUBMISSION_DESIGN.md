# GRIDLY V260.1 — Direct Feedback Submission Design

Design only. Directional Intelligence remains paused and Trust Resolution remains draft-only.

No tables were created, no SQL was run, no Supabase production data was modified, no direct submission was implemented, and the current `mailto:` feedback workflow remains unchanged.

## Quick Summary

Gridly can safely move from the current **Prepare Feedback Email** flow toward future in-app **Submit Feedback** behavior by using a dedicated Supabase table, insert-only public write access, privacy-safe metadata, explicit success and failure states, and the existing email fallback.

The recommended implementation path is **Supabase direct feedback submission + preserved email fallback**, but V260.1 is design-only and should not be treated as implementation approval.

## Starting Point

The V260 direct feedback submission audit found:

```js
{
  feedbackFlowExists: true,
  currentDeliveryMethod: "email mailto fallback only",
  supabaseAvailable: true,
  directSubmissionAvailable: false,
  feedbackStorageDefined: false,
  feedbackAcknowledgementDefined: false,
  feedbackFailureHandlingDefined: false,
  emailFallbackAvailable: true,
  privacyReviewRequired: true,
  betaReady: false
}
```

## Design Goals

1. Keep Gridly's mission order intact: **Awareness Platform First**, **Route Intelligence Second**.
2. Design direct feedback submission without activating it yet.
3. Preserve the email fallback through beta.
4. Avoid accounts, analytics, moderation systems, precise tracking, and unnecessary personal data.
5. Create a minimal, auditable path that can be implemented after privacy review and schema approval.

## Recommended Supabase Schema

### Table Name

```text
gridly_feedback
```

### Recommended Fields

```sql
create table gridly_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  category text not null,
  message text not null,
  awareness_area text,
  platform text,
  gridly_version text,
  page_url text,
  user_agent text,
  status text default 'new'
);
```

### Field Purpose

| Field | Required | Purpose | Privacy Notes |
| --- | --- | --- | --- |
| `id` | Yes | Server-generated feedback identifier. | Does not identify a user by itself. |
| `created_at` | Yes | Server-generated receipt timestamp. | Use server time instead of client tracking. |
| `category` | Yes | User-selected feedback category. | Keep categories broad and non-sensitive. |
| `message` | Yes | User-entered feedback body. | Free-form text may contain voluntarily entered personal details. |
| `awareness_area` | No | Broad Gridly awareness context, if available. | Must not contain precise coordinates or saved-place details. |
| `platform` | No | Coarse client platform label. | Prefer broad labels such as `mobile`, `desktop`, or `tablet`. |
| `gridly_version` | No | App/version label for triage. | Product metadata only. |
| `page_url` | No | Current Gridly page URL for debugging. | Strip query strings and fragments unless explicitly approved. |
| `user_agent` | No | Browser user agent for debugging beta issues. | Optional; review before enabling because it can be identifying in combination with other data. |
| `status` | No | Internal triage state, defaulting to `new`. | Should not be user-controlled after insert. |

## Insert-Only Policy Recommendation

For beta, feedback submission should be anonymous insert-only.

Recommended policy model:

- Anonymous users may insert feedback.
- Anonymous users may not select feedback.
- Anonymous users may not update feedback.
- Anonymous users may not delete feedback.
- Reading, triage, export, and status updates should happen only through approved admin/service-role workflows outside the public client.

### Suggested SQL — Do Not Run During V260.1

```sql
-- Design reference only. Do not run as part of V260.1.

alter table gridly_feedback enable row level security;

create policy "Allow anonymous feedback inserts"
  on gridly_feedback
  for insert
  to anon
  with check (
    category is not null
    and length(trim(category)) > 0
    and message is not null
    and length(trim(message)) > 0
  );

-- No public select policy.
-- No public update policy.
-- No public delete policy.
```

Optional hardening before implementation:

```sql
-- Design reference only. Do not run as part of V260.1.

alter table gridly_feedback
  alter column status set default 'new';

alter table gridly_feedback
  add constraint gridly_feedback_category_length
  check (char_length(category) <= 80);

alter table gridly_feedback
  add constraint gridly_feedback_message_length
  check (char_length(message) <= 4000);

alter table gridly_feedback
  add constraint gridly_feedback_status_allowed
  check (status in ('new', 'reviewing', 'closed'));
```

## Privacy Boundaries

Direct feedback submission must collect only the minimum information needed to triage beta feedback.

### Allowed Metadata

- Feedback category selected by the user.
- Feedback message entered by the user.
- Broad awareness area label, if already available and non-precise.
- Coarse platform label such as `mobile`, `desktop`, or `tablet`.
- Gridly version string.
- Page URL only after removing query parameters and fragments unless approved.
- User agent only if privacy review accepts the risk and the app explains why it is collected.

### Do Not Collect

Do not add any of the following to the feedback payload or metadata:

- Precise GPS coordinates.
- Home address.
- Work address.
- Saved-place coordinates.
- User account ID.
- Phone number.
- Email address unless the user manually types it into the message.
- Analytics identifiers.
- Device fingerprint IDs.
- Background location history.
- Route Watch state snapshots.
- Destination Search query history.
- Saved Places payloads.

### Free-Form Message Handling

The message field is user-controlled free text. Gridly should not parse it for identities, locations, or contact details during beta submission. If users voluntarily type an email address, phone number, address, or other personal detail into the message, Gridly should store only the message as submitted and avoid extracting that data into separate columns.

## Recommended User Experience

### Current Beta Flow

```text
Prepare Feedback Email
```

The current email flow remains valid and should stay available.

### Future Direct Submission Flow

```text
Submit Feedback
```

Recommended minimum UI states:

1. Idle state with category and message fields.
2. Submitting state that prevents duplicate clicks.
3. Success state with acknowledgement copy.
4. Failure state with retry and email fallback.

### Success Acknowledgement Copy

```text
Feedback received.
Thank you for helping improve Gridly.
```

### Failure Copy

```text
Unable to submit feedback right now.
You can try again or prepare a feedback email instead.
```

### Fallback Button Copy

```text
Prepare Feedback Email Instead
```

### Email Fallback Behavior

If direct submission fails, Gridly should keep the user's selected category and message intact, then offer the email fallback. The fallback should prepare the same feedback content in the existing email client handoff without removing or replacing the direct submission path.

Recommended fallback rules:

- Preserve the existing `mailto:` behavior.
- Do not clear the feedback form after direct submission failure.
- Offer retry before or alongside email fallback.
- Do not silently send email; users must still choose to send from their email app.
- Keep fallback available even after direct submission launches, at least through beta.

## Recommended Future Audit

Future implementation should expose:

```js
window.gridlyDirectFeedbackReadinessAudit?.()
```

Expected return shape:

```js
{
  available: true,
  version: "V260.1",
  feedbackTableName: "gridly_feedback",
  directSubmissionDesigned: true,
  directSubmissionImplemented: false,
  emailFallbackPreserved: true,
  privacySafeMetadataOnly: true,
  insertPolicyRecommended: true,
  successCopyDefined: true,
  failureCopyDefined: true,
  betaReadyForImplementation: false,
  findings: []
}
```

### Audit Fields for Future Implementation

| Field | Expected V260.1 Design Value | Purpose |
| --- | --- | --- |
| `available` | `true` | Confirms the audit helper exists once implemented. |
| `version` | `"V260.1"` | Confirms the design version being checked. |
| `feedbackTableName` | `"gridly_feedback"` | Confirms the approved table target. |
| `directSubmissionDesigned` | `true` | Confirms this design has been documented. |
| `directSubmissionImplemented` | `false` | Must remain false until a later implementation pass. |
| `emailFallbackPreserved` | `true` | Confirms the current fallback remains available. |
| `privacySafeMetadataOnly` | `true` | Confirms no precise or unnecessary personal metadata is included. |
| `insertPolicyRecommended` | `true` | Confirms insert-only public policy guidance exists. |
| `successCopyDefined` | `true` | Confirms acknowledgement copy is approved. |
| `failureCopyDefined` | `true` | Confirms failure copy is approved. |
| `betaReadyForImplementation` | `false` initially, `true` only after review | Gates implementation readiness. |
| `findings` | `[]` when clean | Lists blockers or mismatches. |

## Beta Readiness Criteria

Direct feedback submission is beta-ready for implementation only when all of the following are true:

1. The `gridly_feedback` schema is approved.
2. Privacy review approves the metadata boundaries.
3. Insert-only anonymous policy is approved.
4. Public select/update/delete remain unavailable.
5. Success acknowledgement copy is approved.
6. Failure copy is approved.
7. Email fallback behavior is preserved and tested.
8. The implementation plan confirms no protected systems are modified.
9. Future audit helper expectations are approved.
10. Rollback plan keeps the current email fallback available.

Until those criteria are met, `betaReadyForImplementation` should remain `false`.

## Protected Systems

V260.1 design does not modify and should not require changes to:

- Awareness ownership.
- Route ownership.
- Destination Search.
- Route Watch.
- Saved Places.
- Current Location readiness.
- Viewport ownership.
- Supabase production data.
- Hazard lifecycle.
- Alert lifecycle.
- Crossing lifecycle.
- Trust Resolution draft.
- Directional pause.

## Merge Recommendation

Merge the V260.1 design document as a safe planning artifact. Do not implement direct submission, create Supabase tables, run SQL, or change the current feedback workflow in this version.

## Exact Review Steps

1. Confirm this document exists at `docs/audits/GRIDLY_V260_1_DIRECT_FEEDBACK_SUBMISSION_DESIGN.md`.
2. Confirm no application files were changed for direct submission.
3. Confirm the recommended table name is `gridly_feedback`.
4. Confirm the recommended public policy is insert-only for anonymous users.
5. Confirm the privacy boundaries exclude precise GPS coordinates, home/work addresses, saved-place coordinates, account IDs, phone numbers, and extracted email addresses.
6. Confirm success copy exactly matches: `Feedback received. Thank you for helping improve Gridly.`
7. Confirm failure copy exactly matches: `Unable to submit feedback right now. You can try again or prepare a feedback email instead.`
8. Confirm fallback button copy exactly matches: `Prepare Feedback Email Instead`.
9. Confirm the future audit helper is named `window.gridlyDirectFeedbackReadinessAudit?.()`.
10. Confirm `directSubmissionImplemented` remains designed as `false` for V260.1.
