DRAFT — NOT LEGALLY APPROVED

Effective Date: [TO BE SET AT LEGAL APPROVAL]

# Gridly Privacy Policy

This draft describes the currently proven behavior of Gridly, operated by [GRIDLY LEGAL OPERATOR]. It is not legal approval. Questions may be directed to [GRIDLY PRIVACY CONTACT]; general support is available at [GRIDLY SUPPORT CONTACT]. No operational consumer privacy-request or deletion process is currently proven. The process, if adopted, will be: [PRIVACY REQUEST PROCESS].

## Information and uses

- **Precise foreground location.** Gridly may use precise location while the app is in the foreground for map centering, nearby context, reporting, routing, and Route Watch. Route Watch uses and updates foreground location while active; its monitoring stops when Route Watch stops. No background-location implementation is currently proven.
- **Community reports.** When you submit a report, its category, details, coordinates, time/lifecycle fields, and other report fields may be stored in Supabase for shared community-report functionality. Gridly creates a persistent pseudonymous device identifier, stores it on your device, and sends it with reports for association and duplicate suppression. Reporting is pseudonymous, not anonymous.
- **On-device data.** Preferences and settings, including saved places, home/work labels, map style, and alert preferences, may be stored locally on your device. Clearing app or site data may remove local data.
- **Service requests.** OSRM may receive route, origin/destination, or candidate coordinates for routing and road snapping. Nominatim may receive searches or coordinates for geocoding. Map/tile providers receive normal map requests, such as tile coordinates, IP address, and ordinary HTTP metadata. Other functional providers may receive the request parameters needed to return roadway, weather, ZIP, or crossing information.

## Current implementation boundaries

No consumer account or login is currently implemented, and no email collection is currently proven. No payment or subscription implementation currently exists. No analytics or advertising stack was found. No current user-specific data-sale implementation was found. These statements describe the governed current implementation and are not promises about future features; material future practices require updated disclosures.

## Retention and requests

Community reports can have an expiry time affecting visibility. Report expiry does not prove server deletion. Actual server/provider retention is unresolved: [SERVER DATA RETENTION POLICY]. Do not infer a retention period from this draft. Report removal is unresolved: [REPORT REMOVAL PROCESS]. Consumer privacy requests are unresolved: [PRIVACY REQUEST PROCESS].

Any future use of aggregated data remains unresolved: [FUTURE AGGREGATED DATA POLICY]. The minimum age is unresolved: [MINIMUM AGE].
