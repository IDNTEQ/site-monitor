import { incidents } from "../data/incident-fixtures.js";

export class IncidentRepository {
  findIncidentById(incidentId) {
    return incidents.find((incident) => incident.id === incidentId) ?? null;
  }

  listIncidents() {
    return incidents.map((incident) => ({
      id: incident.id,
      state: incident.state,
      monitorName: incident.affectedMonitor.name,
      openedAt: incident.openedAt
    }));
  }
}
