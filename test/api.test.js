import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

import { createHandler } from "../src/http/app.js";
import { InMemoryMonitorRepository } from "../src/repositories/inMemoryMonitorRepository.js";
import { PolicyService } from "../src/services/policyService.js";

function createResponseCapture() {
  let resolveFinished;
  const finished = new Promise((resolve) => {
    resolveFinished = resolve;
  });

  return {
    response: {
      statusCode: 200,
      headers: {},
      writeHead(statusCode, headers) {
        this.statusCode = statusCode;
        this.headers = headers;
      },
      end(body) {
        resolveFinished({
          statusCode: this.statusCode,
          headers: this.headers,
          body
        });
      }
    },
    finished
  };
}

async function requestJson(handler, { method, path, body }) {
  const request = Readable.from(body ? [JSON.stringify(body)] : []);
  request.method = method;
  request.url = path;
  request.headers = body ? { "content-type": "application/json" } : {};

  const { response, finished } = createResponseCapture();
  await handler(request, response);

  const result = await finished;
  return {
    statusCode: result.statusCode,
    headers: result.headers,
    body: JSON.parse(result.body)
  };
}

function createHandlerFor(monitors) {
  return createHandler({
    policyService: new PolicyService({
      monitorRepository: new InMemoryMonitorRepository(monitors)
    })
  });
}

test("PATCH /api/monitors/:id/alert-policy updates the monitor policy", async () => {
  const handler = createHandlerFor([{ id: "monitor-1", name: "Checkout", maintenanceWindows: [] }]);
  const response = await requestJson(handler, {
    method: "PATCH",
    path: "/api/monitors/monitor-1/alert-policy",
    body: {
      failureThreshold: 4,
      recoveryThreshold: 2,
      notificationChannels: ["slack", "email"],
      escalationTarget: "platform-primary",
      notifyOnRecovery: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.alertPolicy.failureThreshold, 4);
  assert.deepEqual(response.body.alertPolicy.notificationChannels, ["slack", "email"]);
});

test("POST /api/monitors/:id/maintenance-windows validates window boundaries", async () => {
  const handler = createHandlerFor([{ id: "monitor-1", name: "Checkout", maintenanceWindows: [] }]);
  const response = await requestJson(handler, {
    method: "POST",
    path: "/api/monitors/monitor-1/maintenance-windows",
    body: {
      startsAt: "2026-04-06T11:00:00.000Z",
      endsAt: "2026-04-06T10:00:00.000Z",
      reason: "backwards window"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "endsAt must be later than startsAt.");
});

test("POST /api/monitors/:id/policy-preview returns a suppressed decision during maintenance", async () => {
  const handler = createHandlerFor([
    {
      id: "monitor-1",
      name: "Checkout",
      alertPolicy: {
        failureThreshold: 2,
        recoveryThreshold: 1,
        notificationChannels: ["pagerduty"],
        escalationTarget: "payments-on-call",
        notifyOnRecovery: true
      },
      maintenanceWindows: [
        {
          id: "mw-1",
          startsAt: "2026-04-06T10:00:00.000Z",
          endsAt: "2026-04-06T11:00:00.000Z",
          reason: "database migration"
        }
      ]
    }
  ]);
  const response = await requestJson(handler, {
    method: "POST",
    path: "/api/monitors/monitor-1/policy-preview",
    body: {
      eventType: "failure",
      checkedAt: "2026-04-06T10:30:00.000Z",
      consecutiveFailures: 2
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.preview.decision, "suppressed");
  assert.equal(response.body.preview.reason, "maintenance-window-active");
});
