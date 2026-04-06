export class InMemoryMonitorRepository {
  constructor(monitors = []) {
    this.monitors = new Map();

    for (const monitor of monitors) {
      this.monitors.set(monitor.id, structuredClone(monitor));
    }
  }

  async getById(id) {
    const monitor = this.monitors.get(id);
    return monitor ? structuredClone(monitor) : null;
  }

  async save(monitor) {
    this.monitors.set(monitor.id, structuredClone(monitor));
    return structuredClone(monitor);
  }
}
