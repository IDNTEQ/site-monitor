import test from "node:test";
import assert from "node:assert/strict";
import { createDashboardData, filterMonitors } from "../src/dashboard-data.mjs";
import { renderDashboardPage } from "../src/dashboard-page.mjs";

test("dashboard fixture represents a 30-day dataset slice", () => {
  const data = createDashboardData();

  assert.equal(data.dataset.spanDays, 30);
  assert.equal(data.monitors.length, 180);
  assert.equal(data.dataset.monitorCount, data.monitors.length);
});

test("summary counts stay aligned with monitor records", () => {
  const data = createDashboardData();
  const countedStatuses =
    data.summary.healthy + data.summary.degraded + data.summary.incident + data.summary.paused;

  assert.equal(countedStatuses, data.monitors.length);
  assert.ok(data.summary.openIncidents >= data.incidents.length);
  assert.ok(data.incidents.every((incident) => incident.id.startsWith("INC-")));
});

test("filters reduce the monitor list without mutating the source dataset", () => {
  const data = createDashboardData();
  const originalLength = data.monitors.length;
  const filtered = filterMonitors(data.monitors, {
    environment: "production",
    status: "incident",
    tag: "catalog",
    incidentState: "open"
  });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every((monitor) => monitor.environment === "production"));
  assert.ok(filtered.every((monitor) => monitor.status === "incident"));
  assert.ok(filtered.every((monitor) => monitor.tag === "catalog"));
  assert.ok(filtered.every((monitor) => monitor.incidentState === "open"));
  assert.equal(data.monitors.length, originalLength);
});

test("server-rendered dashboard keeps the initial payload within budget", () => {
  const html = renderDashboardPage();
  const bytes = Buffer.byteLength(html, "utf8");

  assert.match(html, /<section class="metrics"/);
  assert.match(html, /<tbody id="monitor-rows">/);
  assert.match(html, /<div id="incident-list" class="incident-list">/);
  assert.ok(bytes < 140000, `expected HTML payload under 140000 bytes, received ${bytes}`);
});
