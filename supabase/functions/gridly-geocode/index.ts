import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CONFIG = Object.freeze({
  provider: Deno.env.get("GRIDLY_GEOCODE_PROVIDER") || "nominatim",
  baseUrl: Deno.env.get("GRIDLY_GEOCODE_PROVIDER_URL") || "https://nominatim.openstreetmap.org/search",
  namespace: Deno.env.get("GRIDLY_GEOCODE_CACHE_NAMESPACE") || "nominatim-public-v1",
  timeoutMs: 8000, intervalMs: 1000, maxAttempts: 3, maxBodyBytes: 8192,
  attribution: "© OpenStreetMap contributors"
});
const origins = new Set((Deno.env.get("GRIDLY_GEOCODE_ALLOWED_ORIGINS") || "https://gridly.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080,http://localhost:5500,http://127.0.0.1:5500").split(",").map((x) => x.trim()));
const inflight = new Map<string, Promise<Response>>();
const allowedTop = new Set(["intent", "query", "structuredAddress", "context", "limit", "requestId"]);
const allowedAddress = new Set(["street", "city", "county", "state", "postalCode", "country"]);
const allowedContext = new Set(["communityId", "countyId", "postalCode", "viewbox"]);
const control = /[\u0000-\u001f\u007f]/;

function cors(origin: string) { return { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" }; }
function failure(status: string, requestId = "", retryAfterSeconds: number | null = null, http = 400, origin = "") {
  return new Response(JSON.stringify({ ok: false, status, providerBoundary: "gridly", retryAfterSeconds, requestId, results: [] }), { status: http, headers: cors(origin) });
}
function fieldsAllowed(value: unknown, allowed: Set<string>) { return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).every((key) => allowed.has(key)); }
function textValid(value: unknown, max = 200) { return typeof value === "string" && value.length <= max && !control.test(value); }
function validate(body: any): string | null {
  if (!fieldsAllowed(body, allowedTop)) return "unknown_field";
  if (!["address", "business_place"].includes(body.intent)) return "intent";
  if (!textValid(body.query) || body.query.trim().length < 3) return "query";
  if (!Number.isInteger(body.limit) || body.limit < 1 || body.limit > 15) return "limit";
  if (body.requestId !== undefined && (!textValid(body.requestId, 80) || !/^[A-Za-z0-9._:-]+$/.test(body.requestId))) return "request_id";
  if (body.structuredAddress !== undefined && (!fieldsAllowed(body.structuredAddress, allowedAddress) || Object.values(body.structuredAddress).some((v) => !textValid(v, 200)))) return "structured_address";
  if (body.context !== undefined && !fieldsAllowed(body.context, allowedContext)) return "context";
  const box = body.context?.viewbox;
  if (box !== undefined && (!Array.isArray(box) || box.length !== 4 || box.some((n: unknown, i: number) => !Number.isFinite(n) || Math.abs(n as number) > (i % 2 ? 90 : 180)))) return "viewbox";
  return null;
}
async function hash(value: unknown) { const bytes = new TextEncoder().encode(JSON.stringify(value)); return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join(""); }
function normalize(body: any) {
  const clean = (v: unknown) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  return { namespace: CONFIG.namespace, intent: body.intent, query: clean(body.query), structuredAddress: Object.fromEntries(Object.entries(body.structuredAddress || {}).map(([k, v]) => [k, clean(v)])), context: body.context || {}, limit: body.limit };
}
function canonicalize(row: any) { const a = row.address || {}; return { providerResultId: String(row.place_id || ""), name: row.name || String(row.display_name || "").split(",")[0], displayName: row.display_name || "", latitude: Number(row.lat), longitude: Number(row.lon), category: row.category || "", type: row.type || "", address: { houseNumber: a.house_number || "", road: a.road || "", community: a.village || a.hamlet || "", city: a.city || a.town || "", county: a.county || "", state: a.state || "", postalCode: a.postcode || "", country: a.country || "" }, providerIdentity: { osmType: row.osm_type || "", osmId: String(row.osm_id || "") } }; }

async function execute(body: any, key: string, requestId: string, origin: string, db: any): Promise<Response> {
  const { data: cached } = await db.from("gridly_geocode_cache").select("response,status,expires_at").eq("cache_key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (cached) return new Response(JSON.stringify({ ...cached.response, cached: true, requestId }), { headers: cors(origin) });
  const { data: slot, error: leaseError } = await db.rpc("gridly_reserve_geocode_provider_slot", { p_namespace: CONFIG.namespace, p_interval_ms: CONFIG.intervalMs });
  if (leaseError) return failure("configuration_error", requestId, null, 503, origin);
  const wait = Math.max(0, new Date(slot).getTime() - Date.now()); if (wait) await new Promise((r) => setTimeout(r, wait));
  const params = new URLSearchParams({ format: "jsonv2", addressdetails: "1", countrycodes: "us", limit: String(body.limit) });
  if (body.intent === "address" && body.structuredAddress && Object.values(body.structuredAddress).some(Boolean)) {
    const map: Record<string, string> = { street: "street", city: "city", county: "county", state: "state", postalCode: "postalcode", country: "country" };
    for (const [field, upstream] of Object.entries(map)) if (body.structuredAddress[field]) params.set(upstream, body.structuredAddress[field]);
  } else params.set("q", body.query);
  if (body.context?.viewbox) params.set("viewbox", body.context.viewbox.join(","));
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.timeoutMs);
  let upstream: Response;
  try { upstream = await fetch(`${CONFIG.baseUrl}?${params}`, { headers: { "User-Agent": Deno.env.get("GRIDLY_GEOCODE_USER_AGENT") || "Gridly/LP100 (contact required)", Accept: "application/json" }, signal: controller.signal }); }
  catch (error) { clearTimeout(timer); return failure(error instanceof DOMException && error.name === "AbortError" ? "provider_timeout" : "provider_unavailable", requestId, null, 503, origin); }
  clearTimeout(timer);
  if (upstream.status === 429) { const retry = Math.min(3600, Math.max(1, Number(upstream.headers.get("Retry-After")) || 60)); await db.rpc("gridly_cooldown_geocode_provider", { p_namespace: CONFIG.namespace, p_seconds: retry }); return failure("rate_limited", requestId, retry, 429, origin); }
  if (!upstream.ok) return failure("provider_unavailable", requestId, null, 503, origin);
  const rows = await upstream.json(); const results = (Array.isArray(rows) ? rows : []).slice(0, body.limit).map(canonicalize).filter((x) => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
  const payload = results.length ? { ok: true, status: "success", provider: CONFIG.provider, providerBoundary: "gridly", cached: false, requestId, results } : { ok: false, status: "no_results", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [] };
  await db.from("gridly_geocode_cache").upsert({ cache_key: key, provider_namespace: CONFIG.namespace, response: payload, status: payload.status, expires_at: new Date(Date.now() + (results.length ? (body.intent === "business_place" ? 86400000 : 21600000) : 60000)).toISOString() });
  // A valid canonical no-result is an application outcome, not a missing HTTP resource.
  return new Response(JSON.stringify(payload), { status: 200, headers: cors(origin) });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin") || "";
  if (!origins.has(origin)) return failure("invalid_request", "", null, 403, "");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return failure("invalid_request", "", null, 405, origin);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) return failure("invalid_request", "", null, 415, origin);
  const declared = Number(request.headers.get("Content-Length") || 0); if (declared > CONFIG.maxBodyBytes) return failure("invalid_request", "", null, 413, origin);
  const raw = await request.text(); if (new TextEncoder().encode(raw).length > CONFIG.maxBodyBytes) return failure("invalid_request", "", null, 413, origin);
  let body; try { body = JSON.parse(raw); } catch { return failure("invalid_request", "", null, 400, origin); }
  const requestId = typeof body?.requestId === "string" ? body.requestId : crypto.randomUUID();
  if (validate(body)) return failure("invalid_request", requestId, null, 400, origin);
  const key = await hash(normalize(body));
  if (inflight.has(key)) return (await inflight.get(key)!).clone();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const task = execute(body, key, requestId, origin, db); inflight.set(key, task);
  try { return (await task).clone(); } finally { inflight.delete(key); }
});
