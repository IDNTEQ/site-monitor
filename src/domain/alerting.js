function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parseIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function validateAlertPolicy(input) {
  const fieldErrors = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      fieldErrors: {
        alertPolicy: "Alert policy must be an object.",
      },
      normalized: null,
    };
  }

  if (!Number.isInteger(input.failureThreshold) || input.failureThreshold < 1) {
    fieldErrors["alertPolicy.failureThreshold"] =
      "Failure threshold must be an integer greater than or equal to 1.";
  }

  if (!Number.isInteger(input.recoveryThreshold) || input.recoveryThreshold < 1) {
    fieldErrors["alertPolicy.recoveryThreshold"] =
      "Recovery threshold must be an integer greater than or equal to 1.";
  }

  const notificationChannels = Array.isArray(input.notificationChannels)
    ? [...new Set(input.notificationChannels.map((entry) => entry?.trim?.()))]
    : null;
  if (
    !notificationChannels ||
    notificationChannels.length === 0 ||
    notificationChannels.some((entry) => !isNonEmptyString(entry))
  ) {
    fieldErrors["alertPolicy.notificationChannels"] =
      "Notification channels must contain at least one non-empty channel name.";
  }

  if (!isNonEmptyString(input.escalationTarget)) {
    fieldErrors["alertPolicy.escalationTarget"] = "Escalation target is required.";
  }

  let notificationCredentials;
  if ("notificationCredentials" in input) {
    if (
      !input.notificationCredentials ||
      typeof input.notificationCredentials !== "object" ||
      Array.isArray(input.notificationCredentials)
    ) {
      fieldErrors["alertPolicy.notificationCredentials"] =
        "Notification credentials must be an object keyed by channel name.";
    } else {
      notificationCredentials = Object.fromEntries(
        Object.entries(input.notificationCredentials).map(([channel, secret]) => [
          channel.trim(),
          typeof secret === "string" ? secret.trim() : secret,
        ]),
      );

      if (
        Object.keys(notificationCredentials).length === 0 ||
        Object.entries(notificationCredentials).some(
          ([channel, secret]) =>
            !isNonEmptyString(channel) ||
            !isNonEmptyString(secret) ||
            !notificationChannels?.includes(channel),
        )
      ) {
        fieldErrors["alertPolicy.notificationCredentials"] =
          "Notification credentials must map configured channels to non-empty secret values.";
      }
    }
  }

  return {
    fieldErrors,
    normalized: Object.keys(fieldErrors).length > 0
      ? null
      : {
          failureThreshold: input.failureThreshold,
          recoveryThreshold: input.recoveryThreshold,
          notificationChannels,
          escalationTarget: input.escalationTarget.trim(),
          notificationCredentials,
        },
  };
}

export function validateMaintenanceWindowInput(input) {
  const fieldErrors = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      fieldErrors: {
        maintenanceWindow: "Maintenance window must be an object.",
      },
      normalized: null,
    };
  }

  const startsAt = parseIsoDate(input.startsAt);
  if (!startsAt) {
    fieldErrors.startsAt = "Maintenance window start time must be a valid ISO timestamp.";
  }

  const endsAt = parseIsoDate(input.endsAt);
  if (!endsAt) {
    fieldErrors.endsAt = "Maintenance window end time must be a valid ISO timestamp.";
  } else if (startsAt && endsAt <= startsAt) {
    fieldErrors.endsAt = "Maintenance window end time must be later than startsAt.";
  }

  if (!isNonEmptyString(input.reason)) {
    fieldErrors.reason = "Maintenance window reason is required.";
  }

  return {
    fieldErrors,
    normalized: Object.keys(fieldErrors).length > 0
      ? null
      : {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: input.reason.trim(),
        },
  };
}

export function validatePolicyPreviewInput(input, now = new Date()) {
  const fieldErrors = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      fieldErrors: {
        preview: "Policy preview input must be an object.",
      },
      normalized: null,
    };
  }

  if (input.sample !== "failure" && input.sample !== "recovery") {
    fieldErrors.sample = "Sample must be either failure or recovery.";
  }

  const evaluatedAt = input.evaluatedAt == null ? now : parseIsoDate(input.evaluatedAt);
  if (!evaluatedAt) {
    fieldErrors.evaluatedAt = "Preview time must be a valid ISO timestamp.";
  }

  if (input.sample === "failure") {
    if (!Number.isInteger(input.consecutiveFailures) || input.consecutiveFailures < 0) {
      fieldErrors.consecutiveFailures =
        "Consecutive failures must be an integer greater than or equal to 0.";
    }
  }

  if (input.sample === "recovery") {
    if (!Number.isInteger(input.consecutiveRecoveries) || input.consecutiveRecoveries < 0) {
      fieldErrors.consecutiveRecoveries =
        "Consecutive recoveries must be an integer greater than or equal to 0.";
    }
  }

  return {
    fieldErrors,
    normalized: Object.keys(fieldErrors).length > 0
      ? null
      : {
          sample: input.sample,
          consecutiveFailures: input.consecutiveFailures ?? 0,
          consecutiveRecoveries: input.consecutiveRecoveries ?? 0,
          evaluatedAt: evaluatedAt.toISOString(),
        },
  };
}

export function isMaintenanceWindowActive(maintenanceWindow, evaluatedAt) {
  const targetTime = new Date(evaluatedAt).getTime();
  const startsAt = new Date(maintenanceWindow.startsAt).getTime();
  const endsAt = new Date(maintenanceWindow.endsAt).getTime();

  return targetTime >= startsAt && targetTime <= endsAt;
}
