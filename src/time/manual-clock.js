export class ManualClock {
  #nowMs;

  constructor(seedTimestamp) {
    this.#nowMs = Date.parse(seedTimestamp);

    if (Number.isNaN(this.#nowMs)) {
      throw new Error(`Invalid seed timestamp: ${seedTimestamp}`);
    }
  }

  now() {
    return new Date(this.#nowMs).toISOString();
  }

  advanceBy(milliseconds) {
    this.#nowMs += milliseconds;
    return this.now();
  }
}
