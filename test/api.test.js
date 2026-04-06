import test from "node:test";
import assert from "node:assert/strict";

import { handleApiRequest } from "../src/http/app.js";
import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";
import { createDashboardService } from "../src/services/dashboard-service.js";

function createService() {
  const repository = new InMemoryMonitorRepository({
    monitors: [
      {
        id: "mon-homepage",
        name: "Homepage",
        environment: "production",
        url: "https://example.com",
        status: "active",
        healthState: "healthy",
        recentIncidentState: "resolved",
        tags: ["web"],
        lastCheckAt: "2026-04-06T12:04:00.000Z",
        responseTimeMs: 120,
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-06T12:04:00.000Z",
        currentIncident: null,
      },
      {
        id: "mon-billing",
        name: "Billing",
        environment: "production",
        url: "https://example.com/billing",
        status: "active",
        healthState: "degraded",
        recentIncidentState: "open",
        tags: ["payments"],
        lastCheckAt: "2026-04-06T12:03:00.000Z",
        responseTimeMs: 0,
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-06T12:03:00.000Z",
        currentIncident: {
          id: "INC-204",
          state: "open",
          severity: "critical",
          openedAt: "2026-04-06T11:55:00.000Z",
        },
      },
      {
        id: "mon-search",
        name: "Search",
        environment: "staging",
        url: "https://staging.example.com/search",
        status: "paused",
        healthState: "healthy",
        recentIncidentState: "none",
        tags: ["search"],
        lastCheckAt: "2026-04-06T11:00:00.000Z",
        responseTimeMs: 142,
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-06T11:00:00.000Z",
        currentIncident: null,
      },
    ],
  });

  return createDashboardService({
    repository,
    clock: () => new Date("2026-04-06T12:05:00.000Z"),
  });
}

test("GET /api/dashboard returns summary counts, filtered rows, and open incidents", async () => {
  const result = await handleApiRequest({
    service: createService(),
    method: "GET",
    pathname: "/api/dashboard",
    searchParams: new URLSearchParams({
      asOf: "2026-04-06T12:05:00.000Z",
      environment: "production",
      status: "healthy",
      tag: "web",
      recentIncidentState: "resolved",
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.dashboard.summary, {
    healthy: 1,
    degraded: 0,
    paused: 1,
    incident: 1,
  });
  assert.equal(result.payload.dashboard.monitors.length, 1);
  assert.equal(result.payload.dashboard.monitors[0].id, "mon-homepage");
  assert.deepEqual(result.payload.dashboard.openIncidents, [
    {
      id: "INC-204",
      monitorId: "mon-billing",
      monitorName: "Billing",
      state: "open",
      severity: "critical",
      openedAt: "2026-04-06T11:55:00.000Z",
      link: "/incidents/INC-204",
    },
  ]);
});

test("GET /api/dashboard applies dataset window and payload limits", async () => {
  const result = await handleApiRequest({
    service: createService(),
    method: "GET",
    pathname: "/api/dashboard",
    searchParams: new URLSearchParams({
      asOf: "2026-04-06T12:05:00.000Z",
      datasetDays: "30",
      monitorLimit: "1",
      incidentLimit: "1",
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.dashboard.monitors.length, 1);
  assert.equal(result.payload.dashboard.openIncidents.length, 1);
  assert.deepEqual(result.payload.dashboard.dataset, {
    asOf: "2026-04-06T12:05:00.000Z",
    startedAt: "2026-03-07T12:05:00.000Z",
    days: 30,
    monitorLimit: 1,
    incidentLimit: 1,
    totalMonitorRows: 3,
    totalOpenIncidents: 1,
    truncatedMonitors: true,
    truncatedOpenIncidents: false,
  });
});
