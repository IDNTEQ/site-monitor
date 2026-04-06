import test from "node:test";
import assert from "node:assert/strict";

import { handlePageRequest } from "../src/http/app.js";
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
    ],
  });

  return createDashboardService({
    repository,
    clock: () => new Date("2026-04-06T12:05:00.000Z"),
  });
}

test("GET /dashboard renders summary counts, filters, and direct incident links", async () => {
  const result = await handlePageRequest({
    service: createService(),
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
  assert.match(result.body, /<label for="recent-incident-state-filter">Recent incident state<\/label>/);
  assert.match(result.body, /Incident monitors/);
  assert.match(result.body, /aria-live="polite"/);
  assert.match(result.body, /! Open INC-204/);
  assert.match(result.body, /href="\/incidents\/INC-204"/);
  assert.match(result.body, /Opened 10 minutes ago/);
});

test("GET /dashboard renders a clear empty state when filters remove all monitors", async () => {
  const result = await handlePageRequest({
    service: createService(),
    method: "GET",
    pathname: "/dashboard",
    searchParams: new URLSearchParams({
      asOf: "2026-04-06T12:05:00.000Z",
      environment: "staging",
    }),
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /No monitors matched the current dashboard filters\./);
});

test("GET /incidents/:incidentId renders an operator-facing incident summary page", async () => {
  const result = await handlePageRequest({
    service: createService(),
    method: "GET",
    pathname: "/incidents/INC-204",
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /<h1>Incident Summary<\/h1>/);
  assert.match(result.body, /Billing/);
  assert.match(result.body, /critical/);
  assert.match(result.body, /Back to dashboard/);
});
