const DEFAULT_TARGET = 0.99;
const TERMINAL_OUTCOMES = new Set([
  "succeeded",
  "failed",
  "timeout",
  "dns_error",
  "tls_error",
  "connection_error",
  "http_error"
]);

function parseTimestamp(value, fieldName) {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`Expected ${fieldName} to be an ISO-8601 timestamp. Received: ${value}`);
  }

  return timestamp;
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") {
    throw new Error("Expected each reliability record to be an object.");
  }

  if (!record.checkId) {
    throw new Error("Expected reliability records to include checkId.");
  }

  if (!record.monitorId) {
    throw new Error("Expected reliability records to include monitorId.");
  }

  if (!record.scheduledAt) {
    throw new Error("Expected reliability records to include scheduledAt.");
  }

  return {
    checkId: String(record.checkId),
    monitorId: String(record.monitorId),
    scheduledAt: String(record.scheduledAt),
    completedAt: record.completedAt ? String(record.completedAt) : null,
    outcome: record.outcome ? String(record.outcome) : null
  };
}

function didCheckComplete(record) {
  if (!record.completedAt) {
    return false;
  }

  if (!record.outcome) {
    return true;
  }

  return TERMINAL_OUTCOMES.has(record.outcome);
}

function roundRatio(value) {
  return Number(value.toFixed(6));
}

function toMetricLabels(labels) {
  const serialized = Object.entries(labels)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}="${String(value).replaceAll("\"", "\\\"")}"`);

  return serialized.length === 0 ? "" : `{${serialized.join(",")}}`;
}

function formatMetric(name, value, labels = {}) {
  return `${name}${toMetricLabels(labels)} ${value}`;
}

function createMonitorSummary(records, target) {
  const scheduledChecks = records.length;
  const completedChecks = records.filter(didCheckComplete).length;
  const missedChecks = scheduledChecks - completedChecks;
  const completionRate = scheduledChecks === 0 ? 0 : completedChecks / scheduledChecks;

  return {
    monitorId: records[0]?.monitorId ?? "unknown",
    scheduledChecks,
    completedChecks,
    missedChecks,
    completionRate: roundRatio(completionRate),
    meetsTarget: scheduledChecks > 0 && completionRate >= target
  };
}

export function summarizeCheckExecutionReliability(records, options) {
  if (!Array.isArray(records)) {
    throw new Error("Expected records to be an array.");
  }

  if (!options || typeof options !== "object") {
    throw new Error("Expected options to include windowStart and windowEnd.");
  }

  const target = options.target ?? DEFAULT_TARGET;

  if (typeof target !== "number" || !Number.isFinite(target) || target <= 0 || target > 1) {
    throw new Error("Expected target to be a number between 0 and 1.");
  }

  const windowStart = parseTimestamp(options.windowStart, "windowStart");
  const windowEnd = parseTimestamp(options.windowEnd, "windowEnd");

  if (windowStart >= windowEnd) {
    throw new Error("Expected windowStart to be earlier than windowEnd.");
  }

  const normalizedRecords = records
    .map(normalizeRecord)
    .map((record) => ({
      ...record,
      scheduledAtMs: parseTimestamp(record.scheduledAt, "scheduledAt"),
      completedAtMs: record.completedAt ? parseTimestamp(record.completedAt, "completedAt") : null
    }))
    .filter((record) => record.scheduledAtMs >= windowStart && record.scheduledAtMs < windowEnd)
    .sort((left, right) => left.scheduledAtMs - right.scheduledAtMs);

  const scheduledChecks = normalizedRecords.length;
  const completedChecks = normalizedRecords.filter(didCheckComplete).length;
  const missedChecks = scheduledChecks - completedChecks;
  const completionRate = scheduledChecks === 0 ? 0 : completedChecks / scheduledChecks;
  const allowedMisses = Math.floor(scheduledChecks * (1 - target));
  const monitorGroups = new Map();

  for (const record of normalizedRecords) {
    const existing = monitorGroups.get(record.monitorId) ?? [];
    existing.push(record);
    monitorGroups.set(record.monitorId, existing);
  }

  const monitorSummaries = [...monitorGroups.values()]
    .map((monitorRecords) => createMonitorSummary(monitorRecords, target))
    .sort((left, right) => left.monitorId.localeCompare(right.monitorId));

  return {
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowEnd).toISOString(),
    target: roundRatio(target),
    scheduledChecks,
    completedChecks,
    missedChecks,
    allowedMisses,
    errorBudgetRemaining: allowedMisses - missedChecks,
    completionRate: roundRatio(completionRate),
    completionPercent: roundRatio(completionRate * 100),
    meetsTarget: scheduledChecks > 0 && completionRate >= target,
    monitorSummaries
  };
}

export function renderCheckExecutionMetrics(summary, labels = {}) {
  if (!summary || typeof summary !== "object") {
    throw new Error("Expected summary to be an object.");
  }

  const lines = [
    "# HELP site_monitor_worker_scheduled_checks_total Scheduled checks seen in the audit window.",
    "# TYPE site_monitor_worker_scheduled_checks_total counter",
    formatMetric("site_monitor_worker_scheduled_checks_total", summary.scheduledChecks, labels),
    "# HELP site_monitor_worker_completed_checks_total Scheduled checks that reached a terminal outcome.",
    "# TYPE site_monitor_worker_completed_checks_total counter",
    formatMetric("site_monitor_worker_completed_checks_total", summary.completedChecks, labels),
    "# HELP site_monitor_worker_missed_checks_total Scheduled checks missing a terminal completion record.",
    "# TYPE site_monitor_worker_missed_checks_total counter",
    formatMetric("site_monitor_worker_missed_checks_total", summary.missedChecks, labels),
    "# HELP site_monitor_worker_check_completion_ratio Completion ratio for scheduled checks in the audit window.",
    "# TYPE site_monitor_worker_check_completion_ratio gauge",
    formatMetric("site_monitor_worker_check_completion_ratio", summary.completionRate, labels),
    "# HELP site_monitor_worker_check_completion_target_ratio Required completion ratio for reliability compliance.",
    "# TYPE site_monitor_worker_check_completion_target_ratio gauge",
    formatMetric("site_monitor_worker_check_completion_target_ratio", summary.target, labels),
    "# HELP site_monitor_worker_check_completion_target_met Whether the completion ratio meets the reliability target.",
    "# TYPE site_monitor_worker_check_completion_target_met gauge",
    formatMetric("site_monitor_worker_check_completion_target_met", summary.meetsTarget ? 1 : 0, labels)
  ];

  for (const monitorSummary of summary.monitorSummaries ?? []) {
    const monitorLabels = { ...labels, monitor_id: monitorSummary.monitorId };
    lines.push(
      formatMetric("site_monitor_worker_monitor_scheduled_checks_total", monitorSummary.scheduledChecks, monitorLabels),
      formatMetric("site_monitor_worker_monitor_completed_checks_total", monitorSummary.completedChecks, monitorLabels),
      formatMetric("site_monitor_worker_monitor_missed_checks_total", monitorSummary.missedChecks, monitorLabels),
      formatMetric("site_monitor_worker_monitor_check_completion_ratio", monitorSummary.completionRate, monitorLabels)
    );
  }

  return `${lines.join("\n")}\n`;
}
