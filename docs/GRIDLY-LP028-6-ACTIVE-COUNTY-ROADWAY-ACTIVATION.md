# LP028.6 Active-County Roadway Activation

LP028.6 makes `gridlySetActiveCountyContext()` the production owner for active-county roadway package activation. Startup uses the same helper through the post-paint roadway startup stage, so both startup and county switches resolve one active county source and do not iterate over all LP028 counties.

The activation helper is `gridlyActivateRoadwayDatasetForActiveCounty(reason)`. It captures the selected county and activation sequence, delegates to the existing manifest-aware `loadRoadwayDataset()` loader, and records passive audit metadata for request count, requested/completed county, in-progress state, stale completions, and selected-county/package match.

Race protection is sequence and county based. A roadway response may install geometry only when the requested county still equals `gridlyGetActiveCountyId()` and its activation sequence is still current. Late completions from an older county increment the stale ignored counter and return without mutating `roadwaySegmentFeatures` or loaded package metadata.

Pending or blocked counties resolve no roadway URL. The shared loader clears prior-county geometry and metadata, reports `roadway_dataset_unavailable`, and performs no package fetch for those counties. Duplicate activation for the same package cache key reuses the current load Promise and preserves duplicate-load audit metadata.
