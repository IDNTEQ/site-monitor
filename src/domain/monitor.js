const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

const ALLOWED_ACTIONS = new Set(["pause", "resume", "archive"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : value;
}

function normalizeKeyword(value) {
  if (value == null) {
    return null;
  }

  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return value;
  }

  return [...new Set(value.map((entry) => normalizeString(entry)))];
}

function normalizeMethod(value) {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toUpperCase();
}

function validateRequiredText(fieldName, value, message, fieldErrors) {
  if (!isNonEmptyString(value)) {
    fieldErrors[fieldName] = message;
    return null;
  }

  return value.trim();
}

function validateUrl(value, fieldErrors) {
  if (!isNonEmptyString(value)) {
    fieldErrors.url = "URL must be an absolute HTTP or HTTPS URL.";
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    return parsed.toString();
  } catch {
    fieldErrors.url = "URL must be an absolute HTTP or HTTPS URL.";
    return null;
  }
}

function validateMethod(value, fieldErrors) {
  const normalized = normalizeMethod(value);
  if (!ALLOWED_METHODS.has(normalized)) {
    fieldErrors.method =
      "Method must be one of GET, HEAD, POST, PUT, PATCH, DELETE, or OPTIONS.";
    return null;
  }

  return normalized;
}

function validateIntegerRange(value, {
  fieldName,
  min,
  max,
  message,
}, fieldErrors) {
  if (!Number.isInteger(value) || value < min || value > max) {
    fieldErrors[fieldName] = message;
    return null;
  }

  return value;
}

function validateKeyword(value, fieldErrors) {
  const normalized = normalizeKeyword(value);
  if (normalized !== null && typeof normalized !== "string") {
    fieldErrors.keyword = "Keyword must be a string when provided.";
    return null;
  }

  return normalized;
}

function validateTags(value, fieldErrors) {
  const normalized = normalizeTags(value);
  if (
    !Array.isArray(normalized) ||
    normalized.some((entry) => !isNonEmptyString(entry))
  ) {
    fieldErrors.tags = "Tags must contain non-empty strings.";
    return null;
  }

  return normalized.map((entry) => entry.trim());
}

function validateBaseMonitor(candidate) {
  const fieldErrors = {};

  const name = validateRequiredText(
    "name",
    candidate.name,
    "Name is required.",
    fieldErrors,
  );
  const environment = validateRequiredText(
    "environment",
    candidate.environment,
    "Environment is required.",
    fieldErrors,
  );
  const url = validateUrl(candidate.url, fieldErrors);
  const method = validateMethod(candidate.method, fieldErrors);
  const intervalSeconds = validateIntegerRange(
    candidate.intervalSeconds,
    {
      fieldName: "intervalSeconds",
      min: 10,
      max: Number.MAX_SAFE_INTEGER,
      message: "Interval must be at least 10 seconds.",
    },
    fieldErrors,
  );
  const timeoutMs = validateIntegerRange(
    candidate.timeoutMs,
    {
      fieldName: "timeoutMs",
      min: 100,
      max: 30000,
      message: "Timeout must be between 100 and 30000 milliseconds.",
    },
    fieldErrors,
  );
  const expectedStatusMin = validateIntegerRange(
    candidate.expectedStatusMin,
    {
      fieldName: "expectedStatusMin",
      min: 100,
      max: 599,
      message: "Expected status minimum must be between 100 and 599.",
    },
    fieldErrors,
  );
  const expectedStatusMax = validateIntegerRange(
    candidate.expectedStatusMax,
    {
      fieldName: "expectedStatusMax",
      min: 100,
      max: 599,
      message:
        "Expected status maximum must be greater than or equal to expectedStatusMin and no more than 599.",
    },
    fieldErrors,
  );

  if (
    Number.isInteger(candidate.expectedStatusMax) &&
    ((Number.isInteger(candidate.expectedStatusMin) &&
      candidate.expectedStatusMax < candidate.expectedStatusMin) ||
      candidate.expectedStatusMax > 599 ||
      candidate.expectedStatusMax < 100)
  ) {
    fieldErrors.expectedStatusMax =
      "Expected status maximum must be greater than or equal to expectedStatusMin and no more than 599.";
  }

  let keyword = null;
  if ("keyword" in candidate) {
    keyword = validateKeyword(candidate.keyword, fieldErrors);
  }

  let tags = [];
  if ("tags" in candidate) {
    tags = validateTags(candidate.tags, fieldErrors);
  }

  return {
    fieldErrors,
    normalized: {
      name,
      environment,
      url,
      method,
      intervalSeconds,
      timeoutMs,
      expectedStatusMin,
      expectedStatusMax,
      keyword,
      tags,
    },
  };
}

function validateCreateMonitorInput(input) {
  return validateBaseMonitor({
    ...input,
    keyword: "keyword" in input ? input.keyword : null,
    tags: "tags" in input ? input.tags : [],
  });
}

function validateUpdateMonitorInput(existingMonitor, input) {
  const fieldErrors = {};
  const hasEditableFields = [
    "name",
    "environment",
    "url",
    "method",
    "intervalSeconds",
    "timeoutMs",
    "expectedStatusMin",
    "expectedStatusMax",
    "keyword",
    "tags",
  ].some((fieldName) => fieldName in input);

  if (existingMonitor.status === "archived") {
    if (hasEditableFields) {
      fieldErrors.action = "Archived monitors cannot transition to another status.";
    }
    if ("action" in input && input.action !== "archive") {
      fieldErrors.action = "Archived monitors cannot transition to another status.";
    }
  }

  let nextStatus = existingMonitor.status;
  if ("action" in input) {
    if (!ALLOWED_ACTIONS.has(input.action)) {
      fieldErrors.action = "Action must be one of pause, resume, or archive.";
    } else if (input.action === "pause") {
      nextStatus = "paused";
    } else if (input.action === "resume") {
      nextStatus = "active";
    } else if (input.action === "archive") {
      nextStatus = "archived";
    }
  }

  const candidate = {
    ...existingMonitor,
    ...input,
    keyword: "keyword" in input ? input.keyword : existingMonitor.keyword,
    tags: "tags" in input ? input.tags : existingMonitor.tags,
    status: nextStatus,
  };

  const validation = validateBaseMonitor(candidate);
  const mergedFieldErrors = {
    ...validation.fieldErrors,
    ...fieldErrors,
  };

  const normalized = {};
  for (const fieldName of [
    "name",
    "environment",
    "url",
    "method",
    "intervalSeconds",
    "timeoutMs",
    "expectedStatusMin",
    "expectedStatusMax",
    "keyword",
    "tags",
  ]) {
    if (fieldName in input) {
      normalized[fieldName] = validation.normalized[fieldName];
    }
  }

  return {
    fieldErrors: mergedFieldErrors,
    normalized,
    nextStatus,
  };
}

export {
  ALLOWED_ACTIONS,
  ALLOWED_METHODS,
  validateCreateMonitorInput,
  validateUpdateMonitorInput,
};
