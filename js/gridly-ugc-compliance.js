(function gridlyUgcComplianceModule(root) {
  "use strict";

  const TERMS_VERSION = "gridly-ugc-2026-09-16-v1";
  const ACCEPTANCE_KEY = "gridlyUgcTermsAcceptanceV1";
  const HIDDEN_REPORTS_KEY = "gridlyHiddenCommunityReportsV1";
  const MAX_HIDDEN_REPORTS = 500;
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const REASONS = Object.freeze([
    Object.freeze({ value: "dangerous_content", label: "Dangerous or unsafe content" }),
    Object.freeze({ value: "false_information", label: "False or misleading information" }),
    Object.freeze({ value: "harassment", label: "Harassment or targeted abuse" }),
    Object.freeze({ value: "hate_or_abuse", label: "Hate or abusive content" }),
    Object.freeze({ value: "spam", label: "Spam or manipulation" }),
    Object.freeze({ value: "other", label: "Other guideline violation" })
  ]);
  const LEGAL_DOCUMENTS = Object.freeze({
    privacy: Object.freeze({ title: "Privacy Policy", url: "legal/privacy.html" }),
    terms: Object.freeze({ title: "Terms of Use", url: "legal/terms.html" }),
    guidelines: Object.freeze({ title: "Community Guidelines", url: "legal/community-guidelines.html" })
  });

  function safeStorage() {
    try { return root.localStorage || null; } catch (_) { return null; }
  }

  function readJson(key, fallback) {
    try {
      const value = safeStorage()?.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) { return fallback; }
  }

  function writeJson(key, value) {
    try { safeStorage()?.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  }

  function acceptance() {
    const value = readJson(ACCEPTANCE_KEY, null);
    return value && value.version === TERMS_VERSION && typeof value.acceptedAt === "string" ? value : null;
  }

  function acceptTerms(now = new Date()) {
    const record = Object.freeze({ version: TERMS_VERSION, acceptedAt: now.toISOString() });
    writeJson(ACCEPTANCE_KEY, record);
    return record;
  }

  function hiddenIds() {
    const rows = readJson(HIDDEN_REPORTS_KEY, []);
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => row && UUID_V4.test(String(row.id || "")))
      .slice(-MAX_HIDDEN_REPORTS);
  }

  function isHidden(reportId) {
    const id = String(reportId || "").toLowerCase();
    return UUID_V4.test(id) && hiddenIds().some((row) => String(row.id).toLowerCase() === id);
  }

  function hide(reportId) {
    const id = String(reportId || "").toLowerCase();
    if (!UUID_V4.test(id)) return false;
    const rows = hiddenIds().filter((row) => String(row.id).toLowerCase() !== id);
    rows.push({ id, hiddenAt: new Date().toISOString() });
    writeJson(HIDDEN_REPORTS_KEY, rows.slice(-MAX_HIDDEN_REPORTS));
    return true;
  }

  function filterVisible(rows, resolveId) {
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      const id = typeof resolveId === "function" ? resolveId(row) : row?.persistedReportId || row?.report_id || row?.id;
      return !isHidden(id);
    });
  }

  function uuid() {
    if (typeof root.crypto?.randomUUID === "function") return root.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    root.crypto?.getRandomValues?.(bytes);
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    return Array.from(bytes, (value, index) => ([4,6,8,10].includes(index) ? "-" : "") + value.toString(16).padStart(2,"0")).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  }

  function installStyle() {
    if (typeof document === "undefined" || document.getElementById("gridlyUgcComplianceStyle")) return;
    const style = document.createElement("style");
    style.id = "gridlyUgcComplianceStyle";
    style.textContent = `
      .gridly-ugc-dialog{border:0;border-radius:18px;padding:0;width:min(92vw,620px);max-height:88vh;color:#102332;background:#fff;box-shadow:0 24px 80px #001a2e55}
      .gridly-ugc-dialog::backdrop{background:#071f2dcc;backdrop-filter:blur(3px)}
      .gridly-ugc-panel{padding:22px;display:grid;gap:14px;max-height:84vh;overflow:auto;font:15px/1.45 system-ui,sans-serif}
      .gridly-ugc-panel h2{font-size:1.3rem;margin:0}.gridly-ugc-panel p{margin:0}.gridly-ugc-panel ul{margin:0;padding-left:22px}
      .gridly-ugc-actions{display:flex;gap:10px;flex-wrap:wrap}.gridly-ugc-actions button,.gridly-ugc-link{min-height:42px;border-radius:10px;border:1px solid #b9c9d4;background:#f4f8fa;color:#12384e;padding:9px 13px;font-weight:650;cursor:pointer}
      .gridly-ugc-actions .primary{background:#0a6b65;color:#fff;border-color:#0a6b65}.gridly-ugc-actions .danger{color:#8a2530}
      .gridly-ugc-consent{display:flex;gap:10px;align-items:flex-start;background:#f2f7f6;padding:12px;border-radius:10px}.gridly-ugc-consent input{margin-top:4px}
      .gridly-ugc-legal-frame{width:100%;height:min(68vh,720px);border:1px solid #d5e0e6;border-radius:10px;background:#fff}
      .gridly-ugc-community-controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.gridly-ugc-community-controls button{font-size:12px;min-height:34px}
      .gridly-ugc-reason{display:grid;gap:8px}.gridly-ugc-reason select{min-height:44px;border:1px solid #9fb4c0;border-radius:9px;padding:8px;background:#fff}
    `;
    document.head.appendChild(style);
  }

  function makeDialog(label, html) {
    installStyle();
    const dialog = document.createElement("dialog");
    dialog.className = "gridly-ugc-dialog";
    dialog.setAttribute("aria-label", label);
    dialog.innerHTML = `<div class="gridly-ugc-panel">${html}</div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else { dialog.setAttribute("open", ""); }
    return dialog;
  }

  function closeDialog(dialog, value) {
    dialog.dataset.result = value || "";
    if (typeof dialog.close === "function") dialog.close(value || "");
    else { dialog.removeAttribute("open"); dialog.dispatchEvent(new Event("close")); }
  }

  function openLegal(name) {
    if (typeof document === "undefined") return null;
    const item = LEGAL_DOCUMENTS[name];
    if (!item) return null;
    const dialog = makeDialog(item.title, `
      <h2>${escapeHtml(item.title)}</h2>
      <iframe class="gridly-ugc-legal-frame" title="${escapeHtml(item.title)}" src="${escapeHtml(item.url)}"></iframe>
      <div class="gridly-ugc-actions"><button type="button" class="primary" data-gridly-ugc-close>Done</button></div>`);
    dialog.querySelector("[data-gridly-ugc-close]")?.addEventListener("click", () => closeDialog(dialog, "done"));
    return dialog;
  }

  let consentPromise = null;
  function ensureAccepted() {
    if (acceptance()) return Promise.resolve(true);
    if (typeof document === "undefined") return Promise.resolve(false);
    if (consentPromise) return consentPromise;
    consentPromise = new Promise((resolve) => {
      const dialog = makeDialog("Community reporting terms", `
        <h2>Before you share with the community</h2>
        <p>Gridly community reports help other drivers understand changing road and rail conditions. They are not emergency reports or official traffic instructions.</p>
        <ul><li>Share only what you personally observed and believe is accurate.</li><li>Do not post harassment, hate, threats, personal information, spam, or dangerous instructions.</li><li>Never use Gridly while driving. Pull over safely first.</li></ul>
        <div class="gridly-ugc-actions"><button type="button" data-gridly-ugc-legal="terms">Read Terms</button><button type="button" data-gridly-ugc-legal="guidelines">Read Guidelines</button><button type="button" data-gridly-ugc-legal="privacy">Read Privacy Policy</button></div>
        <label class="gridly-ugc-consent"><input type="checkbox" data-gridly-ugc-consent-check><span>I agree to the Terms of Use and Community Guidelines for community reporting.</span></label>
        <div class="gridly-ugc-actions"><button type="button" data-gridly-ugc-consent-cancel>Not now</button><button type="button" class="primary" data-gridly-ugc-consent-accept disabled>Accept and continue</button></div>`);
      const checkbox = dialog.querySelector("[data-gridly-ugc-consent-check]");
      const accept = dialog.querySelector("[data-gridly-ugc-consent-accept]");
      checkbox?.addEventListener("change", () => { accept.disabled = !checkbox.checked; });
      accept?.addEventListener("click", () => { if (!checkbox?.checked) return; acceptTerms(); closeDialog(dialog,"accepted"); });
      dialog.querySelector("[data-gridly-ugc-consent-cancel]")?.addEventListener("click", () => closeDialog(dialog,"cancelled"));
      dialog.querySelectorAll("[data-gridly-ugc-legal]").forEach((button) => button.addEventListener("click", () => openLegal(button.dataset.gridlyUgcLegal)));
      dialog.addEventListener("close", () => { const result=dialog.dataset.result === "accepted"; consentPromise=null; resolve(result); }, { once:true });
    });
    return consentPromise;
  }

  function controlsHtml(reportId) {
    const id = String(reportId || "").toLowerCase();
    if (!UUID_V4.test(id) || isHidden(id)) return "";
    return `<div class="gridly-ugc-community-controls" data-gridly-ugc-report-id="${escapeHtml(id)}">
      <button type="button" data-gridly-ugc-action="report" data-report-id="${escapeHtml(id)}">Report</button>
      <button type="button" data-gridly-ugc-action="hide" data-report-id="${escapeHtml(id)}">Hide</button>
      <button type="button" data-gridly-ugc-action="delete" data-report-id="${escapeHtml(id)}" title="Request deletion if this is your report">Delete mine</button>
    </div>`;
  }

  function bridge() { return root.gridlyUgcComplianceBridge || {}; }
  function notify(message, kind="success") { bridge().notify?.(message, kind); }

  async function openReportDialog(reportId) {
    const id = String(reportId || "").toLowerCase();
    if (!UUID_V4.test(id) || typeof document === "undefined") return;
    const options = REASONS.map((reason) => `<option value="${reason.value}">${escapeHtml(reason.label)}</option>`).join("");
    const dialog = makeDialog("Report community content", `
      <h2>Report this community update</h2><p>Choose the closest reason. Gridly stores a one-way device digest for abuse prevention; it does not publish your identity.</p>
      <label class="gridly-ugc-reason"><span>Reason</span><select data-gridly-ugc-reason>${options}</select></label>
      <div class="gridly-ugc-actions"><button type="button" data-gridly-ugc-close>Cancel</button><button type="button" class="primary" data-gridly-ugc-submit-report>Send report</button></div>`);
    dialog.querySelector("[data-gridly-ugc-close]")?.addEventListener("click", () => closeDialog(dialog,"cancelled"));
    dialog.querySelector("[data-gridly-ugc-submit-report]")?.addEventListener("click", async (event) => {
      const button = event.currentTarget; button.disabled=true;
      const reason = dialog.querySelector("[data-gridly-ugc-reason]")?.value || "other";
      const result = await bridge().submitModeration?.({ operationId:uuid(), reportId:id, reason });
      if (["accepted","already_processed"].includes(result?.status)) { notify("Thanks. The report was sent for review."); closeDialog(dialog,"submitted"); }
      else { notify(result?.status === "rate_limited" ? "You’ve reached the report limit. Try again later." : "We couldn’t send that report. Try again.","error"); button.disabled=false; }
    });
  }

  async function requestDeletion(reportId) {
    const id = String(reportId || "").toLowerCase();
    if (!UUID_V4.test(id)) return;
    const result = await bridge().requestDeletion?.({ operationId:uuid(), reportId:id });
    if (["accepted","already_processed"].includes(result?.status)) notify("Deletion request received. Gridly will remove or review the report through the privacy workflow.");
    else if (result?.status === "forbidden") notify("This device cannot verify that it submitted that report. Use the Privacy entry in Settings for help.","error");
    else notify("We couldn’t submit the deletion request. Try again.","error");
  }

  function installDelegation() {
    if (typeof document === "undefined" || root.__gridlyUgcDelegationInstalled) return;
    root.__gridlyUgcDelegationInstalled = true;
    document.addEventListener("click", async (event) => {
      const legal = event.target?.closest?.("[data-gridly-ugc-legal]");
      if (legal) { event.preventDefault(); openLegal(legal.dataset.gridlyUgcLegal); return; }
      const action = event.target?.closest?.("[data-gridly-ugc-action]");
      if (!action) return;
      const kind = action.dataset.gridlyUgcAction;
      if (kind === "legal") { openLegal(action.dataset.document); return; }
      const reportId = action.dataset.reportId;
      if (kind === "report") await openReportDialog(reportId);
      if (kind === "hide" && hide(reportId)) { notify("That community report is hidden on this device."); bridge().onHide?.(reportId); }
      if (kind === "delete") await requestDeletion(reportId);
    });
  }

  const api = Object.freeze({
    version: TERMS_VERSION, acceptance, acceptTerms, ensureAccepted,
    isHidden, hide, hiddenIds, filterVisible, controlsHtml, openLegal,
    reasons: REASONS, legalDocuments: LEGAL_DOCUMENTS
  });
  root.gridlyUgcCompliance = api;
  installDelegation();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
