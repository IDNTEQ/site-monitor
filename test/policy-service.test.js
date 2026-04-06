import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryMonitorRepository } from "../src/repositories/inMemoryMonitorRepository.js";
import { PolicyService } from "../src/services/policyService.js";

function createService(monitors) {
  return new PolicyService({
    monitorRepository: new InMemoryMonitorRepository(monitors)
  });
}

test("updateAlertPolicy stores a normalized alert policy for a monitor", async () => {
  const service = createService([{ id: "monitor-1", name: "Checkout", maintenanceWindows: [] }]);

  const result = await service.updateAlertPolicy("monitor-1", {
    failureThreshold: 3,
    recoveryThreshold: 2,
    notificationChannels: ["slack", "pagerduty", "slack"],
    escalationTarget: "payments-on-call",
    notifyOnRecovery: true
  });

  assert.deepEqual(result, {
    monitorId: "monitor-1",
    alertPolicy: {
      failureThreshold: 3,
      recoveryThreshold: 2,
      notificationChannels: ["slack", "pagerduty"],
      escalationTarget: "payments-on-call",
      notifyOnRecovery: true
    }
  });
});

test("previewDecision suppresses a failure during an active maintenance window", async () => {
  const service = createService([
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

  const result = await service.previewDecision("monitor-1", {
    eventType: "failure",
    checkedAt: "2026-04-06T10:30:00.000Z",
    consecutiveFailures: 2
  });

  assert.equal(result.preview.decision, "suppressed");
  assert.equal(result.preview.reason, "maintenance-window-active");
  assert.equal(result.preview.maintenanceWindow.id, "mw-1");
});

test("previewDecision notifies once the failure threshold is met outside maintenance", async () => {
  const service = createService([
    {
      id: "monitor-1",
      name: "Checkout",
      alertPolicy: {
        failureThreshold: 3,
        recoveryThreshold: 2,
        notificationChannels: ["pagerduty", "slack"],
        escalationTarget: "payments-on-call",
        notifyOnRecovery: true
      },
      maintenanceWindows: []
    }
  ]);

  const result = await service.previewDecision("monitor-1", {
    eventType: "failure",
    checkedAt: "2026-04-06T12:00:00.000Z",
    consecutiveFailures: 3
  });

  assert.equal(result.preview.decision, "notify");
  assert.deepEqual(result.preview.notificationChannels, ["pagerduty", "slack"]);
  assert.equal(result.preview.escalationTarget, "payments-on-call");
});

test("previewDecision suppresses a recovery when recovery notifications are disabled", async () => {
  const service = createService([
    {
      id: "monitor-1",
      name: "Checkout",
      alertPolicy: {
        failureThreshold: 2,
        recoveryThreshold: 2,
        notificationChannels: ["pagerduty"],
        escalationTarget: "payments-on-call",
        notifyOnRecovery: false
      },
      maintenanceWindows: []
    }
  ]);

  const result = await service.previewDecision("monitor-1", {
    eventType: "recovery",
    checkedAt: "2026-04-06T12:00:00.000Z",
    consecutiveRecoveries: 2
  });

  assert.equal(result.preview.decision, "suppressed");
  assert.equal(result.preview.reason, "recovery-notifications-disabled");
});
