const SAFE_BUCKET = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_OBJECT_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9][a-zA-Z0-9._\/-]{0,511}$/;

export function boundedArtifactLocation(bucket, objectPath) {
  const selectedBucket = String(bucket || "").trim();
  const selectedPath = String(objectPath || "").trim();
  if (!SAFE_BUCKET.test(selectedBucket)) throw new Error("invalid_bucket");
  if (!SAFE_OBJECT_PATH.test(selectedPath)) throw new Error("invalid_object_path");
  return { bucket: selectedBucket, objectPath: selectedPath };
}

/** Download a governed county artifact without creating a public or signed URL. */
export async function downloadCountyArtifact(storage, location, options = {}) {
  const { bucket, objectPath } = boundedArtifactLocation(location?.bucket, location?.objectPath);
  if (!storage?.from) return { ok: false, reason: "storage_configuration_failure", statusCategory: "configuration" };
  const timeoutMs = Math.min(15000, Math.max(250, Number(options.timeoutMs) || 10000));
  let timer;
  try {
    const timeout = new Promise((resolve) => {
      timer = setTimeout(() => resolve({ timeout: true }), timeoutMs);
    });
    const operation = Promise.resolve(storage.from(bucket).download(objectPath))
      .then((result) => ({ result }), () => ({ networkFailure: true }));
    const settled = await Promise.race([operation, timeout]);
    if (settled.timeout) return { ok: false, reason: "timeout", statusCategory: "timeout" };
    if (settled.networkFailure) return { ok: false, reason: "storage_network_failure", statusCategory: "network_failure" };
    const { data, error } = settled.result || {};
    if (error || !data) {
      const status = Number(error?.statusCode || error?.status || 0);
      const statusCategory = status === 401 || status === 403 ? "authorization_failure"
        : status === 404 ? "not_found" : status >= 500 ? "server_error" : "storage_error";
      return { ok: false, reason: statusCategory, statusCategory };
    }
    const bytes = await data.arrayBuffer();
    return { ok: true, bytes, statusCategory: "success" };
  } catch (_error) {
    return { ok: false, reason: "storage_network_failure", statusCategory: "network_failure" };
  } finally { clearTimeout(timer); }
}
