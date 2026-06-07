# GRIDLY V260 — Direct Feedback Submission Audit

Audit only. Directional Intelligence remains paused and Trust Resolution remains draft-only.

## Quick Summary

Gridly should support direct feedback submission for beta, but not as a Supabase-only path. The recommended beta architecture is **Supabase + email fallback** after a dedicated feedback table, insert policy, privacy review, acknowledgement state, and failure state are approved.

No tables were created, no Supabase data was modified, and no direct submission was implemented.

## Files Reviewed

- `index.html` — legacy Settings feedback markup.
- `js/app.js` — Settings binding, feedback mailto generation, Supabase client setup, and report Supabase usage.
- `css/styles.css` — existing feedback form presentation classes.

## Audit Result

Use:

```js
window.gridlyFeedbackSubmissionAudit?.()
```

Expected audit shape:

```js
{
  available: true,
  version: "V260",
  feedbackFlowExists: true,
  currentDeliveryMethod: "Email mailto fallback only (dburns.mgmt@gmail.com); the user must leave Gridly and send from an email app.",
  supabaseAvailable: true,
  feedbackStorageDefined: false,
  feedbackAcknowledgementDefined: false,
  feedbackFailureHandlingDefined: false,
  emailFallbackAvailable: true,
  privacyReviewRequired: true,
  betaReady: false,
  findings: []
}
```

### Audit Questions

1. **Current workflow** — Settings → Send Feedback → Category → Message → Prepare Feedback Email → user sends from their email app.
2. **Direct submission today** — No. The current app prepares a `mailto:` link and does not submit feedback to a backend.
3. **Supabase availability and suitability** — Supabase is configured and already used by Gridly for shared reports, so it is suitable for lightweight beta feedback storage once a dedicated table and policies are approved.
4. **Existing feedback table** — No feedback table or feedback insert path is defined in the app code. This audit did not query or modify production Supabase data.
5. **Recommended fields** — `category`, `message`, `timestamp`, `awarenessArea`, `platform`, and `gridlyVersion`.
6. **Acknowledgement** — Success should say: “Feedback received. Thank you for helping improve Gridly.”
7. **Failure experience** — Failure should say: “Unable to submit feedback right now. Try again later.” and offer “Prepare Feedback Email Instead.”
8. **Email fallback** — Yes. Email should remain as a fallback through beta.
9. **Privacy review** — Required because free-form feedback and optional metadata may include location, awareness area, platform/device, timestamps, and personal details.
10. **Beta appropriateness** — Direct submission is appropriate for beta only after storage, acknowledgement, failure handling, privacy copy, and fallback behavior are approved.

## Recommended Feedback Architecture

### Option A — Supabase only

- **Pros**
  - Fast in-app submission.
  - Centralized beta intake.
  - No email app handoff.
- **Cons**
  - Requires a feedback table and insert policy.
  - Requires privacy review.
  - No fallback during Supabase/network failures.
- **Complexity** — Medium.
- **Beta readiness value** — Medium.

### Option B — Email only (current)

- **Pros**
  - Already works.
  - No database changes.
  - Lowest implementation risk.
- **Cons**
  - User must leave Gridly.
  - User must still choose Send in the email app.
  - Less beta-friendly.
- **Complexity** — Low.
- **Beta readiness value** — Low.

### Option C — Supabase + email fallback

- **Pros**
  - Best beta tester experience.
  - Keeps the existing working backup path.
  - Allows graceful failure handling.
- **Cons**
  - Requires a small schema, insert policy, and fallback UX.
  - Requires privacy copy review.
- **Complexity** — Medium.
- **Beta readiness value** — High.

**Recommendation:** Option C.

## Recommended Data Model

Minimal beta-ready model:

```js
{
  category: "",
  message: "",
  timestamp: "",
  awarenessArea: "",
  platform: "",
  gridlyVersion: ""
}
```

Avoid accounts, moderation systems, analytics, and extra tracking for the beta feedback path.

## Recommended User Experience

```text
Feedback

Category
Message

[ Submit Feedback ]
```

Success:

```text
Feedback received.
Thank you for helping improve Gridly.
```

Failure:

```text
Unable to submit feedback right now.
Try again later.

[ Prepare Feedback Email Instead ]
```

## Merge Recommendation

Merge the V260 audit-only helper and documentation. Do not implement direct submission until the feedback table, acknowledgement copy, failure copy, privacy review, and email fallback behavior are approved.

## Exact Testing Steps

1. Run `node --check js/app.js`.
2. Open Gridly in a browser.
3. Open the developer console.
4. Run `window.gridlyFeedbackSubmissionAudit?.()`.
5. Confirm `available: true`, `version: "V260"`, `feedbackFlowExists: true`, `currentDeliveryMethod` describes email mailto, `emailFallbackAvailable: true`, `feedbackStorageDefined: false`, `privacyReviewRequired: true`, and `betaReady: false`.
