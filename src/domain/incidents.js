const ACTIVE_STATES = new Set(["open", "acknowledged"]);

function assertManualActor(actor) {
  if (!actor || !actor.trim()) {
    throw new Error("Actor is required for manual incident actions.");
  }
}

function assertActiveIncident(incident, action) {
  if (!ACTIVE_STATES.has(incident.state)) {
    throw new Error(`Cannot ${action} a resolved incident.`);
  }
}

function createEvent({
  eventType,
  actor,
  note = "",
  at,
  metadata = {},
}) {
  return {
    id: `evt-${Math.random().toString(36).slice(2, 10)}`,
    eventType,
    actor,
    note,
    createdAt: at,
    metadata,
  };
}

export function acknowledgeIncident(incident, { actor, note = "", at }) {
  assertManualActor(actor);
  assertActiveIncident(incident, "acknowledge");

  return {
    ...incident,
    state: "acknowledged",
    acknowledgedAt: incident.acknowledgedAt ?? at,
    owner: actor.trim(),
    events: [
      createEvent({
        eventType: "acknowledged",
        actor: actor.trim(),
        note,
        at,
      }),
      ...incident.events,
    ],
  };
}

export function muteIncident(incident, { actor, note = "", at }) {
  assertManualActor(actor);
  assertActiveIncident(incident, "mute");

  return {
    ...incident,
    alertsMuted: true,
    mutedAt: at,
    events: [
      createEvent({
        eventType: "muted",
        actor: actor.trim(),
        note,
        at,
      }),
      ...incident.events,
    ],
  };
}

export function unmuteIncident(incident, { actor, note = "", at }) {
  assertManualActor(actor);
  assertActiveIncident(incident, "unmute");

  return {
    ...incident,
    alertsMuted: false,
    mutedAt: null,
    events: [
      createEvent({
        eventType: "unmuted",
        actor: actor.trim(),
        note,
        at,
      }),
      ...incident.events,
    ],
  };
}

export function resolveIncident(
  incident,
  { actor, note = "", at, source = "manual" },
) {
  if (source === "manual") {
    assertManualActor(actor);
  }

  if (incident.state === "resolved") {
    throw new Error("Incident is already resolved.");
  }

  return {
    ...incident,
    state: "resolved",
    alertsMuted: false,
    mutedAt: null,
    resolvedAt: at,
    events: [
      createEvent({
        eventType: source === "auto" ? "auto_resolved" : "resolved",
        actor: source === "auto" ? "site-monitor" : actor.trim(),
        note,
        at,
        metadata: {
          source,
        },
      }),
      ...incident.events,
    ],
  };
}

export function autoResolveIncident(
  incident,
  { at, note = "Recovery threshold satisfied.", recovered, consecutiveRecoveries },
) {
  if (incident.state === "resolved") {
    return incident;
  }

  const threshold = incident.policy.recoveryThreshold;
  const nextRecoveryCount = recovered ? consecutiveRecoveries : 0;

  if (!recovered || nextRecoveryCount < threshold) {
    return {
      ...incident,
      recoveryCount: nextRecoveryCount,
    };
  }

  return resolveIncident(incident, {
    actor: "site-monitor",
    note,
    at,
    source: "auto",
  });
}

export function applyIncidentAction(incident, action) {
  switch (action.type) {
    case "acknowledge":
      return acknowledgeIncident(incident, action);
    case "mute":
      return muteIncident(incident, action);
    case "unmute":
      return unmuteIncident(incident, action);
    case "resolve":
      return resolveIncident(incident, {
        actor: action.actor,
        note: action.note,
        at: action.at,
        source: "manual",
      });
    default:
      throw new Error(`Unsupported incident action: ${action.type}`);
  }
}
