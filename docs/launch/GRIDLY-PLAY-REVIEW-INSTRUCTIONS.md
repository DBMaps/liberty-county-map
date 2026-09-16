# Gridly Google Play Review Instructions

## Reviewer path

Gridly does not require an account. On launch, open **Settings → Support** to view the Privacy Policy, Terms of Use, and Community Guidelines. Open **Report** to inspect the reporting categories and the terms/guidelines links.

On the first attempt to submit a new community report, Gridly presents a plain-language safety and content summary plus links to all three legal documents. The reviewer must check the agreement box before **Accept and continue** becomes available. Dismissing the prompt creates no report and no pending operation. Changing the acceptance version requires reacceptance.

## UGC controls

On a live community report popup:

- **Report** opens bounded complaint reasons and submits to the private moderation queue.
- **Hide** immediately removes that report on the current device.
- **Delete mine** requests deletion only when the current device can verify it submitted that report.

There is intentionally no public stable source identifier or end-user “block source” token. Such a token would enable correlation/tracking. Repeated-source abuse is handled by a private moderator-only suppression using a one-way digest and bounded expiry.

## Pre-launch reporting state

The current owner-controlled admission state is disabled. This is intentional during compliance review. The app should state that reporting is paused/unavailable and must not queue a new operation as a generic connection failure. Legal documents and the reporting UI remain inspectable. Existing pending operations preserve their retry/cancel semantics for a later authorized reopening.

## Safety and permissions

Gridly is not an emergency, government, railroad, or navigation-safety authority. Community reports are unverified observations. The app tells users not to interact while driving and to follow official signs/instructions. Android requests Internet, network state, and foreground approximate/precise location only; no background location, advertising ID, storage, camera, microphone, notification, contact, or account permission is required by this flow.

## Owner submission checklist

- Publish owner-approved Privacy, Terms, and Guidelines at stable HTTPS URLs.
- Put the Privacy URL in Play Console and ensure Data safety answers match the released binary and production providers.
- Apply and certify the migration before enabling reporting.
- Name moderation/privacy owners and activate cleanup/monitoring.
- Upload a release built from the certified commit; do not use local debug artifacts.
- In review notes, disclose the intentional paused state if reporting remains disabled and provide a reviewer-accessible path or approved test environment if Google requires a live UGC demonstration.
