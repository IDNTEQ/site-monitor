const test = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const { MonitorRepository } = require("../src/monitor-repository");
const { MonitorService } = require("../src/monitor-service");
const { createApp } = require("../src/app");

function createAppFixture() {
  const repository = new MonitorRepository(":memory:");
  const monitorService = new MonitorService(repository);
  const app = createApp({ monitorService });

  return {
    repository,
    monitorService,
    app,
    cleanup() {
      repository.close();
    }
  };
}

async function invoke(app, { method, url, headers = {}, body = "" }) {
  const request = Readable.from(body ? [Buffer.from(body)] : []);
  request.method = method;
  request.url = url;
  request.headers = headers;

  return await new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      headers: {},
      body: "",
      writeHead(statusCode, responseHeaders) {
        this.statusCode = statusCode;
        this.headers = responseHeaders;
      },
      end(chunk = "") {
        this.body += chunk;
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: this.body
        });
      }
    };

    Promise.resolve(app(request, response)).catch(reject);
  });
}

test("POST /api/monitors returns field-level validation errors", async () => {
  const fixture = createAppFixture();

  const response = await invoke(fixture.app, {
    method: "POST",
    url: "/api/monitors",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: "not-a-url",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 70000,
      expectedStatusMin: 200,
      expectedStatusMax: 299
    })
  });
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 400);
  assert.deepEqual(payload.fieldErrors, {
    timeoutMs: ["Timeout must be between 100 and 60000 milliseconds."],
    url: ["URL must be a valid absolute URL."]
  });

  fixture.cleanup();
});

test("monitor endpoints create, update, pause, resume, and archive a monitor", async () => {
  const fixture = createAppFixture();

  const createResponse = await invoke(fixture.app, {
    method: "POST",
    url: "/api/monitors",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Checkout",
      url: "https://checkout.example.com/health",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusMin: 200,
      expectedStatusMax: 299,
      keywordMatch: "ok"
    })
  });
  const created = JSON.parse(createResponse.body);
  const monitorId = created.data.id;

  const updateResponse = await invoke(fixture.app, {
    method: "PATCH",
    url: `/api/monitors/${monitorId}`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      timeoutMs: 3500,
      expectedStatusMax: 399
    })
  });
  const updated = JSON.parse(updateResponse.body);

  const pauseResponse = await invoke(fixture.app, {
    method: "PATCH",
    url: `/api/monitors/${monitorId}`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "pause" })
  });
  const paused = JSON.parse(pauseResponse.body);

  const scheduledWhilePaused = await invoke(fixture.app, {
    method: "GET",
    url: "/api/monitors/scheduled"
  });
  const pausedScheduledPayload = JSON.parse(scheduledWhilePaused.body);

  const resumeResponse = await invoke(fixture.app, {
    method: "PATCH",
    url: `/api/monitors/${monitorId}`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "resume" })
  });
  const resumed = JSON.parse(resumeResponse.body);

  const archiveResponse = await invoke(fixture.app, {
    method: "PATCH",
    url: `/api/monitors/${monitorId}`,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "archive" })
  });
  const archived = JSON.parse(archiveResponse.body);

  const scheduledAfterArchive = await invoke(fixture.app, {
    method: "GET",
    url: "/api/monitors/scheduled"
  });
  const archivedScheduledPayload = JSON.parse(scheduledAfterArchive.body);

  assert.equal(createResponse.statusCode, 201);
  assert.equal(updated.data.timeoutMs, 3500);
  assert.equal(updated.data.expectedStatusMax, 399);
  assert.equal(paused.data.status, "paused");
  assert.equal(pausedScheduledPayload.data.length, 0);
  assert.equal(resumed.data.status, "active");
  assert.equal(archived.data.status, "archived");
  assert.equal(archivedScheduledPayload.data.length, 0);

  fixture.cleanup();
});
