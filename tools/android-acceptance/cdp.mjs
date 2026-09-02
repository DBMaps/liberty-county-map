export const GRIDLY_TARGET = Object.freeze({
  type: "page",
  url: "https://localhost/",
  title: "Gridly | Know Before You Go"
});

export class AndroidHarnessError extends Error {
  constructor(stage, message, cause) {
    super(`${stage}: ${message}`, cause ? { cause } : undefined);
    this.name = "AndroidHarnessError";
    this.stage = stage;
  }
}

export function selectGridlyTarget(targets) {
  return targets.find(target => Object.entries(GRIDLY_TARGET).every(([key, value]) => target?.[key] === value));
}

export async function pollUntil(action, { timeoutMs = 15000, intervalMs = 250, now = Date.now, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), stage }) {
  const deadline = now() + timeoutMs;
  let lastError;
  do {
    try {
      const result = await action();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  } while (now() <= deadline);
  throw new AndroidHarnessError(stage, `not ready within ${timeoutMs}ms${lastError ? ` (${lastError.message})` : ""}`, lastError);
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export async function waitForCdpReadiness(baseUrl, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const polling = { timeoutMs: options.timeoutMs, intervalMs: options.intervalMs, now: options.now, sleep: options.sleep };
  const version = await pollUntil(() => getJson(`${baseUrl}/json/version`, fetchImpl), { ...polling, stage: "/json/version unavailable" });
  const target = await pollUntil(async () => selectGridlyTarget(await getJson(`${baseUrl}/json/list`, fetchImpl)), { ...polling, stage: "Gridly page target unavailable" });
  if (!version.webSocketDebuggerUrl) throw new AndroidHarnessError("browser-level connection rejected", "/json/version omitted webSocketDebuggerUrl");
  if (!target.webSocketDebuggerUrl) throw new AndroidHarnessError("page-level connection rejected", "Gridly target omitted webSocketDebuggerUrl");
  return { version, target };
}

export async function connectReadyWebView(chromium, baseUrl, readiness, connect = endpoint => chromium.connectOverCDP(endpoint)) {
  let browserError;
  try {
    const browser = await connect(readiness.version.webSocketDebuggerUrl || baseUrl);
    const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url() === GRIDLY_TARGET.url);
    if (page) return { browser, page, connection: "browser-level" };
    await browser.close().catch(() => {});
    browserError = new Error("connected browser exposed no Gridly page");
  } catch (error) {
    browserError = error;
  }

  try {
    const browser = await connect(readiness.target.webSocketDebuggerUrl);
    const page = browser.contexts().flatMap(context => context.pages()).find(candidate => candidate.url() === GRIDLY_TARGET.url)
      || browser.contexts().flatMap(context => context.pages())[0];
    if (!page) throw new Error("page endpoint exposed no inspectable page");
    return { browser, page, connection: "page-level fallback", browserError };
  } catch (error) {
    throw new AndroidHarnessError("page-level connection rejected", `${error.message}; browser-level connection rejected: ${browserError.message}`, error);
  }
}

export function cleanupCreatedForward(forwardCreated, remove) {
  if (forwardCreated) remove();
}
