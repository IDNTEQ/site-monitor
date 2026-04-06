const TIMELINE_LABELS = {
  failure_started: "Failure onset",
  notification_sent: "Notification delivery",
  acknowledged: "Acknowledged",
  recovered: "Recovered",
  resolved: "Manual resolution"
};

function sortDescendingByDate(records, field) {
  return [...records].sort(
    (left, right) => Date.parse(right[field]) - Date.parse(left[field])
  );
}

function sortAscendingByDate(records, field) {
  return [...records].sort(
    (left, right) => Date.parse(left[field]) - Date.parse(right[field])
  );
}

function getFirstFailureTime(checkResults) {
  const failedChecks = checkResults.filter((result) => result.outcome === "failed");
  if (failedChecks.length === 0) {
    return null;
  }

  return sortAscendingByDate(failedChecks, "checkedAt")[0].checkedAt;
}

export function getIncidentDetail(repository, incidentId) {
  const incident = repository.findIncidentById(incidentId);

  if (!incident) {
    return null;
  }

  return {
    incident: {
      id: incident.id,
      status: incident.state,
      openedAt: incident.openedAt,
      acknowledgedAt: incident.acknowledgedAt,
      resolvedAt: incident.resolvedAt,
      firstFailureAt: getFirstFailureTime(incident.checkResults),
      affectedMonitor: incident.affectedMonitor
    },
    latestCheckOutcomes: sortDescendingByDate(incident.checkResults, "checkedAt").map(
      (result) => ({
        id: result.id,
        checkedAt: result.checkedAt,
        outcome: result.outcome,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        errorClass: result.errorClass,
        matchingRuleResult: result.matchingRuleResult
      })
    ),
    deliveryHistory: sortDescendingByDate(
      incident.deliveryHistory,
      "deliveredAt"
    ).map((delivery) => ({
      id: delivery.id,
      channel: delivery.channel,
      target: delivery.target,
      status: delivery.status,
      deliveredAt: delivery.deliveredAt,
      detail: delivery.detail
    })),
    timeline: sortAscendingByDate(incident.timeline, "createdAt").map((event) => ({
      id: event.id,
      type: event.type,
      label: TIMELINE_LABELS[event.type] ?? event.type,
      actor: event.actor,
      createdAt: event.createdAt,
      summary: event.summary,
      note: event.note ?? null
    }))
  };
}
