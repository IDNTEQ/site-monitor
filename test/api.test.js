import test from "node:test";
import assert from "node:assert/strict";

import { handleApiRequest } from "../src/http/app.js";
import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";
import { createMonitorService } from "../src/services/monitor-service.js";

function createService() {
  return createServiceBundle().service;
}

function createServiceBundle() {
  const repository = new InMemoryMonitorRepository();
  return {
    repository,
    service: createMonitorService({
      repository,
    }),
  };
}

test("POST /api/monitors creates a monitor", async () => {
  const result = await handleApiRequest({
    service: createService(),
    method: "POST",
    pathname: "/api/monitors",
    body: {
      name: "Homepage",
      environment: "production",
      url: "https://example.com",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.payload.monitor.name, "Homepage");
  assert.equal(result.payload.monitor.status, "active");
});

test("PATCH /api/monitors/:monitorId returns validation errors", async () => {
  const service = createService();
  const created = await handleApiRequest({
    service,
    method: "POST",
    pathname: "/api/monitors",
    body: {
      name: "Payments",
      environment: "production",
      url: "https://example.com/payments",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
    },
  });

  await assert.rejects(
    handleApiRequest({
      service,
      method: "PATCH",
      pathname: `/api/monitors/${created.payload.monitor.id}`,
      body: {
        action: "pause",
        timeoutMs: 25,
      },
    }),
    (error) => {
      assert.deepEqual(error.fieldErrors, {
        timeoutMs: "Timeout must be between 100 and 30000 milliseconds.",
      });
      return true;
    },
  );
});

test("POST /api/monitors/:monitorId/maintenance-windows creates a maintenance window", async () => {
  const service = createService();
  const created = await handleApiRequest({
    service,
    method: "POST",
    pathname: "/api/monitors",
    body: {
      name: "Search",
      environment: "production",
      url: "https://example.com/search",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      alertPolicy: {
        failureThreshold: 1,
        recoveryThreshold: 1,
        notificationChannels: ["email"],
        escalationTarget: "on-call-primary",
      },
    },
  });

  const result = await handleApiRequest({
    service,
    method: "POST",
    pathname: `/api/monitors/${created.payload.monitor.id}/maintenance-windows`,
    body: {
      startsAt: "2026-04-06T10:00:00.000Z",
      endsAt: "2026-04-06T14:00:00.000Z",
      reason: "Search reindex",
    },
  });

  assert.equal(result.statusCode, 201);
  assert.equal(result.payload.maintenanceWindow.reason, "Search reindex");
});

test("POST /api/monitors/:monitorId/policy-preview returns a preview decision", async () => {
  const service = createService();
  const created = await handleApiRequest({
    service,
    method: "POST",
    pathname: "/api/monitors",
    body: {
      name: "Billing",
      environment: "production",
      url: "https://example.com/billing",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 1000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      alertPolicy: {
        failureThreshold: 2,
        recoveryThreshold: 1,
        notificationChannels: ["email"],
        escalationTarget: "on-call-primary",
      },
    },
  });

  const result = await handleApiRequest({
    service,
    method: "POST",
    pathname: `/api/monitors/${created.payload.monitor.id}/policy-preview`,
    body: {
      sample: "failure",
      consecutiveFailures: 2,
      evaluatedAt: "2026-04-06T12:00:00.000Z",
    },
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.preview, {
    wouldNotify: true,
    status: "notify",
    reason: "Failure threshold met.",
  });
});

test("GET /api/dashboard returns filtered monitor rows and open incident previews", async () => {
  const { service, repository } = createServiceBundle();
  const healthy = await service.createMonitor({
    name: "Homepage",
    environment: "production",
    url: "https://example.com",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["web"],
  });
  const incident = await service.createMonitor({
    name: "Billing",
    environment: "production",
    url: "https://example.com/billing",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["payments"],
  });

  await repository.update({
    ...(await repository.getById(healthy.id)),
    healthState: "healthy",
    recentIncidentState: "resolved",
    lastCheckAt: "2026-04-06T12:00:00.000Z",
    responseTimeMs: 120,
  });
  await repository.update({
    ...(await repository.getById(incident.id)),
    healthState: "degraded",
    recentIncidentState: "open",
    currentIncident: {
      id: "INC-204",
      state: "open",
      severity: "critical",
      openedAt: "2026-04-06T11:55:00.000Z",
    },
    lastCheckAt: "2026-04-06T12:03:00.000Z",
    responseTimeMs: 0,
  });

  const result = await handleApiRequest({
    service,
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
    paused: 0,
    incident: 1,
  });
  assert.equal(result.payload.dashboard.monitors.length, 1);
  assert.equal(result.payload.dashboard.monitors[0].id, healthy.id);
  assert.deepEqual(result.payload.dashboard.openIncidents, [
    {
      id: "INC-204",
      monitorId: incident.id,
      monitorName: "Billing",
      state: "open",
      severity: "critical",
      openedAt: "2026-04-06T11:55:00.000Z",
      link: "/incidents/INC-204",
    },
  ]);
  assert.deepEqual(result.payload.dashboard.dataset, {
    asOf: "2026-04-06T12:05:00.000Z",
    startedAt: "2026-03-07T12:05:00.000Z",
    days: 30,
    monitorLimit: 50,
    incidentLimit: 10,
    totalMonitorRows: 1,
    totalOpenIncidents: 1,
    truncatedMonitors: false,
    truncatedOpenIncidents: false,
  });
});

test("GET /api/dashboard applies dataset and payload limit query params", async () => {
  const { service, repository } = createServiceBundle();
  const recentHealthy = await service.createMonitor({
    name: "Homepage",
    environment: "production",
    url: "https://example.com",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["web"],
  });
  const recentIncident = await service.createMonitor({
    name: "Billing",
    environment: "production",
    url: "https://example.com/billing",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["payments"],
  });
  const staleMonitor = await service.createMonitor({
    name: "Legacy",
    environment: "production",
    url: "https://example.com/legacy",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["legacy"],
  });

  await repository.update({
    ...(await repository.getById(recentHealthy.id)),
    healthState: "healthy",
    recentIncidentState: "resolved",
    lastCheckAt: "2026-04-06T12:04:00.000Z",
    responseTimeMs: 120,
  });
  await repository.update({
    ...(await repository.getById(recentIncident.id)),
    healthState: "degraded",
    recentIncidentState: "open",
    currentIncident: {
      id: "INC-501",
      state: "open",
      severity: "critical",
      openedAt: "2026-04-06T12:03:00.000Z",
    },
    lastCheckAt: "2026-04-06T12:03:00.000Z",
    responseTimeMs: 0,
  });
  await repository.update({
    ...(await repository.getById(staleMonitor.id)),
    healthState: "healthy",
    recentIncidentState: "resolved",
    lastCheckAt: "2026-02-20T08:00:00.000Z",
    responseTimeMs: 140,
  });

  const result = await handleApiRequest({
    service,
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
  assert.equal(result.payload.dashboard.monitors[0].id, recentHealthy.id);
  assert.equal(result.payload.dashboard.openIncidents.length, 1);
  assert.equal(result.payload.dashboard.openIncidents[0].id, "INC-501");
  assert.deepEqual(result.payload.dashboard.dataset, {
    asOf: "2026-04-06T12:05:00.000Z",
    startedAt: "2026-03-07T12:05:00.000Z",
    days: 30,
    monitorLimit: 1,
    incidentLimit: 1,
    totalMonitorRows: 2,
    totalOpenIncidents: 1,
    truncatedMonitors: true,
    truncatedOpenIncidents: false,
  });
});

test("GET /api/incidents/:incidentId returns incident detail", async () => {
  const { service, repository } = createServiceBundle();
  const monitor = await service.createMonitor({
    name: "Billing",
    environment: "production",
    url: "https://example.com/billing",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await repository.update({
    ...(await repository.getById(monitor.id)),
    incidents: [
      {
        id: "INC-204",
        state: "acknowledged",
        firstFailureAt: "2026-04-06T11:50:00.000Z",
        openedAt: "2026-04-06T11:55:00.000Z",
        acknowledgedAt: "2026-04-06T11:58:00.000Z",
        resolvedAt: null,
        latestCheckResults: [
          {
            id: "chk-1",
            statusCode: 500,
            responseTimeMs: 2400,
            errorClass: "HTTP_5XX",
            matchingRuleResult: "status_mismatch",
            checkedAt: "2026-04-06T11:59:00.000Z",
          },
        ],
        deliveryHistory: [
          {
            channel: "email",
            status: "sent",
            deliveredAt: "2026-04-06T11:56:30.000Z",
          },
        ],
        timeline: [
          {
            eventType: "failure_onset",
            actor: "system",
            note: "Threshold breached",
            createdAt: "2026-04-06T11:55:00.000Z",
          },
        ],
      },
    ],
  });

  const result = await handleApiRequest({
    service,
    method: "GET",
    pathname: "/api/incidents/INC-204",
  });

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.payload.incident, {
    id: "INC-204",
    state: "acknowledged",
    muted: false,
    affectedMonitor: {
      id: monitor.id,
      name: "Billing",
      environment: "production",
      url: "https://example.com/billing",
    },
    firstFailureAt: "2026-04-06T11:50:00.000Z",
    openedAt: "2026-04-06T11:55:00.000Z",
    acknowledgedAt: "2026-04-06T11:58:00.000Z",
    resolvedAt: null,
  });
  assert.deepEqual(result.payload.latestCheckResults, [
    {
      id: "chk-1",
      statusCode: 500,
      responseTimeMs: 2400,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
      checkedAt: "2026-04-06T11:59:00.000Z",
    },
  ]);
  assert.deepEqual(result.payload.timeline, [
    {
      eventType: "failure_onset",
      actor: "system",
      note: "Threshold breached",
      createdAt: "2026-04-06T11:55:00.000Z",
    },
  ]);
});

test("POST /api/incidents/:incidentId/actions applies an incident action", async () => {
  const { service, repository } = createServiceBundle();
  const monitor = await service.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com/checkout",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await repository.update({
    ...(await repository.getById(monitor.id)),
    currentIncident: {
      id: "INC-205",
      state: "open",
      openedAt: "2026-04-06T12:00:00.000Z",
    },
    recentIncidentState: "open",
    incidents: [
      {
        id: "INC-205",
        state: "open",
        muted: false,
        firstFailureAt: "2026-04-06T11:59:00.000Z",
        openedAt: "2026-04-06T12:00:00.000Z",
        acknowledgedAt: null,
        resolvedAt: null,
        latestCheckResults: [],
        deliveryHistory: [],
        timeline: [
          {
            eventType: "failure_onset",
            actor: "system",
            note: "Threshold breached",
            createdAt: "2026-04-06T12:00:00.000Z",
          },
        ],
      },
    ],
  });

  const result = await handleApiRequest({
    service,
    method: "POST",
    pathname: "/api/incidents/INC-205/actions",
    body: {
      action: "acknowledge",
      actor: "alice@example.com",
      note: "Investigating",
    },
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.incident.state, "acknowledged");
  assert.equal(result.payload.incident.muted, false);
  assert.equal(
    result.payload.timeline[result.payload.timeline.length - 1].eventType,
    "acknowledged",
  );
});
