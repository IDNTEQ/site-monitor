import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";
import { createMonitorService } from "../src/services/monitor-service.js";
import { createCheckWorkerService } from "../src/services/check-worker-service.js";

function createWorkerBundle(fetchCheck) {
  const repository = new InMemoryMonitorRepository();
  const monitorService = createMonitorService({
    repository,
  });
  const workerService = createCheckWorkerService({
    repository,
    fetchCheck,
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
