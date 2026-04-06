import { randomUUID } from "node:crypto";

import {
  isMaintenanceWindowActive,
  validateAlertPolicy,
  validateMaintenanceWindowInput,
  validatePolicyPreviewInput,
} from "../domain/alerting.js";
import {
  validateCreateMonitorInput,
  validateUpdateMonitorInput,
} from "../domain/monitor.js";
import { createSecretCodec } from "../domain/secrets.js";

export class MonitorValidationError extends Error {
  constructor(fieldErrors) {
    super("Monitor validation failed.");
    this.name = "MonitorValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class MonitorNotFoundError extends Error {
  constructor(monitorId) {
    super(`Monitor ${monitorId} was not found.`);
    this.name = "MonitorNotFoundError";
  }
}

export class IncidentNotFoundError extends Error {
  constructor(incidentId) {
    super(`Incident ${incidentId} was not found.`);
    this.name = "IncidentNotFoundError";
  }
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

function normalizeTimestamp(value, fieldName) {
  const timestamp = value instanceof Date ? value.toISOString() : value;
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    throw new MonitorValidationError({
      [fieldName]: `${fieldName} must be a valid ISO timestamp.`,
    });
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

function deriveDashboardActivityAt(monitor) {
  return (
    monitor.lastCheckAt ??
    monitor.currentIncident?.openedAt ??
    monitor.updatedAt ??
    monitor.createdAt ??
    null
  );
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

function sanitizeAlertPolicy(alertPolicy) {
  if (!alertPolicy) {
    return null;
  }

  return {
    failureThreshold: alertPolicy.failureThreshold,
    recoveryThreshold: alertPolicy.recoveryThreshold,
    notificationChannels: [...(alertPolicy.notificationChannels ?? [])],
    escalationTarget: alertPolicy.escalationTarget,
    notificationCredentialChannels: Object.keys(
      alertPolicy.notificationCredentialsEncrypted ?? {},
    ),
  };
}

function sanitizeMonitor(monitor) {
  const { authSecretEncrypted, ...rest } = monitor;
  return {
    ...rest,
    authSecretConfigured: Boolean(authSecretEncrypted),
    alertPolicy: sanitizeAlertPolicy(monitor.alertPolicy),
  };
}

export function createMonitorService({
  repository,
  clock = () => new Date(),
  createId = () => randomUUID(),
  secretCodec = createSecretCodec(),
}) {
  function mergeEncryptedCredentials(existingCredentials, nextPolicyInput) {
    const allowedChannels = new Set(nextPolicyInput.notificationChannels);
    const merged = Object.fromEntries(
      Object.entries(existingCredentials ?? {}).filter(([channel]) =>
        allowedChannels.has(channel),
      ),
    );

    if (nextPolicyInput.notificationCredentials) {
      for (const [channel, secret] of Object.entries(nextPolicyInput.notificationCredentials)) {
        merged[channel] = secretCodec.encrypt(secret);
      }
    }

    return merged;
  }

  function buildStoredAlertPolicy(nextPolicyInput, existingPolicy = null) {
    if (!nextPolicyInput) {
      return null;
    }

    return {
      failureThreshold: nextPolicyInput.failureThreshold,
      recoveryThreshold: nextPolicyInput.recoveryThreshold,
      notificationChannels: [...nextPolicyInput.notificationChannels],
      escalationTarget: nextPolicyInput.escalationTarget,
      notificationCredentialsEncrypted: mergeEncryptedCredentials(
        existingPolicy?.notificationCredentialsEncrypted,
        nextPolicyInput,
      ),
    };
  }

  async function getIncidentRecord(incidentId) {
    const monitors = await repository.list();

    for (const monitor of monitors) {
      const incidentIndex = (monitor.incidents ?? []).findIndex(
        (candidate) => candidate.id === incidentId,
      );
      if (incidentIndex === -1) {
        continue;
      }

      return {
        monitor,
        incidentIndex,
        incident: monitor.incidents[incidentIndex],
      };
    }

    throw new IncidentNotFoundError(incidentId);
  }

  function buildIncidentDetail(monitor, incident) {
    return {
      incident: {
        id: incident.id,
        state: incident.state,
        muted: incident.muted ?? false,
        affectedMonitor: {
          id: monitor.id,
          name: monitor.name,
          environment: monitor.environment,
          url: monitor.url,
        },
        firstFailureAt: incident.firstFailureAt ?? incident.openedAt ?? null,
        openedAt: incident.openedAt ?? null,
        acknowledgedAt: incident.acknowledgedAt ?? null,
        resolvedAt: incident.resolvedAt ?? null,
      },
      latestCheckResults: [...(incident.latestCheckResults ?? [])].sort((left, right) =>
        right.checkedAt.localeCompare(left.checkedAt),
      ),
      deliveryHistory: [...(incident.deliveryHistory ?? [])],
      timeline: [...(incident.timeline ?? [])].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      ),
    };
  }

  async function saveUpdatedIncident(monitor, incidentIndex, updatedIncident, timestamp) {
    const incidents = [...(monitor.incidents ?? [])];
    incidents[incidentIndex] = updatedIncident;

    const currentIncident =
      monitor.currentIncident?.id === updatedIncident.id
        ? {
            ...monitor.currentIncident,
            state: updatedIncident.state,
            muted: updatedIncident.muted ?? false,
            acknowledgedAt: updatedIncident.acknowledgedAt ?? null,
            resolvedAt: updatedIncident.resolvedAt ?? null,
          }
        : monitor.currentIncident;

    const updatedMonitor = {
      ...monitor,
      incidents,
      currentIncident,
      recentIncidentState: updatedIncident.state === "resolved" ? "resolved" : "open",
      updatedAt: timestamp,
    };

    await repository.update(updatedMonitor);
    return updatedMonitor;
  }

  async function createMonitor(input) {
    const monitorValidation = validateCreateMonitorInput(input);
    const alertPolicyValidation =
      "alertPolicy" in input
        ? validateAlertPolicy(input.alertPolicy)
        : { fieldErrors: {}, normalized: null };
    const fieldErrors = {
      ...monitorValidation.fieldErrors,
      ...alertPolicyValidation.fieldErrors,
    };

    if (Object.keys(fieldErrors).length > 0) {
      throw new MonitorValidationError(fieldErrors);
    }

    const timestamp = clock().toISOString();
    const { authSecret, ...normalizedMonitor } = monitorValidation.normalized;
    const monitor = {
      id: createId(),
      ...normalizedMonitor,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      archivedAt: null,
      authSecretEncrypted: authSecret ? secretCodec.encrypt(authSecret) : null,
      alertPolicy: buildStoredAlertPolicy(alertPolicyValidation.normalized),
      maintenanceWindows: [],
    };

    const created = await repository.create(monitor);
    return sanitizeMonitor(created);
  }

  async function updateMonitor(monitorId, input) {
    const existingMonitor = await repository.getById(monitorId);
    if (!existingMonitor) {
      throw new MonitorNotFoundError(monitorId);
    }

    const monitorValidation = validateUpdateMonitorInput(existingMonitor, input);
    const alertPolicyValidation =
      "alertPolicy" in input
        ? validateAlertPolicy(input.alertPolicy)
        : { fieldErrors: {}, normalized: existingMonitor.alertPolicy };
    const fieldErrors = {
      ...monitorValidation.fieldErrors,
      ...alertPolicyValidation.fieldErrors,
    };

    if (Object.keys(fieldErrors).length > 0) {
      throw new MonitorValidationError(fieldErrors);
    }

    const timestamp = clock().toISOString();
    const { authSecret, ...normalizedMonitor } = monitorValidation.normalized;
    const updatedMonitor = {
      ...existingMonitor,
      ...normalizedMonitor,
      status: monitorValidation.nextStatus,
      updatedAt: timestamp,
      archivedAt:
        monitorValidation.nextStatus === "archived"
          ? timestamp
          : existingMonitor.archivedAt,
      authSecretEncrypted:
        "authSecret" in input
          ? authSecret
            ? secretCodec.encrypt(authSecret)
            : null
          : existingMonitor.authSecretEncrypted ?? null,
      alertPolicy:
        "alertPolicy" in input
          ? buildStoredAlertPolicy(alertPolicyValidation.normalized, existingMonitor.alertPolicy)
          : existingMonitor.alertPolicy,
    };

    const updated = await repository.update(updatedMonitor);
    return sanitizeMonitor(updated);
  }

  async function createMaintenanceWindow(monitorId, input) {
    const existingMonitor = await repository.getById(monitorId);
    if (!existingMonitor) {
      throw new MonitorNotFoundError(monitorId);
    }

    const validation = validateMaintenanceWindowInput(input);
    if (Object.keys(validation.fieldErrors).length > 0) {
      throw new MonitorValidationError(validation.fieldErrors);
    }

    const timestamp = clock().toISOString();
    const maintenanceWindow = {
      id: createId(),
      ...validation.normalized,
      createdAt: timestamp,
    };

    await repository.update({
      ...existingMonitor,
      updatedAt: timestamp,
      maintenanceWindows: [
        ...(existingMonitor.maintenanceWindows ?? []),
        maintenanceWindow,
      ],
    });

    return maintenanceWindow;
  }

  async function previewAlertDecision(monitorId, input) {
    const monitor = await repository.getById(monitorId);
    if (!monitor) {
      throw new MonitorNotFoundError(monitorId);
    }

    if (!monitor.alertPolicy) {
      throw new MonitorValidationError({
        alertPolicy: "Alert policy must be configured before previewing decisions.",
      });
    }

    const validation = validatePolicyPreviewInput(input, clock());
    if (Object.keys(validation.fieldErrors).length > 0) {
      throw new MonitorValidationError(validation.fieldErrors);
    }

    const activeWindow = (monitor.maintenanceWindows ?? []).find((maintenanceWindow) =>
      isMaintenanceWindowActive(maintenanceWindow, validation.normalized.evaluatedAt),
    );
    if (activeWindow) {
      return {
        wouldNotify: false,
        status: "suppressed",
        reason: "Alert delivery suppressed by an active maintenance window.",
      };
    }

    if (validation.normalized.sample === "failure") {
      if (
        validation.normalized.consecutiveFailures >=
        monitor.alertPolicy.failureThreshold
      ) {
        return {
          wouldNotify: true,
          status: "notify",
          reason: "Failure threshold met.",
        };
      }

      return {
        wouldNotify: false,
        status: "suppressed",
        reason: "Failure threshold not met.",
      };
    }

    if (
      validation.normalized.consecutiveRecoveries >=
      monitor.alertPolicy.recoveryThreshold
    ) {
      return {
        wouldNotify: true,
        status: "notify",
        reason: "Recovery threshold met.",
      };
    }

    return {
      wouldNotify: false,
      status: "suppressed",
      reason: "Recovery threshold not met.",
    };
  }

  async function listRunnableMonitors() {
    const monitors = await repository.list();
    return monitors
      .filter((monitor) => monitor.status === "active")
      .map((monitor) => sanitizeMonitor(monitor));
  }

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
    const monitors = (await repository.list())
      .filter((monitor) => monitor.status !== "archived")
      .filter((monitor) => {
        const activityAt = deriveDashboardActivityAt(monitor);
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
        openedAt: monitor.currentIncident.openedAt,
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

  async function getMonitorDetail(monitorId) {
    const monitor = await repository.getById(monitorId);
    if (!monitor) {
      throw new MonitorNotFoundError(monitorId);
    }

    const sanitizedMonitor = sanitizeMonitor(monitor);

    return {
      monitor: {
        id: sanitizedMonitor.id,
        name: sanitizedMonitor.name,
        environment: sanitizedMonitor.environment,
        url: sanitizedMonitor.url,
        method: sanitizedMonitor.method,
        status: sanitizedMonitor.status,
        intervalSeconds: sanitizedMonitor.intervalSeconds,
        timeoutMs: sanitizedMonitor.timeoutMs,
        expectedStatusMin: sanitizedMonitor.expectedStatusMin,
        expectedStatusMax: sanitizedMonitor.expectedStatusMax,
        keyword: sanitizedMonitor.keyword ?? null,
        tags: sanitizedMonitor.tags ?? [],
        lastCheckAt: sanitizedMonitor.lastCheckAt ?? null,
        responseTimeMs: sanitizedMonitor.responseTimeMs ?? null,
        createdAt: sanitizedMonitor.createdAt,
        updatedAt: sanitizedMonitor.updatedAt,
        authSecretConfigured: sanitizedMonitor.authSecretConfigured,
        alertPolicy: sanitizedMonitor.alertPolicy ?? null,
        maintenanceWindows: sanitizedMonitor.maintenanceWindows ?? [],
        currentIncident: sanitizedMonitor.currentIncident ?? null,
      },
      recentChecks: [...(monitor.checkResults ?? [])]
        .sort((left, right) => right.checkedAt.localeCompare(left.checkedAt))
        .slice(0, 20),
    };
  }

  async function getIncidentDetail(incidentId) {
    const { monitor, incident } = await getIncidentRecord(incidentId);
    return buildIncidentDetail(monitor, incident);
  }

  async function applyIncidentAction(incidentId, input) {
    const fieldErrors = {};
    if (
      !["acknowledge", "mute", "unmute", "resolve"].includes(input?.action)
    ) {
      fieldErrors.action =
        "Action must be one of acknowledge, mute, unmute, or resolve.";
    }
    if (typeof input?.actor !== "string" || input.actor.trim().length === 0) {
      fieldErrors.actor = "Actor is required.";
    }
    if ("note" in (input ?? {}) && typeof input.note !== "string") {
      fieldErrors.note = "Note must be a string when provided.";
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new MonitorValidationError(fieldErrors);
    }

    const { monitor, incident, incidentIndex } = await getIncidentRecord(incidentId);
    const timestamp = clock().toISOString();
    const note = typeof input.note === "string" && input.note.trim().length > 0
      ? input.note.trim()
      : null;

    const updatedIncident = {
      ...incident,
      muted: incident.muted ?? false,
    };

    let eventType = "";
    if (input.action === "acknowledge") {
      updatedIncident.state = "acknowledged";
      updatedIncident.acknowledgedAt = timestamp;
      eventType = "acknowledged";
    } else if (input.action === "mute") {
      updatedIncident.muted = true;
      eventType = "muted";
    } else if (input.action === "unmute") {
      updatedIncident.muted = false;
      eventType = "unmuted";
    } else if (input.action === "resolve") {
      updatedIncident.state = "resolved";
      updatedIncident.resolvedAt = timestamp;
      eventType = "manual_resolution";
    }

    updatedIncident.timeline = [
      ...(incident.timeline ?? []),
      {
        eventType,
        actor: input.actor.trim(),
        note,
        createdAt: timestamp,
      },
    ];

    const updatedMonitor = await saveUpdatedIncident(
      monitor,
      incidentIndex,
      updatedIncident,
      timestamp,
    );
    return buildIncidentDetail(updatedMonitor, updatedIncident);
  }

  async function autoResolveIncidentIfPolicyAllows(incidentId, input) {
    const fieldErrors = {};
    if (
      !Number.isInteger(input?.consecutiveRecoveries) ||
      input.consecutiveRecoveries < 0
    ) {
      fieldErrors.consecutiveRecoveries =
        "Consecutive recoveries must be an integer greater than or equal to 0.";
    }
    if ("occurredAt" in (input ?? {})) {
      const occurredAt = new Date(input.occurredAt);
      if (Number.isNaN(occurredAt.getTime())) {
        fieldErrors.occurredAt = "OccurredAt must be a valid ISO timestamp.";
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      throw new MonitorValidationError(fieldErrors);
    }

    const { monitor, incident, incidentIndex } = await getIncidentRecord(incidentId);
    const recoveryThreshold = monitor.alertPolicy?.recoveryThreshold;
    if (
      !Number.isInteger(recoveryThreshold) ||
      input.consecutiveRecoveries < recoveryThreshold
    ) {
      return null;
    }

    const timestamp = input.occurredAt ?? clock().toISOString();
    const updatedIncident = {
      ...incident,
      muted: incident.muted ?? false,
      state: "resolved",
      resolvedAt: timestamp,
      timeline: [
        ...(incident.timeline ?? []),
        {
          eventType: "recovered",
          actor: "system",
          note: "Auto-resolved after recovery threshold met.",
          createdAt: timestamp,
        },
      ],
    };

    const updatedMonitor = await saveUpdatedIncident(
      monitor,
      incidentIndex,
      updatedIncident,
      timestamp,
    );
    return buildIncidentDetail(updatedMonitor, updatedIncident);
  }

  return {
    createMonitor,
    updateMonitor,
    createMaintenanceWindow,
    previewAlertDecision,
    listRunnableMonitors,
    getDashboard,
    getMonitorDetail,
    getIncidentDetail,
    applyIncidentAction,
    autoResolveIncidentIfPolicyAllows,
  };
}
