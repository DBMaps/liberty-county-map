// Browser-console, read-only RCA helper. It deliberately uses Gridly's existing
// authenticated runtime client and never accepts credentials or report data.
const WACO_BOUNDS = Object.freeze({
  minLat: 31.5488,
  maxLat: 31.5498,
  minLng: -97.1472,
  maxLng: -97.1462
});

const BASE_FIELDS = "id,created_at,device_id,report_type,lat,lng,crossing_name,severity,expires_at,detail";
const GOVERNED_FIELDS = `${BASE_FIELDS},county_id,state`;

function isMissingColumn(error) {
  return error?.code === "42703" || error?.code === "PGRST204" || /column|schema cache/i.test(error?.message || "");
}

function conciseError(error) {
  if (!error) return null;
  return { code: error.code || null, message: error.message || "Report lookup failed" };
}

async function runQuery(fields, includeCounty) {
  let query = supabaseClient.from("reports").select(fields)
    .eq("report_type", "flooding")
    .gte("lat", WACO_BOUNDS.minLat).lte("lat", WACO_BOUNDS.maxLat)
    .gte("lng", WACO_BOUNDS.minLng).lte("lng", WACO_BOUNDS.maxLng);
  if (includeCounty) query = query.eq("county_id", "mclennan-tx");
  return query.order("created_at", { ascending: false }).limit(25);
}

export async function selectRecentWacoFloodingReport() {
  try {
    let queryMode = "COUNTY_ID_AND_STATE_COLUMNS";
    let result = await runQuery(GOVERNED_FIELDS, true);
    if (result.error && isMissingColumn(result.error)) {
      queryMode = "DEPLOYED_BASE_COLUMNS_FALLBACK";
      result = await runQuery(BASE_FIELDS, false);
    }
    if (result.error) return { status: "ERROR", queryMode, rows: [], error: conciseError(result.error) };
    const rows = Array.isArray(result.data) ? result.data : [];
    return { status: rows.length ? "FOUND" : "NOT_FOUND", queryMode, rows, error: null };
  } catch (error) {
    return { status: "ERROR", queryMode: "CLIENT_ERROR", rows: [], error: conciseError(error) };
  }
}
