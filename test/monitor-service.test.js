const test = require("node:test");
const assert = require("node:assert/strict");
const { MonitorRepository } = require("../src/monitor-repository");
const { MonitorService, ValidationError } = require("../src/monitor-service");

function createFixture() {
  const repository = new MonitorRepository(":memory:");
  const service = new MonitorService(repository);

  return {
    repository,
    service,
    cleanup() {
      repository.close();
    }
  };
}

test("createMonitor rejects invalid monitor input with field-level validation", () => {
  const fixture = createFixture();

  assert.throws(
    () => {
      fixture.service.createMonitor({
        url: "ftp://invalid",
        method: "TRACE",
        intervalSeconds: 10,
        timeoutMs: 20000,
        expectedStatusMin: 500,
        expectedStatusMax: 200
      });
    },
    (error) => {
      assert.equal(error instanceof ValidationError, true);
      assert.deepEqual(Object.keys(error.errors).sort(), [
        "expectedStatusMax",
        "intervalSeconds",
        "method",
        "url"
      ]);
      return true;
    }
  );

  fixture.cleanup();
});

test("paused and archived monitors are excluded from scheduled monitors", () => {
  const fixture = createFixture();
  const active = fixture.service.createMonitor({
    name: "Checkout",
    url: "https://checkout.example.com/health",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusMin: 200,
    expectedStatusMax: 299
  });
  const paused = fixture.service.createMonitor({
    name: "API",
    url: "https://api.example.com/health",
    method: "POST",
    intervalSeconds: 120,
    timeoutMs: 4000,
    expectedStatusMin: 200,
    expectedStatusMax: 399
  });
  const archived = fixture.service.createMonitor({
    name: "Old endpoint",
    url: "https://legacy.example.com/health",
    method: "HEAD",
    intervalSeconds: 300,
    timeoutMs: 3000,
    expectedStatusMin: 200,
    expectedStatusMax: 299
  });

  fixture.service.applyAction(paused.id, "pause");
  fixture.service.applyAction(archived.id, "archive");

  const scheduled = fixture.service.listScheduledMonitors();

  assert.deepEqual(
    scheduled.map((monitor) => monitor.id),
    [active.id]
  );

  fixture.cleanup();
});

test("monitor lifecycle supports pause, resume, and archive", () => {
  const fixture = createFixture();
  const monitor = fixture.service.createMonitor({
    name: "Docs",
    url: "https://docs.example.com/health",
    method: "GET",
    intervalSeconds: 60,
    timeoutMs: 5000,
    expectedStatusMin: 200,
    expectedStatusMax: 299,
    keywordMatch: "healthy"
  });

  const paused = fixture.service.applyAction(monitor.id, "pause");
  assert.equal(paused.status, "paused");

  const resumed = fixture.service.applyAction(monitor.id, "resume");
  assert.equal(resumed.status, "active");

  const archived = fixture.service.applyAction(monitor.id, "archive");
  assert.equal(archived.status, "archived");

  assert.throws(
    () => fixture.service.updateMonitor(monitor.id, { timeoutMs: 2000 }),
    (error) => {
      assert.equal(error instanceof ValidationError, true);
      assert.deepEqual(error.errors, {
        status: [
          "Archived monitors cannot be edited. Create a new monitor or resume from an earlier state before archiving."
        ]
      });
      return true;
    }
  );

  fixture.cleanup();
});
