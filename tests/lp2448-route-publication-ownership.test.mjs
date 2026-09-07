import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync("js/gridly-route-publication-ownership.js", "utf8");
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const contract = context.globalThis.GRIDLY_ROUTE_PUBLICATION_OWNERSHIP_CONTRACT;

const emptyConsumer = () => ({ layer: null, geometry: [], destination: null, origin: null,
  labels: { origin: "", destination: "" }, etaMinutes: null, distanceMiles: null,
  routeWatchActive: false, destinationIntelligence: null, error: "" });
const route = (name, origin = { lat: 30.01, lng: -94.71 }, destination = { lat: 30.11, lng: -94.81 }) => ({
  name, origin, destination, geometry: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
  etaMinutes: name === "A" ? 14 : 22, distanceMiles: name === "A" ? 7.5 : 12.25
});
const publishRoute = (controller, action, consumer, value, activateWatch = false) => controller.publish(action, () => {
  consumer.layer = `layer-${value.name}`;
  consumer.geometry = value.geometry.map((point) => [...point]);
  consumer.destination = { ...value.destination, name: value.name };
  consumer.origin = { ...value.origin };
  consumer.labels = { origin: `Origin ${value.name}`, destination: `Destination ${value.name}` };
  consumer.etaMinutes = value.etaMinutes;
  consumer.distanceMiles = value.distanceMiles;
  consumer.routeWatchActive = activateWatch;
  consumer.destinationIntelligence = `intelligence-${value.name}`;
  consumer.error = "";
});

test("pending route plus Clear suppresses every late consumer publication", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const action = controller.start("route_preview");
  controller.invalidate("clear");
  Object.assign(consumer, emptyConsumer());
  assert.equal(publishRoute(controller, action, consumer, route("A"), true), false);
  assert.deepEqual(consumer, emptyConsumer());
  assert.equal(controller.audit().clearInvalidationCount, 1);
});

test("pending Route Watch plus Stop cannot revive monitoring", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const action = controller.start("route_watch");
  controller.invalidate("stop");
  consumer.routeWatchActive = false;
  assert.equal(publishRoute(controller, action, consumer, route("A"), true), false);
  assert.equal(consumer.routeWatchActive, false);
  assert.equal(consumer.layer, null);
});

test("Route B remains authoritative when B completes before A", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const actionA = controller.start("route_A");
  const actionB = controller.start("route_B");
  assert.equal(publishRoute(controller, actionB, consumer, route("B"), true), true);
  assert.equal(publishRoute(controller, actionA, consumer, route("A"), true), false);
  assert.equal(consumer.layer, "layer-B");
  assert.equal(consumer.destination.name, "B");
  assert.equal(consumer.destinationIntelligence, "intelligence-B");
});

test("A may publish before B starts and B owns the final state", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const actionA = controller.start("route_A");
  assert.equal(publishRoute(controller, actionA, consumer, route("A")), true);
  const actionB = controller.start("route_B");
  assert.equal(publishRoute(controller, actionB, consumer, route("B")), true);
  assert.equal(consumer.layer, "layer-B");
  assert.equal(consumer.etaMinutes, 22);
  assert.equal(consumer.distanceMiles, 12.25);
});

test("stale failure after B is current cannot publish an error or clear B", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const actionA = controller.start("route_A");
  const actionB = controller.start("route_B");
  publishRoute(controller, actionB, consumer, route("B"));
  const published = controller.publish(actionA, () => { Object.assign(consumer, emptyConsumer(), { error: "Route A failed" }); });
  assert.equal(published, false);
  assert.equal(consumer.layer, "layer-B");
  assert.equal(consumer.error, "");
});

test("timeout completion after Clear remains suppressed", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const action = controller.start("route_timeout");
  controller.invalidate("clear");
  controller.publish(action, () => { consumer.error = "request aborted"; consumer.layer = "fallback"; });
  assert.deepEqual(consumer, emptyConsumer());
  assert.equal(controller.audit().lastSuppressionReason, "superseded_before_publication");
});

test("Route Watch activation cannot revive a stale destination", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const stale = controller.start("watch_A");
  controller.start("preview_B");
  publishRoute(controller, stale, consumer, route("A"), true);
  assert.equal(consumer.routeWatchActive, false);
  assert.equal(consumer.destination, null);
});

test("normal current request publishes successfully", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const action = controller.start("route_preview");
  assert.equal(publishRoute(controller, action, consumer, route("A")), true);
  assert.equal(consumer.layer, "layer-A");
  assert.equal(controller.audit().publishedCompletionCount, 1);
});

test("saved-coordinate destination parity is unchanged at publication", () => {
  const controller = contract.createController();
  const consumer = emptyConsumer();
  const exactDestination = { lat: 30.0588518, lng: -94.7978967 };
  const value = route("saved", { lat: 30.13078, lng: -94.9318 }, exactDestination);
  publishRoute(controller, controller.start("saved_destination"), consumer, value);
  assert.deepEqual(consumer.destination, { ...exactDestination, name: "saved" });
  assert.deepEqual(consumer.geometry.at(-1), [exactDestination.lat, exactDestination.lng]);
});

test("Map Center and Current Location origin ownership remains exact", () => {
  for (const [source, origin] of [["Map Center", { lat: 30.20, lng: -94.70 }], ["Current Location", { lat: 30.21, lng: -94.71 }]]) {
    const controller = contract.createController();
    const consumer = emptyConsumer();
    const value = route(source, origin);
    publishRoute(controller, controller.start(source), consumer, value);
    assert.deepEqual(consumer.origin, origin);
    assert.deepEqual(consumer.geometry[0], [origin.lat, origin.lng]);
  }
});

test("same-route rapid-repeat suppression remains endpoint and time scoped", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  assert.match(app, /routeRequestInFlight && requestKey === lastRouteRequestKey && \(nowMs - lastRouteRequestAt\) < 1500/);
  assert.match(app, /duplicateRouteRequestBlockedCount \+= 1/);
});

test("production route publishers and invalidators use the shared authority", () => {
  const app = fs.readFileSync("js/app.js", "utf8");
  const index = fs.readFileSync("index.html", "utf8");
  assert.match(index, /gridly-route-publication-ownership\.js\?v=2448/);
  assert.match(app, /gridlyRoutePublicationOwnershipAudit/);
  assert.match(app, /invalidateGridlyRoutePublication\("clear"\)/);
  assert.match(app, /invalidateGridlyRoutePublication\("stop"\)/);
  assert.match(app, /guardGridlyRoutePublication/);
  assert.match(app, /publishGridlyRouteCompletion/);
});
