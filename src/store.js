import { applyIncidentAction } from "./domain/incidents.js";
import { seedIncidents } from "./domain/seed.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore(seed = seedIncidents) {
  const incidents = new Map(seed.map((incident) => [incident.id, clone(incident)]));

  function getIncident(incidentId) {
    const incident = incidents.get(incidentId);

    if (!incident) {
      return null;
    }

    return clone(incident);
  }

  function updateIncident(incidentId, updater) {
    const current = incidents.get(incidentId);

    if (!current) {
      return null;
    }

    const nextIncident = updater(clone(current));
    incidents.set(incidentId, clone(nextIncident));
    return clone(nextIncident);
  }

  return {
    getIncident,
    listIncidents() {
      return [...incidents.values()].map(clone);
    },
    applyIncidentAction(incidentId, action) {
      return updateIncident(incidentId, (incident) =>
        applyIncidentAction(incident, action),
      );
    },
  };
}
