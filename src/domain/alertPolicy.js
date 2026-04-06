import crypto from "node:crypto";

export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

function asNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${fieldName} must be a non-empty string.`, {
      field: fieldName
    });
  }

  return value.trim();
}

function asPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ValidationError(`${fieldName} must be an integer greater than 0.`, {
      field: fieldName
    });
  }

  return value;
}

function asIsoDate(value, fieldName) {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${fieldName} must be a valid ISO-8601 datetime.`, {
      field: fieldName
    });
  }

  return parsed.toISOString();
}

export function validateAlertPolicy(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("alert policy payload must be an object.");
  }

  const failureThreshold = asPositiveInteger(
    input.failureThreshold,
    "failureThreshold"
  );
  const recoveryThreshold = asPositiveInteger(
    input.recoveryThreshold,
    "recoveryThreshold"
  );

  if (!Array.isArray(input.notificationChannels) || input.notificationChannels.length === 0) {
    throw new ValidationError(
      "notificationChannels must contain at least one delivery target.",
      { field: "notificationChannels" }
    );
  }

  const notificationChannels = [...new Set(
    input.notificationChannels.map((channel) => asNonEmptyString(channel, "notificationChannels"))
  )];
  const escalationTarget = asNonEmptyString(
    input.escalationTarget,
    "escalationTarget"
  );
  const notifyOnRecovery = input.notifyOnRecovery ?? true;

  if (typeof notifyOnRecovery !== "boolean") {
    throw new ValidationError("notifyOnRecovery must be a boolean.", {
      field: "notifyOnRecovery"
    });
  }

  return {
    failureThreshold,
    recoveryThreshold,
    notificationChannels,
    escalationTarget,
    notifyOnRecovery
  };
}

export function validateMaintenanceWindow(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ValidationError("maintenance window payload must be an object.");
  }

  const startsAt = asIsoDate(input.startsAt, "startsAt");
  const endsAt = asIsoDate(input.endsAt, "endsAt");

  if (new Date(endsAt) <= new Date(startsAt)) {
    throw new ValidationError("endsAt must be later than startsAt.", {
      field: "endsAt"
    });
  }

  return {
    id: input.id ?? crypto.randomUUID(),
    startsAt,
    endsAt,
    reason: asNonEmptyString(input.reason, "reason")
  };
}

export function findActiveMaintenanceWindow(maintenanceWindows, checkedAt) {
  const sampleTime = new Date(checkedAt);

  return maintenanceWindows.find((window) => {
    const startsAt = new Date(window.startsAt);
    const endsAt = new Date(window.endsAt);
    return startsAt <= sampleTime && sampleTime <= endsAt;
  }) ?? null;
}

export function evaluatePolicyPreview({
  alertPolicy,
  maintenanceWindows = [],
  eventType,
  checkedAt,
  consecutiveFailures = 0,
  consecutiveRecoveries = 0
}) {
  const activeWindow = findActiveMaintenanceWindow(maintenanceWindows, checkedAt);

  if (activeWindow) {
    return {
      eventType,
      checkedAt,
      decision: "suppressed",
      reason: "maintenance-window-active",
      maintenanceWindow: activeWindow
    };
  }

  if (eventType === "failure") {
    if (consecutiveFailures < alertPolicy.failureThreshold) {
      return {
        eventType,
        checkedAt,
        decision: "suppressed",
        reason: "failure-threshold-not-met",
        threshold: alertPolicy.failureThreshold,
        observedFailures: consecutiveFailures
      };
    }

    return {
      eventType,
      checkedAt,
      decision: "notify",
      reason: "failure-threshold-met",
      threshold: alertPolicy.failureThreshold,
      observedFailures: consecutiveFailures,
      notificationChannels: alertPolicy.notificationChannels,
      escalationTarget: alertPolicy.escalationTarget
    };
  }

  if (eventType === "recovery") {
    if (consecutiveRecoveries < alertPolicy.recoveryThreshold) {
      return {
        eventType,
        checkedAt,
        decision: "suppressed",
        reason: "recovery-threshold-not-met",
        threshold: alertPolicy.recoveryThreshold,
        observedRecoveries: consecutiveRecoveries
      };
    }

    if (!alertPolicy.notifyOnRecovery) {
      return {
        eventType,
        checkedAt,
        decision: "suppressed",
        reason: "recovery-notifications-disabled",
        threshold: alertPolicy.recoveryThreshold,
        observedRecoveries: consecutiveRecoveries
      };
    }

    return {
      eventType,
      checkedAt,
      decision: "notify",
      reason: "recovery-threshold-met",
      threshold: alertPolicy.recoveryThreshold,
      observedRecoveries: consecutiveRecoveries,
      notificationChannels: alertPolicy.notificationChannels,
      escalationTarget: alertPolicy.escalationTarget
    };
  }

  throw new ValidationError("eventType must be either failure or recovery.", {
    field: "eventType"
  });
}
