# LP101 — Search Quality & Relevance Refinement

## Executive summary

LP101 adds a small browser-side quality layer to the existing destination search pipeline. It normalizes everyday brand and roadway wording, applies a conservative correction list for high-confidence common typos, recognizes common destination categories before generic matching, separates known community terms from destination terms, and adds confidence-, governance-, distance-, category-, and community-aware ranking signals.

## Architecture and performance

The Gridly geocoding client, Edge Function, canonical response, provider abstraction, caching, governance, and routing remain unchanged. Normalization happens before the existing request is evaluated and does not add a request or provider. Ranking reads only Gridly's normalized browser result model. No provider-specific response field is introduced into the UI.

## Search behavior

- Brand variants include H-E-B / H E B, Wal Mart, and McDonald's.
- Road variants include CR / County Road, FM / Farm Road, Hwy / Highway, and U.S. / US.
- A deliberately small correction map covers `mcdonlds`, `walmartt`, `hopsital`, and `libary`; arbitrary fuzzy matching is not used.
- Category intent covers medical care, education, airports, fuel, government and civic services, public safety, worship, parks, libraries, DMV, tax offices, and post offices.
- Known community tokens are separated from destination terms for mixed searches such as `Dayton Walmart`.
- Saved and governed places retain precedence; category fit, explicit community fit, canonical confidence, proximity for “nearest,” and stable input order resolve remaining matches.

## Browser certification

`window.gridlyLp101BrowserCertification()` reports normalization, typo, category, and multi-term checks; canonical use and provider independence; zero additional requests; protected-system status; and `safeToMerge`.

## Merge recommendation

Merge when the LP097–LP101 contract suite passes and browser smoke validation confirms the search drawer remains visually unchanged and responsive.
