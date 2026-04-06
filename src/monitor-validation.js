const ALLOWED_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function addError(errors, field, message) {
  if (!errors[field]) {
    errors[field] = [];
  }

  errors[field].push(message);
}

function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function validateMonitorInput(input, options = {}) {
  const { partial = false } = options;
  const errors = {};
  const monitor = {};

  if (!partial || Object.prototype.hasOwnProperty.call(input, "name")) {
    const name = normalizeText(input.name);

    if (name.length > 120) {
      addError(errors, "name", "Name must be 120 characters or fewer.");
    }

    monitor.name = name || null;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "url")) {
    const urlText = normalizeText(input.url);

    if (!urlText) {
      addError(errors, "url", "URL is required.");
    } else {
      try {
        const parsedUrl = new URL(urlText);

        if (!["http:", "https:"].includes(parsedUrl.protocol)) {
          addError(errors, "url", "URL must start with http:// or https://.");
        } else {
          monitor.url = parsedUrl.toString();
        }
      } catch {
        addError(errors, "url", "URL must be a valid absolute URL.");
      }
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "method")) {
    const method = normalizeText(input.method).toUpperCase();

    if (!method) {
      addError(errors, "method", "Method is required.");
    } else if (!ALLOWED_METHODS.includes(method)) {
      addError(errors, "method", `Method must be one of: ${ALLOWED_METHODS.join(", ")}.`);
    } else {
      monitor.method = method;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "intervalSeconds")) {
    const intervalSeconds = parseInteger(input.intervalSeconds);

    if (intervalSeconds === null) {
      addError(errors, "intervalSeconds", "Interval is required.");
    } else if (!Number.isInteger(intervalSeconds) || intervalSeconds < 30 || intervalSeconds > 86400) {
      addError(errors, "intervalSeconds", "Interval must be between 30 and 86400 seconds.");
    } else {
      monitor.intervalSeconds = intervalSeconds;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "timeoutMs")) {
    const timeoutMs = parseInteger(input.timeoutMs);

    if (timeoutMs === null) {
      addError(errors, "timeoutMs", "Timeout is required.");
    } else if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
      addError(errors, "timeoutMs", "Timeout must be between 100 and 60000 milliseconds.");
    } else {
      monitor.timeoutMs = timeoutMs;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "expectedStatusMin")) {
    const expectedStatusMin = parseInteger(input.expectedStatusMin);

    if (expectedStatusMin === null) {
      addError(errors, "expectedStatusMin", "Minimum expected status is required.");
    } else if (!Number.isInteger(expectedStatusMin) || expectedStatusMin < 100 || expectedStatusMin > 599) {
      addError(errors, "expectedStatusMin", "Minimum expected status must be between 100 and 599.");
    } else {
      monitor.expectedStatusMin = expectedStatusMin;
    }
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "expectedStatusMax")) {
    const expectedStatusMax = parseInteger(input.expectedStatusMax);

    if (expectedStatusMax === null) {
      addError(errors, "expectedStatusMax", "Maximum expected status is required.");
    } else if (!Number.isInteger(expectedStatusMax) || expectedStatusMax < 100 || expectedStatusMax > 599) {
      addError(errors, "expectedStatusMax", "Maximum expected status must be between 100 and 599.");
    } else {
      monitor.expectedStatusMax = expectedStatusMax;
    }
  }

  if (
    monitor.expectedStatusMin !== undefined &&
    monitor.expectedStatusMax !== undefined &&
    monitor.expectedStatusMin > monitor.expectedStatusMax
  ) {
    addError(errors, "expectedStatusMax", "Maximum expected status must be greater than or equal to the minimum.");
  }

  if (
    monitor.timeoutMs !== undefined &&
    monitor.intervalSeconds !== undefined &&
    monitor.timeoutMs >= monitor.intervalSeconds * 1000
  ) {
    addError(errors, "timeoutMs", "Timeout must be shorter than the check interval.");
  }

  if (!partial || Object.prototype.hasOwnProperty.call(input, "keywordMatch")) {
    const keywordMatch = normalizeText(input.keywordMatch);

    if (keywordMatch.length > 256) {
      addError(errors, "keywordMatch", "Keyword match must be 256 characters or fewer.");
    } else {
      monitor.keywordMatch = keywordMatch || null;
    }
  }

  return {
    errors,
    monitor,
    valid: Object.keys(errors).length === 0
  };
}

module.exports = {
  ALLOWED_METHODS,
  validateMonitorInput
};
