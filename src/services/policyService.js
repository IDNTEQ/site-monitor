import {
  evaluatePolicyPreview,
  validateAlertPolicy,
  validateMaintenanceWindow
} from "../domain/alertPolicy.js";

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

function normalizeMonitor(monitor) {
  return {
    ...monitor,
    alertPolicy: monitor.alertPolicy ?? null,
    maintenanceWindows: monitor.maintenanceWindows ?? []
  };
}

export class PolicyService {
  constructor({ monitorRepository }) {
    this.monitorRepository = monitorRepository;
  }

  async updateAlertPolicy(monitorId, input) {
    const monitor = await this.#requireMonitor(monitorId);
    const alertPolicy = validateAlertPolicy(input);
    const updatedMonitor = normalizeMonitor({
      ...monitor,
      alertPolicy
    });

    await this.monitorRepository.save(updatedMonitor);

    return {
      monitorId,
      alertPolicy
    };
  }

  async createMaintenanceWindow(monitorId, input) {
    const monitor = await this.#requireMonitor(monitorId);
    const maintenanceWindow = validateMaintenanceWindow(input);
    const updatedMonitor = normalizeMonitor({
      ...monitor,
      maintenanceWindows: [...(monitor.maintenanceWindows ?? []), maintenanceWindow]
    });

    await this.monitorRepository.save(updatedMonitor);

    return {
      monitorId,
      maintenanceWindow
    };
  }

  async previewDecision(monitorId, input) {
    const monitor = await this.#requireMonitor(monitorId);

    if (!monitor.alertPolicy) {
      throw new NotFoundError(`Monitor ${monitorId} does not have an alert policy.`);
    }

    const checkedAt = input.checkedAt ?? new Date().toISOString();

    return {
      monitorId,
      preview: evaluatePolicyPreview({
        alertPolicy: monitor.alertPolicy,
        maintenanceWindows: monitor.maintenanceWindows ?? [],
        eventType: input.eventType,
        checkedAt,
        consecutiveFailures: input.consecutiveFailures ?? 0,
        consecutiveRecoveries: input.consecutiveRecoveries ?? 0
      })
    };
  }

  async #requireMonitor(monitorId) {
    const monitor = await this.monitorRepository.getById(monitorId);

    if (!monitor) {
      throw new NotFoundError(`Monitor ${monitorId} was not found.`);
    }

    return normalizeMonitor(monitor);
  }
}
