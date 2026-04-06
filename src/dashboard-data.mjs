const ENVIRONMENTS = ["production", "staging", "edge"];
const TAGS = ["checkout", "api", "search", "auth", "catalog"];
const STATUSES = ["healthy", "healthy", "healthy", "healthy", "degraded", "incident", "paused"];
const INCIDENT_STATES = ["none", "none", "none", "watching", "open"];

function pad(value) {
  return String(value).padStart(3, "0");
}

function createMonitor(index) {
  const environment = ENVIRONMENTS[index % ENVIRONMENTS.length];
  const tag = TAGS[index % TAGS.length];
  const status = STATUSES[index % STATUSES.length];
  const incidentState =
    status === "incident" ? "open" : INCIDENT_STATES[(index + 2) % INCIDENT_STATES.length];
  const latencyMs = 182 + ((index * 37) % 380);
  const availability30d = status === "incident" ? 97.42 : Math.min(99.99, 98.62 + ((index * 17) % 118) / 100);
  const checks30d = 720;
  const incidents30d = status === "incident" ? 1 + (index % 3) : index % 2;

  return {
    id: `mon-${pad(index + 1)}`,
    name: `${tag}-${environment}-${pad(index + 1)}`,
    environment,
    status,
    tag,
    incidentState,
    latencyMs,
    availability30d: Number(availability30d.toFixed(2)),
    checks30d,
    incidents30d,
    lastCheckedAt: `${(index % 8) + 1}m ago`,
    nextRunAt: `${(index % 5) + 1}m`,
    sparkline: [0, 1, 1, 1, 1, status === "incident" ? 0 : 1, 1, 1]
  };
}

function createIncident(monitor, index) {
  return {
    id: `INC-${420 + index}`,
    monitorName: monitor.name,
    environment: monitor.environment,
    age: `${14 + (index * 7)}m`,
    severity: index % 2 === 0 ? "critical" : "elevated",
    summary:
      index % 2 === 0
        ? `Latency breach on ${monitor.tag} path over 30-day baseline`
        : `Availability dip persisted past threshold`,
    owner: index % 3 === 0 ? "On-call SRE" : "Unassigned"
  };
}

export function createDashboardData() {
  const monitors = Array.from({ length: 180 }, (_, index) => createMonitor(index));
  const openIncidentMonitors = monitors.filter((monitor) => monitor.status === "incident").slice(0, 8);
  const summary = monitors.reduce(
    (accumulator, monitor) => {
      accumulator.total += 1;
      accumulator[monitor.status] += 1;
      if (monitor.incidentState === "open") {
        accumulator.openIncidents += 1;
      }
      return accumulator;
    },
    {
      total: 0,
      healthy: 0,
      degraded: 0,
      incident: 0,
      paused: 0,
      openIncidents: 0
    }
  );

  return {
    generatedAt: "2026-04-06T00:00:00.000Z",
    dataset: {
      spanDays: 30,
      monitorCount: monitors.length,
      checksPerMonitor: 720
    },
    filters: {
      environments: ENVIRONMENTS,
      statuses: ["all", "healthy", "degraded", "incident", "paused"],
      tags: ["all", ...TAGS],
      incidentStates: ["all", "none", "watching", "open"]
    },
    summary,
    incidents: openIncidentMonitors.map((monitor, index) => createIncident(monitor, index)),
    monitors
  };
}

export function filterMonitors(monitors, filters) {
  return monitors.filter((monitor) => {
    if (filters.environment !== "all" && monitor.environment !== filters.environment) {
      return false;
    }
    if (filters.status !== "all" && monitor.status !== filters.status) {
      return false;
    }
    if (filters.tag !== "all" && monitor.tag !== filters.tag) {
      return false;
    }
    if (filters.incidentState !== "all" && monitor.incidentState !== filters.incidentState) {
      return false;
    }
    return true;
  });
}
