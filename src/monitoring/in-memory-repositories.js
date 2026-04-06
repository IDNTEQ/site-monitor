import { randomUUID } from "node:crypto";

function toMilliseconds(timestamp) {
  return Date.parse(timestamp);
}

export class InMemoryMonitorRepository {
  #monitors = new Map();

  add(monitor) {
    this.#monitors.set(monitor.id, { ...monitor });
  }

  listDue(asOfTimestamp) {
    const asOfMs = toMilliseconds(asOfTimestamp);

    return [...this.#monitors.values()]
      .filter((monitor) => {
        if (monitor.status !== "active") {
          return false;
        }

        return toMilliseconds(monitor.nextCheckAt) <= asOfMs;
      })
      .map((monitor) => ({ ...monitor }));
  }

  save(monitor) {
    this.#monitors.set(monitor.id, { ...monitor });
  }

  get(id) {
    const monitor = this.#monitors.get(id);
    return monitor ? { ...monitor } : null;
  }
}

export class InMemoryCheckResultRepository {
  #results = [];

  create(checkResult) {
    const record = {
      id: randomUUID(),
      ...checkResult,
    };

    this.#results.push(record);
    return { ...record };
  }

  listByMonitorId(monitorId) {
    return this.#results
      .filter((result) => result.monitorId === monitorId)
      .map((result) => ({ ...result }));
  }
}

export class InMemoryIncidentRepository {
  #incidents = [];

  findOpenByMonitorId(monitorId) {
    const incident =
      this.#incidents.find(
        (candidate) =>
          candidate.monitorId === monitorId && candidate.state === "open",
      ) ?? null;

    return incident ? { ...incident } : null;
  }

  open(incident) {
    const record = {
      id: randomUUID(),
      state: "open",
      ...incident,
    };

    this.#incidents.push(record);
    return { ...record };
  }
}
