import {
  renderCheckExecutionMetrics,
  summarizeCheckExecutionReliability
} from "./checkExecutionReliability.js";

function formatMonitorLine(monitorSummary) {
  return [
    `- ${monitorSummary.monitorId}`,
    `${monitorSummary.completedChecks}/${monitorSummary.scheduledChecks} completed`,
    `${monitorSummary.completionRate.toFixed(4)} ratio`
  ].join(" | ");
}

export function createStagingReliabilityAudit(payload) {
  const environment = payload.environment ?? "staging";
  const summary = summarizeCheckExecutionReliability(payload.records ?? [], {
    windowStart: payload.windowStart,
    windowEnd: payload.windowEnd,
    target: payload.target
  });
  const metrics = renderCheckExecutionMetrics(summary, { environment });

  return {
    environment,
    summary,
    metrics
  };
}

export function formatTextAuditReport(report) {
  const monitorLines = report.summary.monitorSummaries.length === 0
    ? ["- none"]
    : report.summary.monitorSummaries.map(formatMonitorLine);

  return [
    "Check execution reliability audit",
    `Environment: ${report.environment}`,
    `Window: ${report.summary.windowStart} -> ${report.summary.windowEnd}`,
    `Scheduled checks: ${report.summary.scheduledChecks}`,
    `Completed checks: ${report.summary.completedChecks}`,
    `Missed checks: ${report.summary.missedChecks}`,
    `Completion rate: ${report.summary.completionPercent.toFixed(2)}%`,
    `Target: ${(report.summary.target * 100).toFixed(2)}%`,
    `Target met: ${report.summary.meetsTarget ? "yes" : "no"}`,
    `Allowed misses: ${report.summary.allowedMisses}`,
    `Error budget remaining: ${report.summary.errorBudgetRemaining}`,
    "Per-monitor breakdown:",
    ...monitorLines,
    "",
    "Prometheus metrics:",
    report.metrics.trimEnd()
  ].join("\n");
}
