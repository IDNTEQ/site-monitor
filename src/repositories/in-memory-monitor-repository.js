export class InMemoryMonitorRepository {
  constructor({ monitors = [] } = {}) {
    this.monitors = new Map(
      monitors.map((monitor) => [monitor.id, structuredClone(monitor)]),
    );
  }

  async listMonitors() {
    return [...this.monitors.values()].map((monitor) => structuredClone(monitor));
  }

  async findIncidentById(incidentId) {
    for (const monitor of this.monitors.values()) {
      const currentIncident = monitor.currentIncident;
      if (currentIncident?.id === incidentId) {
        return structuredClone({
          id: currentIncident.id,
          state: currentIncident.state,
          severity: currentIncident.severity ?? "unknown",
          openedAt: currentIncident.openedAt ?? null,
          acknowledgedAt: currentIncident.acknowledgedAt ?? null,
          resolvedAt: currentIncident.resolvedAt ?? null,
          monitor: {
            id: monitor.id,
            name: monitor.name,
            environment: monitor.environment,
            url: monitor.url,
          },
        });
      }
    }

    return null;
  }
}
