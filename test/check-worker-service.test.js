import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";
import { createMonitorService } from "../src/services/monitor-service.js";
import { createCheckWorkerService } from "../src/services/check-worker-service.js";
import { createAlertDeliveryService } from "../src/services/alert-delivery.js";

function createWorkerBundle(fetchCheck, options = {}) {
  const repository = new InMemoryMonitorRepository();
  const monitorService = createMonitorService({
    repository,
  });
  const workerService = createCheckWorkerService({
    repository,
    fetchCheck,
    alertDelivery: options.alertDelivery,
  });

  return {
    repository,
    monitorService,
    workerService,
  };
}

test("opens an incident on the scheduled run where the failure threshold is breached", async () => {
  const responses = [
    {
      statusCode: 500,
      responseTimeMs: 1800,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    },
    {
      statusCode: 502,
      responseTimeMs: 2100,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    },
  ];

  const { repository, monitorService, workerService } = createWorkerBundle(async () => {
    const response = responses.shift();
    if (!response) {
      throw new Error("No response fixture remaining.");
    }
    return response;
  });

  const monitor = await monitorService.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com/checkout",
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
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");
  await workerService.runDueMonitors("2026-04-06T12:01:00.000Z");

  const stored = await repository.getById(monitor.id);
  assert.equal(stored.checkResults.length, 2);
  assert.equal(stored.currentIncident.state, "open");
  assert.equal(stored.currentIncident.openedAt, "2026-04-06T12:01:00.000Z");
  assert.equal(stored.incidents.length, 1);
  assert.equal(stored.incidents[0].firstFailureAt, "2026-04-06T12:00:00.000Z");
  assert.equal(stored.incidents[0].openedAt, "2026-04-06T12:01:00.000Z");
  assert.ok(
    Date.parse(stored.incidents[0].openedAt) - Date.parse("2026-04-06T12:01:00.000Z") <=
      90_000,
  );
});

test("does not re-run a monitor before its interval elapses", async () => {
  let checksRun = 0;
  const { repository, monitorService, workerService } = createWorkerBundle(async () => {
    checksRun += 1;
    return {
      statusCode: 200,
      responseTimeMs: 120,
      errorClass: null,
      matchingRuleResult: "matched",
    };
  });

  const monitor = await monitorService.createMonitor({
    name: "Homepage",
    environment: "production",
    url: "https://example.com",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");
  await workerService.runDueMonitors("2026-04-06T12:00:30.000Z");

  const stored = await repository.getById(monitor.id);
  assert.equal(checksRun, 1);
  assert.equal(stored.checkResults.length, 1);
  assert.equal(stored.currentIncident ?? null, null);
});

test("records a missed execution in the worker audit and continues other due checks", async () => {
  const { repository, monitorService, workerService } = createWorkerBundle(async (monitor) => {
    if (monitor.name === "Catalog") {
      throw new Error("socket hang up");
    }

    return {
      statusCode: 200,
      responseTimeMs: 180,
      errorClass: null,
      matchingRuleResult: "matched",
    };
  });

  const catalogMonitor = await monitorService.createMonitor({
    name: "Catalog",
    environment: "production",
    url: "https://example.com/catalog",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });
  const checkoutMonitor = await monitorService.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com/checkout",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  const runResults = await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");
  const reliabilitySummary = await workerService.getReliabilitySummary({
    startedAt: "2026-04-06T00:00:00.000Z",
    endedAt: "2026-04-06T23:59:59.999Z",
  });

  const storedCatalog = await repository.getById(catalogMonitor.id);
  const storedCheckout = await repository.getById(checkoutMonitor.id);

  assert.equal(runResults.length, 2);
  assert.equal(
    runResults.find((result) => result.monitorId === catalogMonitor.id)?.status,
    "missed",
  );
  assert.equal(
    runResults.find((result) => result.monitorId === checkoutMonitor.id)?.status,
    "completed",
  );
  assert.equal(storedCatalog.checkResults?.length ?? 0, 0);
  assert.equal(storedCheckout.checkResults.length, 1);

  assert.equal(reliabilitySummary.totals.scheduledChecks, 2);
  assert.equal(reliabilitySummary.totals.completedChecks, 1);
  assert.equal(reliabilitySummary.totals.missedChecks, 1);
  assert.equal(reliabilitySummary.totals.completionRate, 0.5);
  assert.equal(reliabilitySummary.totals.meetsTarget, false);
  assert.equal(reliabilitySummary.runs.length, 1);
  assert.deepEqual(
    reliabilitySummary.runs[0].monitorAudits.map((audit) => ({
      monitorId: audit.monitorId,
      status: audit.status,
    })),
    [
      {
        monitorId: catalogMonitor.id,
        status: "missed",
      },
      {
        monitorId: checkoutMonitor.id,
        status: "completed",
      },
    ],
  );
});

test("filters reliability metrics to the requested audit window", async () => {
  const { workerService, monitorService } = createWorkerBundle(async () => ({
    statusCode: 200,
    responseTimeMs: 120,
    errorClass: null,
    matchingRuleResult: "matched",
  }));

  await monitorService.createMonitor({
    name: "Homepage",
    environment: "production",
    url: "https://example.com",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await workerService.runDueMonitors("2026-04-01T12:00:00.000Z");
  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");

  const reliabilitySummary = await workerService.getReliabilitySummary({
    startedAt: "2026-04-05T00:00:00.000Z",
    endedAt: "2026-04-06T23:59:59.999Z",
  });

  assert.equal(reliabilitySummary.runs.length, 1);
  assert.equal(reliabilitySummary.runs[0].checkedAt, "2026-04-06T12:00:00.000Z");
  assert.equal(reliabilitySummary.totals.scheduledChecks, 1);
  assert.equal(reliabilitySummary.totals.completedChecks, 1);
  assert.equal(reliabilitySummary.totals.missedChecks, 0);
  assert.equal(reliabilitySummary.totals.completionRate, 1);
  assert.equal(reliabilitySummary.totals.meetsTarget, true);
});

test("delivers a webhook and records delivery history when an incident opens", async () => {
  const deliveries = [];
  const alertDelivery = createAlertDeliveryService({
    httpPost: async (url, body) => {
      deliveries.push({
        url,
        body,
      });
      return {
        statusCode: 202,
      };
    },
    now: () => new Date("2026-04-06T12:00:05.000Z"),
  });
  const { repository, monitorService, workerService } = createWorkerBundle(
    async () => ({
      statusCode: 500,
      responseTimeMs: 1500,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    }),
    {
      alertDelivery,
    },
  );

  const monitor = await monitorService.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com/checkout",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    alertPolicy: {
      failureThreshold: 1,
      recoveryThreshold: 1,
      notificationChannels: ["webhook"],
      escalationTarget: "on-call-primary",
      endpoints: [
        {
          id: "hook-1",
          type: "webhook",
          url: "https://hooks.example.com/site-monitor",
        },
      ],
    },
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");

  const stored = await repository.getById(monitor.id);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].url, "https://hooks.example.com/site-monitor");
  assert.deepEqual(deliveries[0].body, {
    eventType: "incident_opened",
    monitorId: monitor.id,
    monitorName: "Checkout",
    incidentId: stored.incidents[0].id,
    openedAt: "2026-04-06T12:00:00.000Z",
    url: "https://example.com/checkout",
  });
  assert.deepEqual(stored.incidents[0].deliveryHistory, [
    {
      endpointId: "hook-1",
      eventType: "incident_opened",
      deliveredAt: "2026-04-06T12:00:05.000Z",
      statusCode: 202,
    },
  ]);
});

test("delivers a webhook when the worker auto-resolves an incident", async () => {
  const deliveries = [];
  const alertDelivery = createAlertDeliveryService({
    httpPost: async (url, body) => {
      deliveries.push({
        url,
        body,
      });
      return 200;
    },
    now: () => new Date("2026-04-06T12:01:05.000Z"),
  });
  const responses = [
    {
      statusCode: 500,
      responseTimeMs: 1500,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    },
    {
      statusCode: 200,
      responseTimeMs: 120,
      errorClass: null,
      matchingRuleResult: "matched",
    },
  ];
  const { repository, monitorService, workerService } = createWorkerBundle(
    async () => responses.shift(),
    {
      alertDelivery,
    },
  );

  const monitor = await monitorService.createMonitor({
    name: "Billing",
    environment: "production",
    url: "https://example.com/billing",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    alertPolicy: {
      failureThreshold: 1,
      recoveryThreshold: 1,
      notificationChannels: ["webhook"],
      escalationTarget: "on-call-primary",
      endpoints: [
        {
          id: "hook-1",
          type: "webhook",
          url: "https://hooks.example.com/site-monitor",
        },
      ],
    },
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");
  await workerService.runDueMonitors("2026-04-06T12:01:00.000Z");

  const stored = await repository.getById(monitor.id);
  assert.deepEqual(
    deliveries.map((delivery) => delivery.body.eventType),
    ["incident_opened", "incident_resolved"],
  );
  assert.equal(stored.currentIncident.state, "resolved");
  assert.equal(stored.incidents[0].resolvedAt, "2026-04-06T12:01:00.000Z");
  assert.deepEqual(
    stored.incidents[0].deliveryHistory.map((delivery) => delivery.eventType),
    ["incident_opened", "incident_resolved"],
  );
});

test("does not deliver webhooks while a maintenance window is active", async () => {
  const deliveries = [];
  const alertDelivery = createAlertDeliveryService({
    httpPost: async (url, body) => {
      deliveries.push({
        url,
        body,
      });
      return 202;
    },
  });
  const { repository, monitorService, workerService } = createWorkerBundle(
    async () => ({
      statusCode: 500,
      responseTimeMs: 1500,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    }),
    {
      alertDelivery,
    },
  );

  const monitor = await monitorService.createMonitor({
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
      notificationChannels: ["webhook"],
      escalationTarget: "on-call-primary",
      endpoints: [
        {
          id: "hook-1",
          type: "webhook",
          url: "https://hooks.example.com/site-monitor",
        },
      ],
    },
  });
  await monitorService.createMaintenanceWindow(monitor.id, {
    startsAt: "2026-04-06T11:30:00.000Z",
    endsAt: "2026-04-06T12:30:00.000Z",
    reason: "Search reindex",
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");

  const stored = await repository.getById(monitor.id);
  assert.equal(stored.incidents.length, 1);
  assert.deepEqual(stored.incidents[0].deliveryHistory, []);
  assert.deepEqual(deliveries, []);
});

test("records webhook delivery errors in incident delivery history", async () => {
  const alertDelivery = createAlertDeliveryService({
    httpPost: async () => {
      const error = new Error("Timed out");
      error.name = "TimeoutError";
      throw error;
    },
    now: () => new Date("2026-04-06T12:00:05.000Z"),
  });
  const { repository, monitorService, workerService } = createWorkerBundle(
    async () => ({
      statusCode: 500,
      responseTimeMs: 1500,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
    }),
    {
      alertDelivery,
    },
  );

  const monitor = await monitorService.createMonitor({
    name: "Catalog",
    environment: "production",
    url: "https://example.com/catalog",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    alertPolicy: {
      failureThreshold: 1,
      recoveryThreshold: 1,
      notificationChannels: ["webhook"],
      escalationTarget: "on-call-primary",
      endpoints: [
        {
          id: "hook-1",
          type: "webhook",
          url: "https://hooks.example.com/site-monitor",
        },
      ],
    },
  });

  await workerService.runDueMonitors("2026-04-06T12:00:00.000Z");

  const stored = await repository.getById(monitor.id);
  assert.deepEqual(stored.incidents[0].deliveryHistory, [
    {
      endpointId: "hook-1",
      eventType: "incident_opened",
      deliveredAt: "2026-04-06T12:00:05.000Z",
      statusCode: 0,
      errorClass: "TimeoutError",
    },
  ]);
});
