const SAFE_BUCKET = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_OBJECT_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9][a-zA-Z0-9._\/-]{0,511}$/;

export function boundedArtifactLocation(bucket, objectPath) {
  const selectedBucket = String(bucket || "").trim();
  const selectedPath = String(objectPath || "").trim();
  if (!SAFE_BUCKET.test(selectedBucket)) throw new Error("invalid_bucket");
  if (!SAFE_OBJECT_PATH.test(selectedPath)) throw new Error("invalid_object_path");
  return { bucket: selectedBucket, objectPath: selectedPath };
}

const encodedPath = (value) => value.split("/").map(encodeURIComponent).join("/");
const category = (status) => status === 401 || status === 403 ? "authorization_failure"
  : status === 404 ? "not_found" : status >= 500 ? "server_error" : "storage_error";

/** Download a private governed artifact as a Web Stream, without a public/signed URL. */
export async function downloadCountyArtifact(storage, location, options = {}) {
  const { bucket, objectPath } = boundedArtifactLocation(location?.bucket, location?.objectPath);
  const timeoutMs = Math.min(120000, Math.max(250, Number(options.timeoutMs) || 10000));
  const controller = new AbortController(); let timeoutReject;
  const timeout = new Promise((_, reject) => { timeoutReject = reject; });
  const timer = setTimeout(() => { controller.abort(); timeoutReject(Object.assign(new Error("timeout"), { name: "AbortError" })); }, timeoutMs);
  try {
    let response;
    if (options.supabaseUrl && options.serviceRoleKey) {
      const base = String(options.supabaseUrl).replace(/\/+$/, "");
      const key = String(options.serviceRoleKey);
      const headers = { apikey: key };
      if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;
      response = await Promise.race([(options.fetchImpl || fetch)(`${base}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath(objectPath)}`, {
        method: "GET", headers, signal: controller.signal
      }), timeout]);
      if (!response.ok || !response.body) return { ok: false, reason: category(response.status), statusCategory: category(response.status) };
      return { ok: true, stream: response.body, statusCategory: "success", accessMode: "authenticated_storage_http_stream" };
    }
    if (!storage?.from) return { ok: false, reason: "storage_configuration_failure", statusCategory: "configuration" };
    const { data, error } = await Promise.race([storage.from(bucket).download(objectPath), timeout]);
    if (error || !data) {
      const statusCategory = category(Number(error?.statusCode || error?.status || 0));
      return { ok: false, reason: statusCategory, statusCategory };
    }
    if (typeof data.stream !== "function") return { ok: false, reason: "storage_stream_unavailable", statusCategory: "storage_error" };
    return { ok: true, stream: data.stream(), statusCategory: "success", accessMode: "storage_blob_stream" };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    return { ok: false, reason: timedOut ? "timeout" : "storage_network_failure", statusCategory: timedOut ? "timeout" : "network_failure" };
  } finally { clearTimeout(timer); }
}

export async function readBoundedArtifact(stream, maximumBytes = 65536) {
  const reader = stream.getReader(); const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > maximumBytes) { await reader.cancel(); throw new Error("artifact_too_large"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
