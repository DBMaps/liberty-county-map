# Gridly Privacy Policy

> PROPOSED FOR OWNER REVIEW — NOT APPROVED OR PUBLISHED. The effective date below is the owner-selected proposed date; it does not make this draft operative.

> PUBLICATION BLOCKED: The launch commitments below require a tested 180-day report de-linking control and a working privacy-request procedure. A local implementation has been prepared and tested, but it has not been deployed or verified across production backups, logs, exports, and legacy offline copies. These commitments describe the proposed launch policy, not completed processing today. Other retention periods remain subject to owner approval in the review report.

**Effective date:** September 8, 2026

## 1. Operator and scope

Gridly is operated by DJ Burns Collective LLC, doing business as Gridly App ("Gridly," "we," "us"). Our domain is gridlygo.com. This policy covers information handled through the Gridly application and communications with us. Gridly 1.0 will initially be offered in the United States, with travel and community-condition coverage focused on Texas. Coverage varies by location and source; United States availability does not mean nationwide condition coverage.

The current application does not provide consumer account registration or a payment or subscription checkout. Local profiles and preferences are not consumer accounts. External websites, operating systems, email services, and app stores also handle information under their own policies.

## 2. Information handled by Gridly

- **Location and searches:** Device coordinates when you allow and use location features; selected areas and ZIP codes; addresses, place names, search text, map areas, and route origins and destinations used to provide requested results.
- **Community reports:** Report category, details, severity, road or crossing identifiers and names, event coordinates, geographic context, timestamps, source and confidence information, confirmations, and clearing or resolution information. Reports carry a persistent, app-generated device identifier. Reporting is pseudonymous, not anonymous or linked to a registered consumer account.
- **Submission integrity:** Each original report and each confirmation, edit, or clearing operation uses a separately generated random identifier. The server retains its SHA-256 digest and first-accepted time to prevent an old request from creating another report or device association. While the report remains, a private receipt connects it to the consumed digest and preserves its original submission time; that receipt is removed with the report. The surviving replay evidence contains no device identifier or device-derived key and is not described as anonymous. It remains while derived historical information is retained and while the corresponding protocol still accepts requests; removing a report alone does not remove this evidence.
- **Saved information and preferences:** Home and work labels, saved-place names, addresses and coordinates, area preferences, app settings, and locally retained condition history and route-related information.
- **Feedback and correspondence:** Submitted messages and categories, selected awareness area and county context, platform label, app version/build, and page origin/path. Email also provides your sender address, message, attachments you choose to send, and associated email metadata.
- **Technical information:** Requests to our infrastructure and external services can expose an IP address, request time, requested resource, and browser/application or device information. The app also uses local diagnostic and performance information. The absence of a separate advertising or analytics SDK does not mean these requests collect no information.

Do not put another person's private information, sensitive personal details, or information unrelated to a condition into a community report.

## 3. Location information

Location permission is used for features such as map centering, nearby context, report placement, route-origin selection, and Route Watch. The app can request precise, high-accuracy location. While Route Watch is active, it requests repeated foreground position updates; stopping Route Watch stops that location watcher. The current app does not implement a background-location tracking service.

Current position is held in app memory for these functions. This does not mean all location information is temporary: a submitted event location is sent with its report, saved places can retain coordinates on the device, route requests send origin and destination coordinates, and geocoding can send addresses or coordinates to external services. Provider requests and caches may retain location-related information separately from the live position in memory.

You can decline or revoke location permission through browser or device settings. Available manual area or destination controls can be used without granting device location; features that need current position may be limited. Revoking permission does not erase information already submitted or retained elsewhere.

## 4. Purposes and disclosures

We use information to provide maps, searches, route and condition awareness, publish and update community reports, preserve preferences, associate reports and confirmations, limit duplicate or abusive submissions, troubleshoot the app, and respond to support and privacy correspondence.

Community report content and event locations are shared with other users. A report identifier is not a confidentiality safeguard: reports can contain identifying information, and stored report records include device linkage. Do not treat a community submission as a private message to Gridly.

Service providers process information needed to deliver these functions. We may disclose information when required by law or reasonably necessary to address fraud, abuse, security incidents, or threats to people's rights or safety. These purposes do not authorize unrestricted use of personal information.

One pending reporting operation is stored on the device so interrupted submissions can retry with the same identifier. A terminal server response removes the pending payload. After 24 hours, the next access discards the payload and retains only the operation identifier and initial pending time until the server acknowledges cancellation or prior processing. An inactive or disconnected installation cannot be remotely guaranteed to perform that local cleanup on schedule. The pending record does not store the persistent device identifier.

Under this launch policy, Gridly will not sell personal information or use or share it for targeted advertising. The current app has no advertising placement or targeted-advertising feature. No new commercial sale of condition information is authorized by this policy. Operational sharing with infrastructure and data providers still occurs as described here. No current report dataset is represented here as already anonymous or technically deidentified.

## 5. Infrastructure and external sources

- **Supabase:** Receives community report records and direct feedback submissions and supports shared updates and data delivery. Destination searches can also pass through a Supabase-hosted geocoding service. That service processes search text, structured addresses, geographic context, and request identifiers, and can cache returned addresses and coordinates.
- **Maps, routing, and geocoding:** Depending on the feature and configured source, requests use OpenStreetMap services, Esri/ArcGIS imagery or labels, OSRM routing, and geocoding services. Routing requests include route endpoints; reverse geocoding includes coordinates; map requests identify the viewed tiles or area. Some place searches use packaged data locally; others contact external services. Configured address fallbacks may use Google geocoding or the U.S. Census Bureau. A listed fallback is not a promise that it is enabled for every request.
- **Weather, roadway, and area data:** National Weather Service requests use the selected area's weather point and related forecast or alert resources. DriveTexas requests retrieve roadway conditions; the app filters those results for local relevance. ZIP lookups may send the entered ZIP to Zippopotam.us. Other map/data and content-delivery requests disclose the resource requested and connection information to the receiving service.
- **Email:** Email sent to our published contacts is routed through Cloudflare Email Routing to an owner-managed Gmail inbox. The app's existing email-feedback fallback also sends to an owner-managed Gmail inbox. Your email service, Cloudflare where used, and Google process message content and email metadata to deliver and store correspondence.

External services may keep their own request logs and process information under their applicable policies. Device platforms and app stores can separately collect installation, device, or diagnostic information. This policy does not represent that those services collect nothing or retain information for a particular period.

## 6. Local storage, retention, and deletion

Gridly uses device storage and caches for its persistent device identifier, preferences, saved places, condition history, and other app state. These may remain between sessions. You can manage saved information through available app controls and clear app/site data through your browser or device. Clearing local data may reset your identifier and preferences; it does not delete backend reports, provider records, or email.

Under this launch policy, a community report will remain linked to its app-generated device identifier for no longer than 180 days from its original submission. Gridly will remove that linkage and other reporter-identifying information no later than that deadline. Updating, confirming, clearing, copying, exporting, or restoring a report will not restart its linkage period. A valid deletion request or other applicable requirement may require earlier action.

After that period, Gridly may retain the underlying condition/event information only after removing device linkage and other reporter-identifying information governed by this policy. The permitted purposes are historical condition intelligence, safety analysis, source-quality evaluation, and product improvement—not permanent reporter tracking. Information that cannot be retained without the prohibited reporter linkage will be deleted rather than kept beyond the limit.

Removing device linkage alone does not prove anonymity or technical deidentification. Gridly will not describe de-linked information as anonymous unless the implementation demonstrates that it cannot reasonably be relinked. Condition locations, times, text, identifiers, and combinations of records must be considered in that assessment. This policy does not authorize a new commercial sale or targeted-advertising use.

Report expiration, clearing, or disappearance from the current map is not itself deletion from databases, condition history, caches, exports, or backups. Copies controlled by Gridly must respect the same linkage deadline; restoration must not reintroduce expired linkage. Clearing local data does not recall copies independently retained by other users or external providers. Such copies are not represented as remotely erasable by Gridly.

The owner-review report separately proposes schedules for report content, feedback, correspondence, request records, logs, local information, and backups. Those additional periods are not yet operative and must be resolved before this draft is published. Provider-controlled records are subject to provider practices and applicable obligations; Gridly will not promise a provider deletion period without evidence. Cache freshness or expiry alone does not establish permanent deletion.

## 7. Choices and privacy requests

You can choose whether to submit reports, send feedback, save places, or grant location access. Contact **privacy@gridlygo.com** to ask about access, correction, deletion, or other privacy concerns. Describe the request and enough context to locate relevant records, such as approximate report time and place. Do not initially send passwords, government identification, or unrelated sensitive documents.

Gridly has no consumer account portal or self-service backend deletion tool. For launch, requests received at privacy@gridlygo.com will be logged, acknowledged, and reviewed by the operator. We may ask for information reasonably necessary to verify your authority and locate the relevant records, without disclosing another person's information. You will not be required to create a new account. Knowing a publicly visible report's time or place alone is not proof of ownership. Clearing a device identifier before a request may make association more difficult.

We will review access, correction, and deletion requests, explain the action taken or any lawful reason we cannot fulfill them, and provide instructions for an appeal. Requests to stop consent-based processing or delete associated information may be sent to the same address. You can also revoke device-location permission as described above. Revocation stops the permission-dependent collection; it does not automatically erase prior submissions. A lack of an automated deletion tool does not excuse applicable duties or deadlines.

Depending on your residence and which laws apply to the processing, you may have rights to access or obtain a copy of personal information, correct it, request deletion, or opt out of certain uses. Applicable Texas rights can also include an appeal of a refusal and protection against discrimination for exercising rights. To request review of a response, email privacy@gridlygo.com and identify the response you are appealing. Applicable legal rights, response deadlines, and complaint rights are not limited by this policy or by the absence of a self-service tool. You may contact your state's privacy regulator, including the Texas Attorney General. Not every right applies to every record or circumstance.

## 8. Security

The app uses HTTPS for its configured remote data requests. No network transmission or storage system is completely secure. Do not submit secrets or sensitive information unnecessary for a report or support request. Report suspected unauthorized access or disclosure to privacy@gridlygo.com. This policy is not a security certification or guarantee against loss or unauthorized access.

## 9. Children and minors

Gridly is a general-audience service for users age 16 and older and is not directed to children under 16. People under 16 must not use Gridly or submit personal information through it. The current app does not verify age or provide a parental-consent system. If you believe a child under 16 has supplied personal information, contact privacy@gridlygo.com so the matter can be reviewed and appropriate action taken. An age statement does not remove protections that apply to children's information.

## 10. Changes and contact

Changes to this policy will identify an updated effective date. Material changes will receive notice and any consent required by applicable law before the affected new processing. Updating this document alone does not supply consent to a materially different use of personal information.

Operator: **DJ Burns Collective LLC, doing business as Gridly App**

Product: **Gridly**

Domain: **gridlygo.com**

Privacy: **privacy@gridlygo.com**

Support: **support@gridlygo.com**

Legal: **legal@gridlygo.com**
