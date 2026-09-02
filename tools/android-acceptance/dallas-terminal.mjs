const NO_MATCH_PATTERN = /No matching destination found/i;
const PROVIDER_FAILURE_PATTERN = /(?:Address search is temporarily unavailable|Search is temporarily unavailable|Search is temporarily paused|provider(?:\/search)? (?:failed|failure)|search failed)/i;

export function normalizeVisibleResultText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function classifyDallasTerminal(value) {
  const text = normalizeVisibleResultText(value);
  const visibleDallas = /\bDallas\b/i.test(text);
  const noMatch = NO_MATCH_PATTERN.test(text);
  const providerFailure = PROVIDER_FAILURE_PATTERN.test(text);
  const kind = visibleDallas ? "dallas" : noMatch ? "no_match" : providerFailure ? "provider_failure" : "pending";
  return { kind, text, terminal: kind !== "pending", visibleDallas, noMatch, providerFailure };
}

export async function waitForDallasTerminal(readVisibleText, { timeoutMs = 15000, intervalMs = 100 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let observation = classifyDallasTerminal(await readVisibleText());
  while (!observation.terminal && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, Math.max(0, deadline - Date.now()))));
    observation = classifyDallasTerminal(await readVisibleText());
  }
  return observation.terminal ? observation : { ...observation, kind: "timeout" };
}
