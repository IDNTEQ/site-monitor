export class InMemoryMonitorRepository {
  constructor() {
    this.monitors = new Map();
    this.workerRuns = [];
  }

  async create(monitor) {
    const stored = structuredClone(monitor);
    this.monitors.set(stored.id, stored);
    return structuredClone(stored);
  }

  async getById(monitorId) {
    const monitor = this.monitors.get(monitorId);
    return monitor ? structuredClone(monitor) : null;
  }

  async update(monitor) {
    const stored = structuredClone(monitor);
    this.monitors.set(stored.id, stored);
    return structuredClone(stored);
  }

  async list() {
    return [...this.monitors.values()].map((monitor) => structuredClone(monitor));
  }

  async appendWorkerRun(workerRun) {
    const stored = structuredClone(workerRun);
    this.workerRuns.push(stored);
    return structuredClone(stored);
  }

  async listWorkerRuns() {
    return this.workerRuns.map((workerRun) => structuredClone(workerRun));
  }
}
