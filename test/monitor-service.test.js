import test from "node:test";
import assert from "node:assert/strict";

import {
  createMonitorService,
  MonitorValidationError,
} from "../src/services/monitor-service.js";
import { InMemoryMonitorRepository } from "../src/repositories/in-memory-monitor-repository.js";

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

test("creates a monitor with normalized defaults", async () => {
  const service = createService();

  const monitor = await service.createMonitor({
    name: "Checkout Health",
    environment: "production",
    url: "https://example.com/health",
    method: "get",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    keyword: "healthy",
    tags: ["checkout", "prod"],
  });

  assert.equal(monitor.status, "active");
  assert.equal(monitor.method, "GET");
  assert.deepEqual(monitor.tags, ["checkout", "prod"]);
  assert.match(monitor.id, /^[0-9a-f-]{36}$/);
});

test("encrypts monitor and notification secrets at rest and never returns them in plaintext", async () => {
  const { service, repository } = createServiceBundle();

  const monitor = await service.createMonitor({
    name: "Authenticated API",
    environment: "production",
    url: "https://example.com/private",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    authSecret: "monitor-shared-secret",
    alertPolicy: {
      failureThreshold: 2,
      recoveryThreshold: 1,
      notificationChannels: ["email", "pagerduty"],
      escalationTarget: "on-call-primary",
      notificationCredentials: {
        email: "smtp-password",
        pagerduty: "routing-key",
      },
    },
  });

  const stored = await repository.getById(monitor.id);

  assert.equal(monitor.authSecretConfigured, true);
  assert.equal("authSecret" in monitor, false);
  assert.deepEqual(monitor.alertPolicy.notificationCredentialChannels, [
    "email",
    "pagerduty",
  ]);
  assert.equal("notificationCredentials" in monitor.alertPolicy, false);

  assert.equal(typeof stored.authSecretEncrypted, "string");
  assert.notEqual(stored.authSecretEncrypted, "monitor-shared-secret");
  assert.equal(typeof stored.alertPolicy.notificationCredentialsEncrypted.email, "string");
  assert.notEqual(
    stored.alertPolicy.notificationCredentialsEncrypted.email,
    "smtp-password",
  );
  assert.equal(typeof stored.alertPolicy.notificationCredentialsEncrypted.pagerduty, "string");
  assert.notEqual(
    stored.alertPolicy.notificationCredentialsEncrypted.pagerduty,
    "routing-key",
  );
});

test("returns field-level validation errors for invalid monitor input", async () => {
  const service = createService();

  await assert.rejects(
    service.createMonitor({
      name: "",
      environment: "",
      url: "not-a-url",
      method: "TRACE",
      intervalSeconds: 0,
      timeoutMs: 50,
      expectedStatusMin: 600,
      expectedStatusMax: 100,
      keyword: 123,
      tags: ["ok", ""],
    }),
    (error) => {
      assert.ok(error instanceof MonitorValidationError);
      assert.deepEqual(error.fieldErrors, {
        name: "Name is required.",
        environment: "Environment is required.",
        url: "URL must be an absolute HTTP or HTTPS URL.",
        method: "Method must be one of GET, HEAD, POST, PUT, PATCH, DELETE, or OPTIONS.",
        intervalSeconds: "Interval must be at least 10 seconds.",
        timeoutMs: "Timeout must be between 100 and 30000 milliseconds.",
        expectedStatusMin: "Expected status minimum must be between 100 and 599.",
        expectedStatusMax: "Expected status maximum must be greater than or equal to expectedStatusMin and no more than 599.",
        keyword: "Keyword must be a string when provided.",
        tags: "Tags must contain non-empty strings.",
      });
      return true;
    },
  );
});

test("supports edit, pause, resume, and archive transitions", async () => {
  const service = createService();
  const created = await service.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1500,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  const paused = await service.updateMonitor(created.id, {
    action: "pause",
  });
  assert.equal(paused.status, "paused");

  const resumed = await service.updateMonitor(created.id, {
    action: "resume",
    timeoutMs: 2000,
    keyword: "ok",
  });
  assert.equal(resumed.status, "active");
  assert.equal(resumed.timeoutMs, 2000);
  assert.equal(resumed.keyword, "ok");

  const archived = await service.updateMonitor(created.id, {
    action: "archive",
  });
  assert.equal(archived.status, "archived");

  await assert.rejects(
    service.updateMonitor(created.id, {
      action: "resume",
    }),
    (error) => {
      assert.ok(error instanceof MonitorValidationError);
      assert.deepEqual(error.fieldErrors, {
        action: "Archived monitors cannot transition to another status.",
      });
      return true;
    },
  );
});

test("returns only active monitors for future scheduling", async () => {
  const service = createService();

  const active = await service.createMonitor({
    name: "API",
    environment: "production",
    url: "https://example.com/api",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });
  const paused = await service.createMonitor({
    name: "Admin",
    environment: "staging",
    url: "https://example.com/admin",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });
  const archived = await service.createMonitor({
    name: "Legacy",
    environment: "production",
    url: "https://example.com/legacy",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await service.updateMonitor(paused.id, { action: "pause" });
  await service.updateMonitor(archived.id, { action: "archive" });

  const runnable = await service.listRunnableMonitors();

  assert.deepEqual(
    runnable.map((monitor) => monitor.id),
    [active.id],
  );
});

test("configures alert policy and previews notify versus suppress decisions", async () => {
  const service = createService();
  const created = await service.createMonitor({
    name: "Checkout",
    environment: "production",
    url: "https://example.com/checkout",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
  });

  await assert.rejects(
    service.updateMonitor(created.id, {
      alertPolicy: {
        failureThreshold: 0,
        recoveryThreshold: 0,
        notificationChannels: [],
        escalationTarget: "",
      },
    }),
    (error) => {
      assert.ok(error instanceof MonitorValidationError);
      assert.deepEqual(error.fieldErrors, {
        "alertPolicy.failureThreshold":
          "Failure threshold must be an integer greater than or equal to 1.",
        "alertPolicy.recoveryThreshold":
          "Recovery threshold must be an integer greater than or equal to 1.",
        "alertPolicy.notificationChannels":
          "Notification channels must contain at least one non-empty channel name.",
        "alertPolicy.escalationTarget": "Escalation target is required.",
      });
      return true;
    },
  );

  await service.updateMonitor(created.id, {
    alertPolicy: {
      failureThreshold: 3,
      recoveryThreshold: 2,
      notificationChannels: ["email", "pagerduty"],
      escalationTarget: "on-call-primary",
      notificationCredentials: {
        email: "smtp-password",
      },
    },
  });

  const updated = await service.getMonitorDetail(created.id);
  assert.deepEqual(updated.monitor.alertPolicy.notificationCredentialChannels, ["email"]);

  const belowThreshold = await service.previewAlertDecision(created.id, {
    sample: "failure",
    consecutiveFailures: 2,
    evaluatedAt: "2026-04-06T12:00:00.000Z",
  });
  assert.deepEqual(belowThreshold, {
    wouldNotify: false,
    status: "suppressed",
    reason: "Failure threshold not met.",
  });

  const notify = await service.previewAlertDecision(created.id, {
    sample: "failure",
    consecutiveFailures: 3,
    evaluatedAt: "2026-04-06T12:00:00.000Z",
  });
  assert.deepEqual(notify, {
    wouldNotify: true,
    status: "notify",
    reason: "Failure threshold met.",
  });
});

test("suppresses alert delivery during an active maintenance window while keeping checks runnable", async () => {
  const service = createService();
  const created = await service.createMonitor({
    name: "Admin",
    environment: "production",
    url: "https://example.com/admin",
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
  });

  const window = await service.createMaintenanceWindow(created.id, {
    startsAt: "2026-04-06T10:00:00.000Z",
    endsAt: "2026-04-06T14:00:00.000Z",
    reason: "Planned database maintenance",
  });

  assert.match(window.id, /^[0-9a-f-]{36}$/);

  const preview = await service.previewAlertDecision(created.id, {
    sample: "failure",
    consecutiveFailures: 1,
    evaluatedAt: "2026-04-06T12:00:00.000Z",
  });
  assert.deepEqual(preview, {
    wouldNotify: false,
    status: "suppressed",
    reason: "Alert delivery suppressed by an active maintenance window.",
  });

  const runnable = await service.listRunnableMonitors();
  assert.deepEqual(
    runnable.map((monitor) => monitor.id),
    [created.id],
  );
});

test("builds dashboard summary counts, filtered monitor rows, and open incident previews", async () => {
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
    tags: ["web", "prod"],
  });
  const degraded = await service.createMonitor({
    name: "Search",
    environment: "staging",
    url: "https://example.com/search",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["search"],
  });
  const paused = await service.createMonitor({
    name: "Docs",
    environment: "production",
    url: "https://example.com/docs",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 1000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    tags: ["docs"],
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

  await service.updateMonitor(paused.id, { action: "pause" });

  await repository.update({
    ...(await repository.getById(healthy.id)),
    healthState: "healthy",
    recentIncidentState: "resolved",
    lastCheckAt: "2026-04-06T12:00:00.000Z",
    responseTimeMs: 120,
  });
  await repository.update({
    ...(await repository.getById(degraded.id)),
    healthState: "degraded",
    recentIncidentState: "resolved",
    lastCheckAt: "2026-04-06T12:01:00.000Z",
    responseTimeMs: 900,
  });
  await repository.update({
    ...(await repository.getById(paused.id)),
    healthState: "healthy",
    recentIncidentState: "none",
    lastCheckAt: "2026-04-06T12:02:00.000Z",
    responseTimeMs: 150,
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

  const dashboard = await service.getDashboard({
    environment: "production",
    status: "incident",
    tag: "payments",
    recentIncidentState: "open",
    asOf: "2026-04-06T12:05:00.000Z",
  });

  assert.deepEqual(dashboard.summary, {
    healthy: 1,
    degraded: 1,
    paused: 1,
    incident: 1,
  });
  assert.deepEqual(dashboard.monitors, [
    {
      id: incident.id,
      name: "Billing",
      environment: "production",
      tags: ["payments"],
      status: "incident",
      recentIncidentState: "open",
      incidentId: "INC-204",
      lastCheckAt: "2026-04-06T12:03:00.000Z",
      responseTimeMs: 0,
    },
  ]);
  assert.deepEqual(dashboard.openIncidents, [
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
  assert.deepEqual(dashboard.dataset, {
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

test("bounds dashboard results to a 30-day dataset slice and configured limits", async () => {
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

  const dashboard = await service.getDashboard({
    asOf: "2026-04-06T12:05:00.000Z",
    datasetDays: 30,
    monitorLimit: 1,
    incidentLimit: 1,
  });

  assert.deepEqual(dashboard.summary, {
    healthy: 1,
    degraded: 0,
    paused: 0,
    incident: 1,
  });
  assert.equal(dashboard.monitors.length, 1);
  assert.equal(dashboard.monitors[0].id, recentHealthy.id);
  assert.equal(dashboard.openIncidents.length, 1);
  assert.equal(dashboard.openIncidents[0].id, "INC-501");
  assert.deepEqual(dashboard.dataset, {
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

test("returns incident detail with monitor context, check evidence, delivery history, and timeline", async () => {
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
    tags: ["payments"],
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
            id: "chk-older",
            statusCode: 502,
            responseTimeMs: 1800,
            errorClass: "HTTP_5XX",
            matchingRuleResult: "status_mismatch",
            checkedAt: "2026-04-06T11:56:00.000Z",
          },
          {
            id: "chk-newer",
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
          {
            channel: "pagerduty",
            status: "queued",
            deliveredAt: "2026-04-06T11:56:45.000Z",
          },
        ],
        timeline: [
          {
            eventType: "manual_resolution",
            actor: "alice@example.com",
            note: "Closed after validation",
            createdAt: "2026-04-06T12:05:00.000Z",
          },
          {
            eventType: "failure_onset",
            actor: "system",
            note: "Threshold breached",
            createdAt: "2026-04-06T11:55:00.000Z",
          },
          {
            eventType: "recovered",
            actor: "system",
            note: "Monitor recovered",
            createdAt: "2026-04-06T12:03:00.000Z",
          },
          {
            eventType: "acknowledged",
            actor: "alice@example.com",
            note: "Investigating",
            createdAt: "2026-04-06T11:58:00.000Z",
          },
        ],
      },
    ],
  });

  const detail = await service.getIncidentDetail("INC-204");

  assert.deepEqual(detail.incident, {
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
  assert.deepEqual(detail.latestCheckResults, [
    {
      id: "chk-newer",
      statusCode: 500,
      responseTimeMs: 2400,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
      checkedAt: "2026-04-06T11:59:00.000Z",
    },
    {
      id: "chk-older",
      statusCode: 502,
      responseTimeMs: 1800,
      errorClass: "HTTP_5XX",
      matchingRuleResult: "status_mismatch",
      checkedAt: "2026-04-06T11:56:00.000Z",
    },
  ]);
  assert.deepEqual(detail.deliveryHistory, [
    {
      channel: "email",
      status: "sent",
      deliveredAt: "2026-04-06T11:56:30.000Z",
    },
    {
      channel: "pagerduty",
      status: "queued",
      deliveredAt: "2026-04-06T11:56:45.000Z",
    },
  ]);
  assert.deepEqual(detail.timeline, [
    {
      eventType: "failure_onset",
      actor: "system",
      note: "Threshold breached",
      createdAt: "2026-04-06T11:55:00.000Z",
    },
    {
      eventType: "acknowledged",
      actor: "alice@example.com",
      note: "Investigating",
      createdAt: "2026-04-06T11:58:00.000Z",
    },
    {
      eventType: "recovered",
      actor: "system",
      note: "Monitor recovered",
      createdAt: "2026-04-06T12:03:00.000Z",
    },
    {
      eventType: "manual_resolution",
      actor: "alice@example.com",
      note: "Closed after validation",
      createdAt: "2026-04-06T12:05:00.000Z",
    },
  ]);
});

test("applies acknowledge, mute, unmute, and manual resolve actions with actor metadata", async () => {
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

  const acknowledged = await service.applyIncidentAction("INC-205", {
    action: "acknowledge",
    actor: "alice@example.com",
    note: "Investigating",
  });
  assert.equal(acknowledged.incident.state, "acknowledged");
  assert.equal(acknowledged.incident.muted, false);
  assert.equal(
    acknowledged.timeline[acknowledged.timeline.length - 1].eventType,
    "acknowledged",
  );
  assert.equal(
    acknowledged.timeline[acknowledged.timeline.length - 1].actor,
    "alice@example.com",
  );

  const muted = await service.applyIncidentAction("INC-205", {
    action: "mute",
    actor: "alice@example.com",
  });
  assert.equal(muted.incident.muted, true);
  assert.equal(muted.timeline[muted.timeline.length - 1].eventType, "muted");

  const unmuted = await service.applyIncidentAction("INC-205", {
    action: "unmute",
    actor: "alice@example.com",
  });
  assert.equal(unmuted.incident.muted, false);
  assert.equal(unmuted.timeline[unmuted.timeline.length - 1].eventType, "unmuted");

  const resolved = await service.applyIncidentAction("INC-205", {
    action: "resolve",
    actor: "alice@example.com",
    note: "Closed after validation",
  });
  assert.equal(resolved.incident.state, "resolved");
  assert.match(resolved.incident.resolvedAt, /^20/);
  assert.equal(
    resolved.timeline[resolved.timeline.length - 1].eventType,
    "manual_resolution",
  );
});

test("auto-resolves a recovered incident when the policy recovery threshold is met", async () => {
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
    alertPolicy: {
      failureThreshold: 1,
      recoveryThreshold: 2,
      notificationChannels: ["email"],
      escalationTarget: "on-call-primary",
    },
  });

  await repository.update({
    ...(await repository.getById(monitor.id)),
    currentIncident: {
      id: "INC-206",
      state: "open",
      openedAt: "2026-04-06T12:00:00.000Z",
    },
    recentIncidentState: "open",
    incidents: [
      {
        id: "INC-206",
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

  const autoResolved = await service.autoResolveIncidentIfPolicyAllows("INC-206", {
    consecutiveRecoveries: 2,
    occurredAt: "2026-04-06T12:05:00.000Z",
  });

  assert.equal(autoResolved.incident.state, "resolved");
  assert.equal(autoResolved.incident.resolvedAt, "2026-04-06T12:05:00.000Z");
  assert.equal(
    autoResolved.timeline[autoResolved.timeline.length - 1].eventType,
    "recovered",
  );
});
