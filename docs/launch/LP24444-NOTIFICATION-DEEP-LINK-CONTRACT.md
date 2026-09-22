# LP244.44 — Native notification target contract

Contract `LP24444.v1`. Targets are internal typed data, not executable URLs. [Backend](LP24444-NOTIFICATION-BACKEND-CONTRACT.md) creates a per-installation projection; [context resolver](LP24444-AWARENESS-CONTEXT-CONTRACT.md) alone changes visible context. No native listener/configuration is added now.

## LINK-01 — Versioned discriminated union

Target envelope: `{v:1,type,deliveryId,eventId,materialRevision,issuedAt,expiresAt,context,ref}`. All keys required; eventId/materialRevision may both be null only for a context-only target. deliveryId is UUID; eventId/watchId/reportId below must match the documented source identifier grammar, with opaque strings <=128 characters; server event/delivery/watch IDs are UUIDs. Revision is positive integer. Times are UTC ISO-8601 and must form a valid positive interval. context is `{kind,placeId,countyMemberships,watchId}` with nulls where inapplicable; countyMemberships contains at most the 254 distinct governed Texas counties. In practice the whole UTF-8 target must fit <=1,024 bytes, strings <=128 Unicode characters, so oversized lists are rejected, not truncated. Backend stores full matched contexts, payload carries only selected display context.

Context kind is HOME, ROUTE_WATCH, AROUND_ME or DESTINATION (WHY), independent of target type (WHERE TO OPEN). HOME/ROUTE_WATCH are the only launch server subscription kinds. AROUND_ME target is reserved for a foreground local notification/in-app action and cannot imply a server near-me subscription. DESTINATION can describe a destination detail selection without creating its reserved watch. Validate compatibility between kind, watch ownership and target; refuse impossible combinations.

| type | Exact ref fields | Resolution and visible context |
|---|---|---|
| PLACE_CONTEXT | `{placeId}` | Resolve governed place and memberships; temporary SEARCH inspection even for Home-origin alert, with “Alert for Home” provenance; Home storage untouched |
| TRAVEL_BRIEF | `{placeId,watchId}` exactly one non-null | Fresh PLACE brief as SEARCH, or owned live trip as ROUTE_WATCH |
| REPORT | `{reportId}` | Fetch public current/moderated report through existing governed read contract; event linkage must agree; point/locality SEARCH detail |
| WEATHER_ALERT | `{sourceAlertId}` | Fetch canonical public normalized event and current official references; show source geometry/time; SEARCH area or owned route context if still valid |
| ROAD_CONDITION | `{sourceRoadId}` | Fetch current normalized roadway record with full geometry, source and advisory; SEARCH or still-owned route |
| ROUTE_WATCH | `{watchId}` | Owner-authenticated current watch; server-supplied geometry, current generation; never trust private route state from payload |
| AROUND_ME | `{areaRef}` | Resolve the ephemeral local action's in-memory snapshot; open SEARCH labeled “Area of this alert”, never claim old coordinates are current; missing snapshot yields unavailable target |

placeId/source IDs are validated against their source namespace and fixed resolver, not interpreted as paths. Report IDs use the existing report ID grammar rather than requiring an invented UUID migration. `areaRef` is a random ephemeral local reference, not lat/lng or a server history row. Context-only payloads must use PLACE_CONTEXT/TRAVEL_BRIEF/ROUTE_WATCH/AROUND_ME; report/weather/road require event identity and revision. Canonical current event read must prove source ref belongs to eventId; no arbitrary cross-event detail target. Extra unknown fields, unknown version, wrong scalar types, oversized bytes/depth, dangerous object keys or invalid IDs fail closed. No URL, HTML, JavaScript, file path or navigation intent field is permitted.

## LINK-02 — Cold/warm handling and concurrency

Register one native action listener before starting source hydration. Native action queues at most one pending target in memory until app shell, context resolver and protected credential store are ready. A cold-start action buffer may contain only validated bounded target data, no coordinates/credentials, and must be consumed once then erased; never a tap/location history. If the OS native launch callback must bridge across WebView startup, its native memory buffer is sufficient; process loss simply requires a new explicit tap.

Validate envelope locally first, then authenticate private target reads and fetch current public event/watch state. Show “Opening alert…” without briefly rendering unrelated Home weather as the target. Bootstrap Home restoration waits for pending tap handling; it does not race to overwrite a successful target. Use the same generation guard as Search. Warm tap is an explicit navigation action, preserves one previous context for Back, and does not stop a route watch or mutate Home. Duplicate callback deliveryId in that process is consumed once; a deliberate later tap may reopen the same current detail without causing another alert. No acknowledgment mutates source lifecycle or automatically creates/resumes a subscription.

Resolver has a 10-second network deadline and bounded user Retry, no indefinite splash. On success, publish one context generation and detail target. On expired/stopped route, don't restore stale geometry or resume watch; explain expiry with explicit Search/Return Home actions. Notification content is a historical message; detail always labels current state. Fetching live detail requires network and permissions; a tap alone does not request fresh GPS or grant consent. Numeric progress may appear only after a separately authorized fresh foreground fix.

## LINK-03 — Failure matrix

| Situation | Required behavior |
|---|---|
| Cold start, valid target | Listener queues, validate, hydrate ownership/source, publish intended context; no Home flicker/overwrite |
| Warm start in Search or active trip | New temporary detail; Back restores prior valid context; independent watch stays active |
| Event expires/resolves after delivery | “This alert has ended” with verified current status/time; no active hazard marker from payload |
| Deleted/moderated/withdrawn event | “This update is no longer available”; no reconstruction from lock-screen text or hidden cache |
| Wrong owner / missing credential | Generic unavailable trip; never reveal route endpoints; offer explicit new trip/Home selection |
| Offline / service unavailable | “Cannot refresh this alert”; cached safe title may be dated, never current; Retry, Search, Return Home are explicit choices |
| Unknown target version/type | “This alert needs a newer app or is unavailable”; no URL execution; stable app shell/actions |
| Invalid payload or inconsistent event/source | Reject, bounded diagnostic reason only; neutral unavailable screen |
| Around Me local snapshot expired | Area unavailable; user can explicitly choose Around Me to request a new fix; no old-current claim |
| Server timeout | End loading at deadline, retain error provenance, manual Retry; do not replace with Home silently |

Foreground native receipt updates in-app alert state but does not force navigation. Only a tap/action changes visible context. Ordinary Home bootstrap is allowed when there is no notification action; a failed action keeps its unavailable explanation until user chooses a destination.

## LINK-04 — Domain decision and acceptance

Native push tap callbacks can carry this internal envelope without Android App Links/iOS Universal Links or a new public domain association. Launch does not require changes to gridlygo.com, assetlinks.json or apple-app-site-association. Shareable external links are a separate optional future project requiring domain ownership/association, allowlisting and the same target validation. No broad custom-scheme URL router is introduced as a back door.

LP244.49 must test all seven union variants and each failure row, cold/warm/background paths, duplicate native callbacks, very long IDs, unknown version, malicious URL fields, mismatched owner/source, revoked credential, offline pending stop and Home byte preservation. Real device taps on Android and iPhone are mandatory; unit fixtures prove parser behavior but not OS launch restoration.
