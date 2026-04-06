export class IncidentNotFoundError extends Error {
  constructor(incidentId) {
    super(`Incident ${incidentId} was not found.`);
    this.name = "IncidentNotFoundError";
  }
}

function normalizeTimestamp(value, fieldName) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${fieldName} must be a valid ISO timestamp.`);
  }

  return parsed.toISOString();
}

function normalizeBoundedInteger(value, { defaultValue, minimum, maximum }) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function deriveDashboardStatus(monitor) {
  if (monitor.status === "paused") {
    return "paused";
  }

  if (monitor.currentIncident?.state === "open") {
    return "incident";
  }

  if (monitor.healthState === "degraded") {
    return "degraded";
  }

  return "healthy";
}

function deriveRecentIncidentState(monitor) {
  if (typeof monitor.recentIncidentState === "string") {
    return monitor.recentIncidentState;
  }

  if (monitor.currentIncident?.state === "open") {
    return "open";
  }

  return "none";
}

function compareDescendingTimestamps(left, right, leftTimestamp, rightTimestamp) {
  if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
    return rightTimestamp.localeCompare(leftTimestamp);
  }

  if (rightTimestamp) {
    return 1;
  }

  if (leftTimestamp) {
    return -1;
  }

  return left.name.localeCompare(right.name);
}

export function createDashboardService({
  repository,
  clock = () => new Date(),
}) {
  async function getDashboard(filters = {}) {
    const asOf = normalizeTimestamp(filters.asOf ?? clock(), "asOf");
    const datasetDays = normalizeBoundedInteger(filters.datasetDays, {
      defaultValue: 30,
      minimum: 1,
      maximum: 30,
    });
    const monitorLimit = normalizeBoundedInteger(filters.monitorLimit, {
      defaultValue: 50,
      minimum: 1,
      maximum: 100,
    });
    const incidentLimit = normalizeBoundedInteger(filters.incidentLimit, {
      defaultValue: 10,
      minimum: 1,
      maximum: 25,
    });
    const startedAt = new Date(
      Date.parse(asOf) - datasetDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const monitors = (await repository.listMonitors())
      .filter((monitor) => monitor.status !== "archived")
      .filter((monitor) => {
        const activityAt =
          monitor.lastCheckAt ??
          monitor.currentIncident?.openedAt ??
          monitor.updatedAt ??
          monitor.createdAt ??
          null;

        if (!activityAt) {
          return true;
        }

        return activityAt >= startedAt && activityAt <= asOf;
      });

    const rows = monitors.map((monitor) => ({
      id: monitor.id,
      name: monitor.name,
      environment: monitor.environment,
      tags: monitor.tags ?? [],
      status: deriveDashboardStatus(monitor),
      recentIncidentState: deriveRecentIncidentState(monitor),
      incidentId: monitor.currentIncident?.id ?? null,
      lastCheckAt: monitor.lastCheckAt ?? null,
      responseTimeMs: monitor.responseTimeMs ?? null,
    }));

    const summary = {
      healthy: rows.filter((monitor) => monitor.status === "healthy").length,
      degraded: rows.filter((monitor) => monitor.status === "degraded").length,
      paused: rows.filter((monitor) => monitor.status === "paused").length,
      incident: rows.filter((monitor) => monitor.status === "incident").length,
    };

    const filteredMonitors = rows
      .filter((monitor) => {
        if (filters.environment && monitor.environment !== filters.environment) {
          return false;
        }

        if (filters.status && monitor.status !== filters.status) {
          return false;
        }

        if (filters.tag && !monitor.tags.includes(filters.tag)) {
          return false;
        }

        if (
          filters.recentIncidentState &&
          monitor.recentIncidentState !== filters.recentIncidentState
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) =>
        compareDescendingTimestamps(left, right, left.lastCheckAt, right.lastCheckAt),
      );

    const openIncidents = monitors
      .filter((monitor) => monitor.currentIncident?.state === "open")
      .map((monitor) => ({
        id: monitor.currentIncident.id,
        monitorId: monitor.id,
        monitorName: monitor.name,
        state: monitor.currentIncident.state,
        severity: monitor.currentIncident.severity ?? "unknown",
        openedAt: monitor.currentIncident.openedAt ?? null,
        link: `/incidents/${monitor.currentIncident.id}`,
      }))
      .sort((left, right) =>
        compareDescendingTimestamps(left, right, left.openedAt, right.openedAt),
      );

    return {
      summary,
      dataset: {
        asOf,
        startedAt,
        days: datasetDays,
        monitorLimit,
        incidentLimit,
        totalMonitorRows: filteredMonitors.length,
        totalOpenIncidents: openIncidents.length,
        truncatedMonitors: filteredMonitors.length > monitorLimit,
        truncatedOpenIncidents: openIncidents.length > incidentLimit,
      },
      monitors: filteredMonitors.slice(0, monitorLimit),
      openIncidents: openIncidents.slice(0, incidentLimit),
    };
  }

  async function getIncidentSummary(incidentId) {
    const incident = await repository.findIncidentById(incidentId);

    if (!incident) {
      throw new IncidentNotFoundError(incidentId);
    }

    return incident;
  }

  return {
    getDashboard,
    getIncidentSummary,
  };
}
