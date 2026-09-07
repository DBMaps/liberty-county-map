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
  if (!version.webSocketDebuggerUrl) throw new AndroidHarnessError("browser-level endpoint rejected", "/json/version omitted webSocketDebuggerUrl");
  if (!target.webSocketDebuggerUrl) throw new AndroidHarnessError("page-level endpoint rejected", "Gridly target omitted webSocketDebuggerUrl");
  return { version, target };
}

// Android System WebView provides a page CDP endpoint, not Chromium browser contexts.
export class AndroidWebViewPage {
  constructor(socket, { timeoutMs = 15000 } = {}) {
    this.socket = socket;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.exceptions = [];
    this.consoleMessages = [];
    socket.addEventListener("message", event => this.#message(event.data));
    socket.addEventListener("close", () => this.#rejectPending(new Error("CDP socket closed")));
    socket.addEventListener("error", () => this.#rejectPending(new Error("CDP socket error")));
  }

  #message(data) {
    const message = JSON.parse(typeof data === "string" ? data : data.toString());
    if (message.id) {
      const request = this.pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(message.id);
      message.error ? request.reject(new Error(`${request.method}: ${message.error.message}`)) : request.resolve(message.result);
    } else if (message.method === "Runtime.exceptionThrown") {
      this.exceptions.push(message.params?.exceptionDetails?.text || "Uncaught exception");
    } else if (message.method === "Runtime.consoleAPICalled") {
      this.consoleMessages.push((message.params?.args || []).map(arg => arg.value ?? arg.description ?? "").join(" "));
    }
  }

  #rejectPending(error) {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }

  send(method, params = {}, timeoutMs = this.timeoutMs) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new AndroidHarnessError("CDP request timeout", `${method} did not respond within ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { method, resolve, reject, timer });
      try { this.socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
    });
  }

  async evaluate(pageFunction, argument) {
    const source = typeof pageFunction === "function" ? `(${pageFunction})(${JSON.stringify(argument)})` : String(pageFunction);
    const response = await this.send("Runtime.evaluate", { expression: source, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description || response.exceptionDetails.text || "evaluation failed";
      throw new AndroidHarnessError("Runtime.evaluate failed", detail);
    }
    return response.result?.value;
  }

  async waitForFunction(pageFunction, argument, { timeout = this.timeoutMs } = {}) {
    return pollUntil(() => this.evaluate(pageFunction, argument), { timeoutMs: timeout, stage: "page condition unavailable" });
  }

  async waitForSelector(selector, { timeout = this.timeoutMs } = {}) {
    return this.waitForFunction(value => Boolean(document.querySelector(value)), selector, { timeout });
  }

  url() { return GRIDLY_TARGET.url; }

  async close() {
    if (this.socket.readyState === 2 || this.socket.readyState === 3) return;
    await new Promise(resolve => {
      this.socket.addEventListener("close", resolve, { once: true });
      this.socket.close();
    });
  }
}

export async function connectReadyWebView(readiness, { WebSocketImpl = WebSocket, timeoutMs = 15000 } = {}) {
  const endpoint = readiness.target.webSocketDebuggerUrl;
  const socket = new WebSocketImpl(endpoint);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new AndroidHarnessError("page-level connection timeout", `socket did not open within ${timeoutMs}ms`)), timeoutMs);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new AndroidHarnessError("page-level connection rejected", endpoint)); }, { once: true });
  });
  const page = new AndroidWebViewPage(socket, { timeoutMs });
  try {
    await page.send("Runtime.enable");
    await page.send("Page.enable");
    return { page, connection: "raw page-level CDP" };
  } catch (error) {
    await page.close();
    throw error;
  }
}

export function cleanupCreatedForward(forwardCreated, remove) {
  if (forwardCreated) remove();
}
