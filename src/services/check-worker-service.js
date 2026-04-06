import { randomUUID } from "node:crypto";

const RELIABILITY_TARGET = 0.99;

function normalizeTimestamp(value) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Expected a valid ISO timestamp.");
  }

  return parsed.toISOString();
}

function isMonitorDue(monitor, checkedAt) {
  if (monitor.status !== "active") {
    return false;
  }

  const lastCheckResult = (monitor.checkResults ?? []).at(-1);
  if (!lastCheckResult) {
    return true;
  }

  return (
    Date.parse(lastCheckResult.checkedAt) + monitor.intervalSeconds * 1000 <=
    Date.parse(checkedAt)
  );
}

function countTrailingFailures(checkResults) {
  let count = 0;
  for (let index = checkResults.length - 1; index >= 0; index -= 1) {
    if (checkResults[index].outcome !== "failure") {
      break;
    }
    count += 1;
  }

  return count;
}

function determineOutcome(monitor, checkResponse) {
  const statusOk =
    checkResponse.statusCode >= monitor.expectedStatusMin &&
    checkResponse.statusCode <= monitor.expectedStatusMax;
  const matchingRuleResult = checkResponse.matchingRuleResult ?? "matched";
  const keywordOk =
    !monitor.keyword || matchingRuleResult === "matched" || matchingRuleResult === "status_mismatch";

  return {
    outcome: statusOk && keywordOk ? "success" : "failure",
    matchingRuleResult,
  };
}

function calculateReliabilityMetrics(scheduledChecks, completedChecks) {
  const missedChecks = scheduledChecks - completedChecks;
  const completionRate = scheduledChecks === 0 ? 1 : completedChecks / scheduledChecks;

  return {
    scheduledChecks,
    completedChecks,
    missedChecks,
    completionRate,
    meetsTarget: completionRate >= RELIABILITY_TARGET,
  };
}

function isRunWithinWindow(workerRun, startedAt, endedAt) {
  if (startedAt && workerRun.checkedAt < startedAt) {
    return false;
  }

  if (endedAt && workerRun.checkedAt > endedAt) {
    return false;
  }

  return true;
}

export function createCheckWorkerService({
  repository,
  fetchCheck,
  createId = () => randomUUID(),
}) {
  async function runDueMonitors(checkedAtInput) {
    const checkedAt = normalizeTimestamp(checkedAtInput);
    const monitors = await repository.list();
    const dueMonitors = monitors.filter((monitor) => isMonitorDue(monitor, checkedAt));
    const results = [];
    const monitorAudits = [];

    for (const monitor of dueMonitors) {
      try {
        const checkResponse = await fetchCheck(monitor);
        const { outcome, matchingRuleResult } = determineOutcome(monitor, checkResponse);
        const checkResult = {
          id: createId(),
          statusCode: checkResponse.statusCode,
          responseTimeMs: checkResponse.responseTimeMs,
          outcome,
          checkedAt,
          errorClass: checkResponse.errorClass ?? null,
          matchingRuleResult,
        };

        const nextCheckResults = [...(monitor.checkResults ?? []), checkResult];
        const updatedMonitor = {
          ...monitor,
          checkResults: nextCheckResults,
          lastCheckAt: checkedAt,
          responseTimeMs: checkResponse.responseTimeMs,
          healthState: outcome === "failure" ? "degraded" : "healthy",
        };

        const trailingFailures = countTrailingFailures(nextCheckResults);
        const failureThreshold = monitor.alertPolicy?.failureThreshold ?? Number.POSITIVE_INFINITY;
        if (
          outcome === "failure" &&
          trailingFailures >= failureThreshold &&
          !updatedMonitor.currentIncident
        ) {
          const firstFailureAt =
            nextCheckResults[nextCheckResults.length - trailingFailures].checkedAt;
          const incident = {
            id: createId(),
            state: "open",
            muted: false,
            firstFailureAt,
            openedAt: checkedAt,
            acknowledgedAt: null,
            resolvedAt: null,
            latestCheckResults: nextCheckResults.slice(-trailingFailures),
            deliveryHistory: [],
            timeline: [
              {
                eventType: "failure_onset",
                actor: "system",
                note: "Threshold breached",
                createdAt: checkedAt,
              },
            ],
          };

          updatedMonitor.currentIncident = {
            id: incident.id,
            state: incident.state,
            openedAt: incident.openedAt,
            muted: incident.muted,
          };
          updatedMonitor.incidents = [...(monitor.incidents ?? []), incident];
          updatedMonitor.recentIncidentState = "open";
        }

        await repository.update(updatedMonitor);

        const result = {
          monitorId: monitor.id,
          status: "completed",
          outcome,
          openedIncidentId: updatedMonitor.currentIncident?.id ?? null,
        };
        results.push(result);
        monitorAudits.push({
          ...result,
          checkedAt,
        });
      } catch (error) {
        const result = {
          monitorId: monitor.id,
          status: "missed",
          outcome: null,
          openedIncidentId: null,
          errorClass: error.name ?? "Error",
          errorMessage: error.message,
        };
        results.push(result);
        monitorAudits.push({
          ...result,
          checkedAt,
        });
      }
    }

    const completedChecks = monitorAudits.filter((audit) => audit.status === "completed").length;
    const workerRun = {
      id: createId(),
      checkedAt,
      ...calculateReliabilityMetrics(dueMonitors.length, completedChecks),
      monitorAudits,
    };

    if (typeof repository.appendWorkerRun === "function") {
      await repository.appendWorkerRun(workerRun);
    }

    return results;
  }

  async function getReliabilitySummary({ startedAt, endedAt } = {}) {
    const normalizedStartedAt = startedAt ? normalizeTimestamp(startedAt) : null;
    const normalizedEndedAt = endedAt ? normalizeTimestamp(endedAt) : null;
    const workerRuns =
      typeof repository.listWorkerRuns === "function" ? await repository.listWorkerRuns() : [];
    const runs = workerRuns
      .filter((workerRun) =>
        isRunWithinWindow(workerRun, normalizedStartedAt, normalizedEndedAt),
      )
      .sort((left, right) => left.checkedAt.localeCompare(right.checkedAt));
    const totals = calculateReliabilityMetrics(
      runs.reduce((sum, workerRun) => sum + workerRun.scheduledChecks, 0),
      runs.reduce((sum, workerRun) => sum + workerRun.completedChecks, 0),
    );

    return {
      window: {
        startedAt: normalizedStartedAt,
        endedAt: normalizedEndedAt,
      },
      reliabilityTarget: RELIABILITY_TARGET,
      totals,
      runs,
    };
  }

  return {
    getReliabilitySummary,
    runDueMonitors,
  };
}
