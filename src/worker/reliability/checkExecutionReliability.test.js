import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  renderCheckExecutionMetrics,
  summarizeCheckExecutionReliability
} from "./checkExecutionReliability.js";
import {
  createStagingReliabilityAudit,
  formatTextAuditReport
} from "./stagingReliabilityAudit.js";

function buildRecord(index, overrides = {}) {
  const scheduledAt = new Date(Date.UTC(2026, 3, 1, 0, index, 0)).toISOString();
  const completedAt = new Date(Date.UTC(2026, 3, 1, 0, index, 30)).toISOString();

  return {
    checkId: `check-${index}`,
    monitorId: index % 2 === 0 ? "api" : "web",
    scheduledAt,
    completedAt,
    outcome: "succeeded",
    ...overrides
  };
}

test("summarizeCheckExecutionReliability passes when 99 percent of checks complete", () => {
  const records = Array.from({ length: 100 }, (_, index) =>
    buildRecord(index, index === 99 ? { completedAt: null, outcome: null } : {})
  );

  const summary = summarizeCheckExecutionReliability(records, {
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-08T00:00:00.000Z"
  });

  assert.equal(summary.scheduledChecks, 100);
  assert.equal(summary.completedChecks, 99);
  assert.equal(summary.missedChecks, 1);
  assert.equal(summary.allowedMisses, 1);
  assert.equal(summary.completionRate, 0.99);
  assert.equal(summary.meetsTarget, true);
});

test("summarizeCheckExecutionReliability fails when the completion rate drops below the target", () => {
  const records = Array.from({ length: 100 }, (_, index) =>
    buildRecord(index, index >= 98 ? { completedAt: null, outcome: null } : {})
  );

  const summary = summarizeCheckExecutionReliability(records, {
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-08T00:00:00.000Z"
  });

  assert.equal(summary.completedChecks, 98);
  assert.equal(summary.missedChecks, 2);
  assert.equal(summary.meetsTarget, false);
  assert.equal(summary.errorBudgetRemaining, -1);
});

test("summarizeCheckExecutionReliability excludes checks scheduled outside the audit window", () => {
  const records = [
    buildRecord(1, { scheduledAt: "2026-03-31T23:59:59.000Z" }),
    buildRecord(2),
    buildRecord(3)
  ];

  const summary = summarizeCheckExecutionReliability(records, {
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-08T00:00:00.000Z"
  });

  assert.equal(summary.scheduledChecks, 2);
  assert.equal(summary.completedChecks, 2);
});

test("renderCheckExecutionMetrics emits Prometheus metrics for totals and per-monitor breakdowns", () => {
  const summary = summarizeCheckExecutionReliability([buildRecord(1), buildRecord(2)], {
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-08T00:00:00.000Z"
  });

  const metrics = renderCheckExecutionMetrics(summary, { environment: "staging" });

  assert.match(metrics, /site_monitor_worker_scheduled_checks_total\{environment="staging"\} 2/);
  assert.match(metrics, /site_monitor_worker_check_completion_ratio\{environment="staging"\} 1/);
  assert.match(
    metrics,
    /site_monitor_worker_monitor_scheduled_checks_total\{environment="staging",monitor_id="api"\} 1/
  );
});

test("createStagingReliabilityAudit builds a machine-readable report and text summary", () => {
  const fixturePath = new URL("./stagingReliabilityAudit.fixture.json", import.meta.url);
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  const report = createStagingReliabilityAudit(payload);
  const textReport = formatTextAuditReport(report);

  assert.equal(report.environment, "staging");
  assert.equal(report.summary.scheduledChecks, 2);
  assert.equal(report.summary.completedChecks, 1);
  assert.equal(report.summary.meetsTarget, false);
  assert.match(textReport, /Check execution reliability audit/);
  assert.match(textReport, /Target met: no/);
});
