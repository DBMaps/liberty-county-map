// Browser-console, read-only report locator. It uses the authenticated Gridly
// runtime client and the non-secret identity retained by the last successful
// persistence diagnostic. No write operation is available from this module.
const BASE_FIELDS = "id,created_at,device_id,crossing_id,crossing_name,report_type,lat,lng,severity,expires_at,detail";

function conciseError(error) {
  if (!error) return null;
  return { code: error.code || null, message: String(error.message || "Report lookup failed").slice(0, 500) };
}

function diagnostic() {
  return globalThis.gridlyGetLastHazardPersistenceDiagnostic?.() || null;
}

function runtimeDeviceId(identity) {
  return identity?.deviceId || globalThis.localStorage?.getItem?.("gridlyDeviceId") || null;
}

async function execute(identity, recentDeviceOnly = false) {
  const client = globalThis[Symbol.for("gridly.runtime.supabaseClient")];
  if (!client || typeof client.from !== "function") throw new Error("Gridly production Supabase client is unavailable");
  let query = client.from("reports").select(BASE_FIELDS);
  let identityMode = "";
  if (!recentDeviceOnly && identity?.insertedRowId) {
    query = query.eq("id", identity.insertedRowId);
    identityMode = "EXACT_RETURNED_ROW_ID";
  } else if (!recentDeviceOnly && identity?.crossingId) {
    query = query.eq("crossing_id", identity.crossingId);
    identityMode = "EXACT_CROSSING_ID";
  } else if (runtimeDeviceId(identity)) {
    query = query.eq("device_id", runtimeDeviceId(identity)).eq("report_type", identity?.reportType || "flooding");
    if (identity?.attemptedAt) {
      const attempted = new Date(identity.attemptedAt).getTime();
      query = query.gte("created_at", new Date(attempted - 120000).toISOString()).lte("created_at", new Date(attempted + 600000).toISOString());
    } else {
      query = query.gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    }
    identityMode = identity?.attemptedAt ? "DEVICE_TYPE_CREATED_WINDOW" : "RECENT_DEVICE_TYPE";
  } else if (!recentDeviceOnly && Number.isFinite(identity?.lat) && Number.isFinite(identity?.lng)) {
    query = query.eq("lat", identity.lat).eq("lng", identity.lng).eq("report_type", identity?.reportType || "flooding");
    identityMode = "EXACT_SUBMITTED_COORDINATE";
  } else {
    return { status: "NOT_FOUND", queryMode: "NO_RETAINED_IDENTITY", rows: [], error: null };
  }
  const result = await query.order("created_at", { ascending: false }).limit(25);
  if (result.error) return { status: "ERROR", queryMode: `DEPLOYED_BASE_COLUMNS:${identityMode}`, rows: [], error: conciseError(result.error) };
  const rows = Array.isArray(result.data) ? result.data : [];
  return { status: rows.length ? "FOUND" : "NOT_FOUND", queryMode: `DEPLOYED_BASE_COLUMNS:${identityMode}`, rows, error: null };
}

export async function selectLastPersistedHazardReport() {
  try { return await execute(diagnostic()); }
  catch (error) { return { status: "ERROR", queryMode: "CLIENT_ERROR", rows: [], error: conciseError(error) }; }
}

// Recovery path for a report submitted before identity enrichment was deployed.
export async function selectRecentDeviceFloodingReport() {
  try { return await execute(diagnostic(), true); }
  catch (error) { return { status: "ERROR", queryMode: "CLIENT_ERROR", rows: [], error: conciseError(error) }; }
}

// Backward-compatible name for owner bookmarks; no Waco coordinate is assumed.
export const selectRecentWacoFloodingReport = selectLastPersistedHazardReport;

globalThis.selectLastPersistedHazardReport = selectLastPersistedHazardReport;
globalThis.selectRecentDeviceFloodingReport = selectRecentDeviceFloodingReport;
