import test from "node:test";
import assert from "node:assert/strict";

import { SqliteMonitorRepository } from "../src/repositories/sqlite-monitor-repository.js";

test("SQLite repository persists monitors and worker runs as cloned JSON blobs", async () => {
  const repository = new SqliteMonitorRepository({
    filename: ":memory:",
  });

  try {
    const monitor = {
      id: "monitor-1",
      name: "Checkout",
      checkResults: [
        {
          id: "check-1",
          checkedAt: "2026-04-06T12:00:00.000Z",
          outcome: "success",
        },
      ],
      incidents: [
        {
          id: "incident-1",
          state: "open",
          deliveryHistory: [],
          timeline: [],
        },
      ],
    };

    const created = await repository.create(monitor);
    created.name = "Mutated";
    created.checkResults[0].outcome = "failure";

    const stored = await repository.getById("monitor-1");
    assert.equal(stored.name, "Checkout");
    assert.equal(stored.checkResults[0].outcome, "success");

    await repository.update({
      ...stored,
      currentIncident: {
        id: "incident-1",
        state: "open",
      },
    });
    await repository.appendWorkerRun({
      id: "run-1",
      checkedAt: "2026-04-06T12:00:00.000Z",
      scheduledChecks: 1,
      completedChecks: 1,
      missedChecks: 0,
      completionRate: 1,
      meetsTarget: true,
      monitorAudits: [],
    });

    const monitors = await repository.list();
    const workerRuns = await repository.listWorkerRuns();

    assert.equal(monitors.length, 1);
    assert.equal(monitors[0].currentIncident.id, "incident-1");
    assert.deepEqual(
      workerRuns.map((workerRun) => workerRun.id),
      ["run-1"],
    );
  } finally {
    repository.close();
  }
});
