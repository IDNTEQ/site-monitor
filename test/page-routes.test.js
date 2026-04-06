import test from "node:test";
import assert from "node:assert/strict";

import { handlePageRequest } from "../src/http/app.js";
import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";
import { createMonitorService } from "../src/services/monitor-service.js";

function createServiceBundle() {
  const repository = new InMemoryMonitorRepository();
  return {
    repository,
    service: createMonitorService({
      repository,
      clock: () => new Date("2026-04-06T12:05:00.000Z"),
    }),
  };
}

test("GET /dashboard renders accessible filters, summary labels, and detail links", async () => {
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

  const result = await handlePageRequest({
    service,
    method: "GET",
    pathname: "/dashboard",
    searchParams: new URLSearchParams({
      asOf: "2026-04-06T12:05:00.000Z",
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.equal(result.contentType, "text/html; charset=utf-8");
  assert.match(result.body, /<main id="main-content">/);
  assert.match(result.body, /<label for="environment-filter">Environment<\/label>/);
  assert.match(result.body, /aria-live="polite"/);
  assert.match(result.body, /Open incidents/);
  assert.match(result.body, new RegExp(`/monitors/${healthy.id}`));
  assert.match(result.body, /<span aria-hidden="true">o<\/span> Healthy/);
  assert.match(result.body, /<span aria-hidden="true">!<\/span> Critical/);
  assert.match(result.body, /\/incidents\/INC-204/);
});

test("GET /monitors/:monitorId renders monitor detail with descriptive action labels and tabular history", async () => {
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
    keyword: "healthy",
    tags: ["checkout"],
    alertPolicy: {
      failureThreshold: 2,
      recoveryThreshold: 1,
      notificationChannels: ["email"],
      escalationTarget: "on-call-primary",
    },
  });

  await repository.update({
    ...(await repository.getById(monitor.id)),
    lastCheckAt: "2026-04-06T12:04:00.000Z",
    responseTimeMs: 180,
    currentIncident: {
      id: "INC-301",
      state: "open",
      openedAt: "2026-04-06T12:01:00.000Z",
      muted: false,
    },
    checkResults: [
      {
        id: "chk-2",
        statusCode: 200,
        responseTimeMs: 180,
        outcome: "success",
        checkedAt: "2026-04-06T12:04:00.000Z",
        errorClass: null,
        matchingRuleResult: "matched",
      },
      {
        id: "chk-1",
        statusCode: 500,
        responseTimeMs: 1200,
        outcome: "failure",
        checkedAt: "2026-04-06T12:03:00.000Z",
        errorClass: "HTTP_5XX",
        matchingRuleResult: "status_mismatch",
      },
    ],
  });

  const result = await handlePageRequest({
    service,
    method: "GET",
    pathname: `/monitors/${monitor.id}`,
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /<h1>Monitor Detail<\/h1>/);
  assert.match(result.body, /Checkout/);
  assert.match(
    result.body,
    /<button type="submit" name="action" value="pause">Pause monitor<\/button>/,
  );
  assert.match(
    result.body,
    /<button type="submit" name="action" value="archive">Archive monitor<\/button>/,
  );
  assert.match(result.body, /Recent check history/);
  assert.match(result.body, /<table>/);
  assert.match(result.body, /Latest incident/);
  assert.match(result.body, /\/incidents\/INC-301/);
});

test("GET /incidents/:incidentId renders explicit action labels and source-order timeline", async () => {
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
    currentIncident: {
      id: "INC-204",
      state: "acknowledged",
      openedAt: "2026-04-06T11:55:00.000Z",
      muted: false,
    },
    incidents: [
      {
        id: "INC-204",
        state: "acknowledged",
        firstFailureAt: "2026-04-06T11:50:00.000Z",
        openedAt: "2026-04-06T11:55:00.000Z",
        acknowledgedAt: "2026-04-06T11:58:00.000Z",
        resolvedAt: null,
        muted: false,
        latestCheckResults: [
          {
            id: "chk-older",
            statusCode: 500,
            responseTimeMs: 1400,
            errorClass: "HTTP_5XX",
            matchingRuleResult: "status_mismatch",
            checkedAt: "2026-04-06T11:56:00.000Z",
          },
        ],
        deliveryHistory: [
          {
            channel: "email",
            status: "delivered",
            deliveredAt: "2026-04-06T11:55:30.000Z",
          },
        ],
        timeline: [
          {
            eventType: "acknowledged",
            actor: "alice",
            note: "Taking point",
            createdAt: "2026-04-06T11:58:00.000Z",
          },
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

  const result = await handlePageRequest({
    service,
    method: "GET",
    pathname: "/incidents/INC-204",
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /<h1>Incident Detail<\/h1>/);
  assert.match(
    result.body,
    /<button type="submit" name="action" value="acknowledge">Acknowledge incident<\/button>/,
  );
  assert.match(
    result.body,
    /<button type="submit" name="action" value="mute">Mute alerts for this incident<\/button>/,
  );
  assert.match(result.body, /<label for="actor">Operator name<\/label>/);
  assert.match(result.body, /Delivery history/);
  assert.match(result.body, /delivered/);
  assert.ok(
    result.body.indexOf("Threshold breached") < result.body.indexOf("Taking point"),
  );
});

test("POST /incidents/:incidentId/actions redirects after applying a form action", async () => {
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
    currentIncident: {
      id: "INC-204",
      state: "open",
      openedAt: "2026-04-06T11:55:00.000Z",
      muted: false,
    },
    incidents: [
      {
        id: "INC-204",
        state: "open",
        firstFailureAt: "2026-04-06T11:50:00.000Z",
        openedAt: "2026-04-06T11:55:00.000Z",
        acknowledgedAt: null,
        resolvedAt: null,
        muted: false,
        latestCheckResults: [],
        deliveryHistory: [],
        timeline: [],
      },
    ],
  });

  const result = await handlePageRequest({
    service,
    method: "POST",
    pathname: "/incidents/INC-204/actions",
    body: {
      action: "acknowledge",
      actor: "alice",
      note: "Taking point",
    },
  });

  assert.equal(result.statusCode, 303);
  assert.equal(result.headers.location, "/incidents/INC-204");
});
