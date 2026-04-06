import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryCheckResultRepository,
  InMemoryIncidentRepository,
  InMemoryMonitorRepository,
} from "../../src/monitoring/in-memory-repositories.js";
import { ManualClock } from "../../src/time/manual-clock.js";
import { ScheduledCheckWorker } from "../../src/worker/scheduled-check-worker.js";

class ThresholdBreachExecutor {
  constructor({ breachAt }) {
    this.breachAt = Date.parse(breachAt);
  }

  async execute({ executedAt }) {
    return Date.parse(executedAt) >= this.breachAt
      ? { ok: false, statusCode: 503, error: "threshold_breached" }
      : { ok: true, statusCode: 200 };
  }
}

test(
  "a 60-second monitor opens an incident within 90 seconds of threshold breach",
  async () => {
    const clock = new ManualClock("2026-04-06T00:00:00.000Z");
    const breachAt = "2026-04-06T00:00:30.000Z";
    const monitorRepository = new InMemoryMonitorRepository();
    const checkResultRepository = new InMemoryCheckResultRepository();
    const incidentRepository = new InMemoryIncidentRepository();

    monitorRepository.add({
      id: "monitor-1",
      status: "active",
      intervalSeconds: 60,
      failureThreshold: 1,
      consecutiveFailures: 0,
      nextCheckAt: clock.now(),
      lastCheckedAt: null,
    });

    const worker = new ScheduledCheckWorker({
      clock,
      monitorRepository,
      checkResultRepository,
      incidentRepository,
      checkExecutor: new ThresholdBreachExecutor({ breachAt }),
    });

    await worker.runDueChecks();
    clock.advanceBy(30_000);

    const earlyRun = await worker.runDueChecks();
    assert.equal(earlyRun.monitorRuns.length, 0);

    clock.advanceBy(30_000);
    const scheduledRun = await worker.runDueChecks();

    assert.equal(scheduledRun.executedAt, "2026-04-06T00:01:00.000Z");
    assert.deepEqual(scheduledRun.monitorRuns, [
      {
        monitorId: "monitor-1",
        checkedAt: "2026-04-06T00:01:00.000Z",
        outcome: "fail",
      },
    ]);

    const incident = incidentRepository.findOpenByMonitorId("monitor-1");
    assert.ok(incident);
    assert.equal(incident.openedAt, "2026-04-06T00:01:00.000Z");

    const latencyMs = Date.parse(incident.openedAt) - Date.parse(breachAt);
    assert.equal(latencyMs, 30_000);
    assert.ok(latencyMs <= 90_000);

    assert.deepEqual(
      checkResultRepository
        .listByMonitorId("monitor-1")
        .map(({ checkedAt, outcome, statusCode }) => ({
          checkedAt,
          outcome,
          statusCode,
        })),
      [
        {
          checkedAt: "2026-04-06T00:00:00.000Z",
          outcome: "pass",
          statusCode: 200,
        },
        {
          checkedAt: "2026-04-06T00:01:00.000Z",
          outcome: "fail",
          statusCode: 503,
        },
      ],
    );
  },
);
