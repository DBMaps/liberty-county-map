# LP214 canonical PLACE focus runtime bridge

## Production finding and repair

Production previously projected canonical multi-county PLACE identity but passed optional `selectedArea.lat/lng` directly to coordinate-dependent consumers. It did not join the PLACE GEOID to the LP201 statewide presentation artifact, so a canonical selection could reach DriveTexas without a governed geographic anchor.

`resolveGridlyCanonicalPlacePresentationFocus` is now the single runtime bridge from a `place-48xxxxx` key or explicit PLACE GEOID to the already-loaded `gridlyPlacePresentationTargets` representation of `data/generated/gridly-statewide-place-presentation-v1.json`. It validates coordinate ranges, returns LP201 provenance/authority, zoom 13, and the governed seven-mile radius. Labels do not resolve. A missing, conflicting, or malformed canonical entry returns `null`.

The canonical awareness-presentation boundary and home-town anchor resolve the focus on demand; identity/profile/membership/Pulse/microline objects remain coordinate-free. DriveTexas requests that shared canonical presentation context and exposes canonical key, focus authority, evaluation state, filter coordinate, radius, complete statewide cache count, and awareness candidate count in its existing audits. An unresolved canonical PLACE yields `CANONICAL_FOCUS_UNAVAILABLE`, disables label fallback, and cannot be interpreted as a geographically evaluated healthy empty.

## Consumer audit

| Consumer class | Surfaces | Determination |
| --- | --- | --- |
| `ALREADY_USES_CANONICAL_FOCUS` | semantic PLACE camera | Uses the same loaded statewide presentation target representation. |
| `SHOULD_USE_SHARED_CANONICAL_FOCUS` | DriveTexas awareness view, home-town crossing/nearby awareness callers reached through the shared anchor | Receives the repaired shared awareness anchor; no per-consumer coordinate registry was added. |
| `INTENTIONALLY_USES_OTHER_COORDINATE_AUTHORITY` | explicit current-user-location mode, county-wide mode, destination/search map presentation | Their coordinate authority is not canonical home PLACE identity and was not changed. |
| `OWNER_REVIEW` | Weather/NWS | Explicitly out of scope; no Weather/NWS work was started. |

## Certification

Deterministic runtime parity covers all 1,859 artifact entries: 1,859 resolved, zero missing, zero coordinate mismatches, zero invalid, and zero owner review. The governed inventory remains 254 counties, 2,058 memberships, and 163 multi-county identities. Dallas resolves one focus independently of its five memberships; Houston likewise resolves one focus independently of member county.

Owner browser validation remains required. For Houston select `place-4835000`, confirm focus `29.7589382, -95.3676974`, authority `LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1`, radius 7, and matching connector lifecycle coordinates before judging an empty result healthy. Repeat with Dallas `place-4819000`, confirm `32.7933334, -96.7665128`, then exercise Dallas → Houston → Dallas while checking that filter coordinates and governed consumer envelopes replace rather than retain prior-area state.
