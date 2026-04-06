const MILLISECONDS_PER_SECOND = 1_000;

function addSeconds(timestamp, seconds) {
  return new Date(
    Date.parse(timestamp) + seconds * MILLISECONDS_PER_SECOND,
  ).toISOString();
}

export class ScheduledCheckWorker {
  constructor({
    clock,
    monitorRepository,
    checkResultRepository,
    incidentRepository,
    checkExecutor,
  }) {
    this.clock = clock;
    this.monitorRepository = monitorRepository;
    this.checkResultRepository = checkResultRepository;
    this.incidentRepository = incidentRepository;
    this.checkExecutor = checkExecutor;
  }

  async runDueChecks() {
    const executedAt = this.clock.now();
    const dueMonitors = this.monitorRepository.listDue(executedAt);
    const monitorRuns = [];

    for (const monitor of dueMonitors) {
      const outcome = await this.checkExecutor.execute({
        monitor,
        executedAt,
      });

      const checkResult = this.checkResultRepository.create({
        monitorId: monitor.id,
        checkedAt: executedAt,
        outcome: outcome.ok ? "pass" : "fail",
        statusCode: outcome.statusCode ?? null,
        error: outcome.error ?? null,
      });

      if (outcome.ok) {
        monitor.consecutiveFailures = 0;
      } else {
        monitor.consecutiveFailures = (monitor.consecutiveFailures ?? 0) + 1;

        const openIncident = this.incidentRepository.findOpenByMonitorId(
          monitor.id,
        );

        if (
          !openIncident &&
          monitor.consecutiveFailures >= monitor.failureThreshold
        ) {
          this.incidentRepository.open({
            monitorId: monitor.id,
            openedAt: executedAt,
            triggerCheckResultId: checkResult.id,
          });
        }
      }

      monitor.lastCheckedAt = executedAt;
      monitor.nextCheckAt = addSeconds(executedAt, monitor.intervalSeconds);
      this.monitorRepository.save(monitor);

      monitorRuns.push({
        monitorId: monitor.id,
        checkedAt: executedAt,
        outcome: checkResult.outcome,
      });
    }

    return {
      executedAt,
      monitorRuns,
    };
  }
}
