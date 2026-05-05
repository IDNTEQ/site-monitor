import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createApp } from "./http/app.js";
import { SqliteMonitorRepository } from "./repositories/sqlite-monitor-repository.js";
import { createAlertDeliveryService } from "./services/alert-delivery.js";
import { createCheckWorkerService } from "./services/check-worker-service.js";
import { createMonitorService } from "./services/monitor-service.js";
import { createSecretCodec } from "./domain/secrets.js";

const DEFAULT_PORT = 3000;
const DEFAULT_DATABASE_PATH = "./data/site-monitor.sqlite";
const DEFAULT_WORKER_INTERVAL_MS = 1000;

function parsePositiveInteger(value, defaultValue) {
  const parsed = Number.parseInt(value ?? `${defaultValue}`, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function ensureDatabaseDirectory(filename) {
  if (filename === ":memory:") {
    return;
  }

  mkdirSync(dirname(filename), {
    recursive: true,
  });
}

function addHeader(headers, name, value) {
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    value === undefined ||
    value === null
  ) {
    return;
  }

  headers[name.trim()] = String(value);
}

function addRequestHeaderEntry(headers, entry, secretCodec) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return;
  }

  const encryptedValue = entry.valueEncrypted ?? entry.encryptedValue;
  addHeader(
    headers,
    entry.name,
    encryptedValue ? secretCodec.decrypt(encryptedValue) : entry.value,
  );
}

function addRequestHeaders(headers, requestHeaders, secretCodec) {
  if (Array.isArray(requestHeaders)) {
    for (const entry of requestHeaders) {
      addRequestHeaderEntry(headers, entry, secretCodec);
    }
    return;
  }

  if (!requestHeaders || typeof requestHeaders !== "object") {
    return;
  }

  for (const [name, value] of Object.entries(requestHeaders)) {
    addHeader(headers, name, value);
  }
}

function buildRequestHeaders(monitor, secretCodec) {
  const headers = {};
  addRequestHeaders(headers, monitor.headers, secretCodec);
  addRequestHeaders(headers, monitor.requestHeaders, secretCodec);

  for (const [name, encryptedValue] of Object.entries(monitor.encryptedCredentials ?? {})) {
    addHeader(headers, name, secretCodec.decrypt(encryptedValue));
  }

  if (
    monitor.authSecretEncrypted &&
    !Object.keys(headers).some((name) => name.toLowerCase() === "authorization")
  ) {
    addHeader(
      headers,
      "Authorization",
      `Bearer ${secretCodec.decrypt(monitor.authSecretEncrypted)}`,
    );
  }

  return headers;
}

function classifyHttpStatus(statusCode) {
  if (statusCode >= 500) {
    return "HTTP_5XX";
  }

  if (statusCode >= 400) {
    return "HTTP_4XX";
  }

  if (statusCode >= 300) {
    return "HTTP_3XX";
  }

  return undefined;
}

function classifyFetchError(error) {
  if (error?.name === "AbortError" || error?.name === "TimeoutError") {
    return "TimeoutError";
  }

  return "NetworkError";
}

function createFetchCheck({ secretCodec }) {
  return async function fetchCheck(monitor) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), monitor.timeoutMs);

    try {
      const response = await globalThis.fetch(monitor.url, {
        method: monitor.method,
        headers: buildRequestHeaders(monitor, secretCodec),
        signal: controller.signal,
      });
      const responseTimeMs = Date.now() - startedAt;
      const statusOk =
        response.status >= monitor.expectedStatusMin &&
        response.status <= monitor.expectedStatusMax;
      let matchingRuleResult = statusOk ? "matched" : "status_mismatch";
      if (statusOk && monitor.keyword && monitor.method !== "HEAD") {
        const responseBody = await response.text();
        matchingRuleResult = responseBody.includes(monitor.keyword)
          ? "matched"
          : "keyword_missing";
      } else if (response.body) {
        await response.body.cancel().catch(() => {});
      }

      return {
        statusCode: response.status,
        responseTimeMs,
        errorClass:
          matchingRuleResult === "keyword_missing"
            ? "KeywordMismatch"
            : statusOk
              ? null
              : classifyHttpStatus(response.status),
        matchingRuleResult,
      };
    } catch (error) {
      return {
        statusCode: 0,
        responseTimeMs: Date.now() - startedAt,
        errorClass: classifyFetchError(error),
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

const port = parsePositiveInteger(process.env.PORT, DEFAULT_PORT);
const databasePath = process.env.DATABASE_PATH ?? DEFAULT_DATABASE_PATH;
const workerIntervalMs = parsePositiveInteger(
  process.env.WORKER_INTERVAL_MS,
  DEFAULT_WORKER_INTERVAL_MS,
);

ensureDatabaseDirectory(databasePath);

const repository = new SqliteMonitorRepository({
  filename: databasePath,
});
const secretCodec = createSecretCodec();
const monitorService = createMonitorService({
  repository,
  secretCodec,
});
const alertDelivery = createAlertDeliveryService();
const workerService = createCheckWorkerService({
  repository,
  fetchCheck: createFetchCheck({
    secretCodec,
  }),
  alertDelivery,
});
const app = createApp({
  service: monitorService,
  workerService,
});

let tickInProgress = false;
let currentTick = Promise.resolve();
async function runWorkerTick() {
  if (tickInProgress) {
    return;
  }

  tickInProgress = true;
  currentTick = workerService.runDueMonitors(new Date());
  try {
    await currentTick;
  } catch (error) {
    process.stderr.write(`worker tick failed: ${error.message}\n`);
  } finally {
    tickInProgress = false;
  }
}

const workerInterval = setInterval(runWorkerTick, workerIntervalMs);
const server = app.listen(port, () => {
  process.stdout.write(`site-monitor listening on http://127.0.0.1:${port}\n`);
});

let shutdownStarted = false;
async function shutdown(signal) {
  if (shutdownStarted) {
    return;
  }

  shutdownStarted = true;
  clearInterval(workerInterval);
  process.stdout.write(`received ${signal}, shutting down site-monitor\n`);
  try {
    await currentTick;
  } catch {
    // The scheduler already logged the failed tick.
  }

  server.close((error) => {
    try {
      repository.close();
    } catch (closeError) {
      process.stderr.write(`database close failed: ${closeError.message}\n`);
    }

    if (error) {
      process.stderr.write(`server close failed: ${error.message}\n`);
      process.exit(1);
      return;
    }

    process.exit(0);
  });
}

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.once("SIGINT", () => {
  void shutdown("SIGINT");
});
