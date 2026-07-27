const assert = require("node:assert/strict");
const fs = require("node:fs");
const controllerApi = require("../js/historical-intelligence-attachment-controller.js");
const renderer = require("../js/historical-intelligence-presentation.js");

class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.attributes = {}; this.childNodes = []; this.parentNode = null; this.innerHTML = ""; }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, before) { const index = before ? this.childNodes.indexOf(before) : -1; this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, node); node.parentNode = this; return node; }
  removeChild(node) { const index = this.childNodes.indexOf(node); if (index >= 0) this.childNodes.splice(index, 1); node.parentNode = null; }
  querySelector(selector) { return selector === "[data-lp072-supporting-detail]" ? this.childNodes.find((node) => node.getAttribute?.("data-lp072-supporting-detail") !== null) || null : null; }
}
const createDocument = (host) => ({ activeElement: null, createElement: (tag) => new Element(tag), querySelector: (selector) => selector === controllerApi.HOST_SELECTOR ? host : null });
const selected = { historicalTakeaway: "Congestion has commonly developed near US 90 during busy travel periods.", narrativeType: "congestion", subject: "US 90", historicalWindow: "Friday afternoons", liveConditionGuidance: "Check current alerts for live conditions.", quiet: false, displayEligible: true };
const quiet = { historicalTakeaway: null, narrativeType: null, subject: null, historicalWindow: null, liveConditionGuidance: null, quiet: true, displayEligible: false };
const authorization = { activationAuthorized: true, consumerVisible: true, productionIntegration: true, owner: controllerApi.OWNER, ownershipToken: controllerApi.OWNER_TOKEN, prerequisites: { LP067: true, LP068: true, LP069: true }, dtoContract: controllerApi.DTO_CONTRACT, rendererContract: controllerApi.RENDERER_CONTRACT, currentAlertAuthority: controllerApi.ACTIVATION_DECISION.currentAlertAuthority };

const decision = controllerApi.ACTIVATION_DECISION;
assert.deepEqual(Object.keys(decision), ["milestone", "productionIntegrationPrepared", "consumerVisible", "activationAuthorized", "explicitOptInRequired", "reversibleAttachmentReady", "rollbackReady", "currentAlertAuthority", "approvedDtoContract", "approvedRendererContract"]);
assert.equal(decision.productionIntegrationPrepared, true); assert.equal(decision.consumerVisible, false); assert.equal(decision.activationAuthorized, false);
assert.equal(decision.explicitOptInRequired, true); assert.equal(decision.reversibleAttachmentReady, true); assert.equal(decision.rollbackReady, true);
assert.equal(controllerApi.exactDto(selected), true); assert.equal(controllerApi.exactDto({ ...selected, rankingMetadata: {} }), false);
assert.equal(controllerApi.approvedRenderer(renderer), true); assert.equal(controllerApi.approvedRenderer({ ...renderer, CONTRACT_ID: "private" }), false);

const alert = new Element("section"); alert.setAttribute("data-current-alert", ""); alert.innerHTML = "Current road closure";
const detail = new Element("aside"); detail.setAttribute("data-lp072-supporting-detail", ""); detail.innerHTML = "Supporting detail";
const host = new Element("section"); host.setAttribute("data-gridly-owner", controllerApi.OWNER_TOKEN); host.appendChild(alert); host.appendChild(detail);
const initialNodes = [...host.childNodes]; const initialAlert = alert.innerHTML;
const controller = controllerApi.createController({ document: createDocument(host), renderer });
assert.equal(controller.attach(selected, {}).code, "unauthorized");
assert.equal(controller.attach(selected, { ...authorization, consumerVisible: false }).code, "activation-disabled");
assert.equal(controller.attach(selected, { ...authorization, owner: "Alerts" }).code, "owner-mismatch");
assert.equal(controller.attach(selected, { ...authorization, dtoContract: "wrong" }).code, "dto-contract-mismatch");
assert.equal(controller.attach(selected, { ...authorization, currentAlertAuthority: "history" }).code, "current-alert-authority-mismatch");
assert.equal(controller.attach({ ...selected, score: 1 }, authorization).code, "invalid-dto"); assert.deepEqual(host.childNodes, initialNodes);
assert.equal(controller.attach(quiet, authorization).code, "quiet-dto"); assert.deepEqual(host.childNodes, initialNodes);
assert.equal(controllerApi.createController({ document: createDocument(null), renderer }).attach(selected, authorization).code, "missing-host");
const badRenderer = controllerApi.createController({ document: createDocument(host), renderer: { ...renderer, render: null } });
assert.equal(badRenderer.attach(selected, authorization).code, "renderer-unavailable");

assert.equal(controller.attach(selected, authorization).code, "attached");
assert.equal(host.childNodes.length, 3); assert.equal(host.childNodes[0], alert); assert.equal(host.childNodes[1].getAttribute("data-lp072-attachment"), controllerApi.OWNER_TOKEN); assert.equal(host.childNodes[2], detail);
assert.equal(alert.innerHTML, initialAlert); assert.doesNotMatch(host.childNodes[1].innerHTML, /ranking|confidence|score|candidate|DTO/i);
assert.equal(controller.attach(selected, authorization).code, "already-attached"); assert.equal(host.childNodes.length, 3);
assert.equal(controller.detach().code, "rollback-complete"); assert.deepEqual(host.childNodes, initialNodes); assert.equal(alert.innerHTML, initialAlert);
assert.equal(controller.detach().code, "detached");
assert.equal(controller.attach(selected, authorization).code, "attached"); assert.equal(controller.attach(quiet, authorization).code, "quiet-dto"); assert.deepEqual(host.childNodes, initialNodes);
assert.equal(controller.attach(selected, authorization).code, "attached");
const attachedNode = host.childNodes[1]; assert.equal(controller.attach({ ...selected, privateField: true }, authorization).code, "invalid-dto"); assert.equal(host.childNodes[1], attachedNode);
assert.equal(controller.detach().code, "rollback-complete"); assert.deepEqual(controller.state(), { attached: false, ownedListeners: 0, ownedObservers: 0, ownedTimers: 0 });

const focused = new Element("button"); const focusDocument = createDocument(host); focusDocument.activeElement = focused;
const focusController = controllerApi.createController({ document: focusDocument, renderer }); focusController.attach(selected, authorization); assert.equal(focusDocument.activeElement, focused); focusController.detach(); assert.equal(focusDocument.activeElement, focused);
const disappearing = controllerApi.createController({ document: createDocument(host), renderer }); disappearing.attach(selected, authorization); host.removeChild(host.childNodes[1]); assert.equal(disappearing.detach().code, "rollback-complete"); assert.deepEqual(host.childNodes, initialNodes);

const css = fs.readFileSync("css/lp072-historical-intelligence-certification.css", "utf8"); assert.match(css, /prefers-reduced-motion:\s*reduce/);
for (const file of ["index.html", "js/app.js"]) {
  const source = fs.readFileSync(file, "utf8");
  assert.doesNotMatch(source, /LP0(?:67|68|69|70|71|72)|historical-pattern-intelligence\.js|historical-narrative-(?:generator|ranking)\.js|historical-intelligence-(?:activation-boundary|presentation|attachment-controller)\.js/i);
  assert.doesNotMatch(source, /data-gridly-owner=["']know-before-you-go-historical-intelligence/i);
}
assert.equal(fs.existsSync("tests/lp072-browser-certification.html"), true);
console.log("LP072 Historical Intelligence reversible attachment certification passed (45 requirements covered)");
