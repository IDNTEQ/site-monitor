const { randomUUID } = require("node:crypto");
const { validateMonitorInput } = require("./monitor-validation");

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

class ValidationError extends Error {
  constructor(errors) {
    super("Monitor validation failed.");
    this.name = "ValidationError";
    this.errors = errors;
  }
}

class MonitorService {
  constructor(repository) {
    this.repository = repository;
  }

  listMonitors() {
    return this.repository.listAll();
  }

  listScheduledMonitors() {
    return this.repository.listScheduled();
  }

  getMonitor(id) {
    const monitor = this.repository.getById(id);

    if (!monitor) {
      throw new NotFoundError(`Monitor ${id} was not found.`);
    }

    return monitor;
  }

  createMonitor(input) {
    const { valid, errors, monitor } = validateMonitorInput(input);

    if (!valid) {
      throw new ValidationError(errors);
    }

    const timestamp = new Date().toISOString();
    return this.repository.create({
      id: randomUUID(),
      name: monitor.name,
      url: monitor.url,
      method: monitor.method,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      expectedStatusMin: monitor.expectedStatusMin,
      expectedStatusMax: monitor.expectedStatusMax,
      keywordMatch: monitor.keywordMatch,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  updateMonitor(id, input) {
    const existing = this.getMonitor(id);

    if (existing.status === "archived") {
      throw new ValidationError({
        status: ["Archived monitors cannot be edited. Create a new monitor or resume from an earlier state before archiving."]
      });
    }

    const mergedInput = {
      name: Object.prototype.hasOwnProperty.call(input, "name") ? input.name : existing.name,
      url: Object.prototype.hasOwnProperty.call(input, "url") ? input.url : existing.url,
      method: Object.prototype.hasOwnProperty.call(input, "method") ? input.method : existing.method,
      intervalSeconds: Object.prototype.hasOwnProperty.call(input, "intervalSeconds") ? input.intervalSeconds : existing.intervalSeconds,
      timeoutMs: Object.prototype.hasOwnProperty.call(input, "timeoutMs") ? input.timeoutMs : existing.timeoutMs,
      expectedStatusMin: Object.prototype.hasOwnProperty.call(input, "expectedStatusMin") ? input.expectedStatusMin : existing.expectedStatusMin,
      expectedStatusMax: Object.prototype.hasOwnProperty.call(input, "expectedStatusMax") ? input.expectedStatusMax : existing.expectedStatusMax,
      keywordMatch: Object.prototype.hasOwnProperty.call(input, "keywordMatch") ? input.keywordMatch : existing.keywordMatch
    };
    const { valid, errors, monitor } = validateMonitorInput(mergedInput);

    if (!valid) {
      throw new ValidationError(errors);
    }

    return this.repository.update(id, {
      name: monitor.name,
      url: monitor.url,
      method: monitor.method,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      expectedStatusMin: monitor.expectedStatusMin,
      expectedStatusMax: monitor.expectedStatusMax,
      keywordMatch: monitor.keywordMatch,
      updatedAt: new Date().toISOString()
    });
  }

  applyAction(id, action) {
    const existing = this.getMonitor(id);
    const transition = this.#transitionFor(existing.status, action);

    if (!transition.valid) {
      throw new ValidationError({
        status: [transition.message]
      });
    }

    return this.repository.update(id, {
      status: transition.nextStatus,
      updatedAt: new Date().toISOString()
    });
  }

  #transitionFor(status, action) {
    if (action === "pause") {
      if (status !== "active") {
        return {
          valid: false,
          message: "Only active monitors can be paused."
        };
      }

      return { valid: true, nextStatus: "paused" };
    }

    if (action === "resume") {
      if (status !== "paused") {
        return {
          valid: false,
          message: "Only paused monitors can be resumed."
        };
      }

      return { valid: true, nextStatus: "active" };
    }

    if (action === "archive") {
      if (status === "archived") {
        return {
          valid: false,
          message: "Archived monitors cannot be archived again."
        };
      }

      return { valid: true, nextStatus: "archived" };
    }

    return {
      valid: false,
      message: "Action must be one of: pause, resume, archive."
    };
  }
}

module.exports = {
  MonitorService,
  NotFoundError,
  ValidationError
};
