export const seedIncidents = [
  {
    id: "inc-204",
    state: "open",
    openedAt: "2026-04-06T09:02:00.000Z",
    acknowledgedAt: null,
    resolvedAt: null,
    alertsMuted: false,
    mutedAt: null,
    owner: null,
    recoveryCount: 0,
    policy: {
      autoResolveOnRecovery: true,
      recoveryThreshold: 2,
    },
    monitor: {
      id: "mon-checkout",
      name: "checkout.example.com",
      environment: "production",
      url: "https://checkout.example.com/health",
    },
    latestCheck: {
      checkedAt: "2026-04-06T09:14:00.000Z",
      outcome: "failed",
      statusCode: 503,
      responseTimeMs: 3870,
      errorClass: "HttpStatusMismatch",
      ruleResult: "Expected 200-299",
    },
    deliveryHistory: [
      {
        id: "del-1",
        channel: "pager",
        status: "delivered",
        sentAt: "2026-04-06T09:05:00.000Z",
      },
      {
        id: "del-2",
        channel: "slack",
        status: "delivered",
        sentAt: "2026-04-06T09:05:04.000Z",
      },
    ],
    events: [
      {
        id: "evt-notify",
        eventType: "notified",
        actor: "site-monitor",
        note: "Alert fan-out completed for pager and Slack.",
        createdAt: "2026-04-06T09:05:04.000Z",
        metadata: {
          channels: ["pager", "slack"],
        },
      },
      {
        id: "evt-open",
        eventType: "opened",
        actor: "site-monitor",
        note: "Failure threshold reached after 3 consecutive failed checks.",
        createdAt: "2026-04-06T09:02:00.000Z",
        metadata: {
          consecutiveFailures: 3,
        },
      },
    ],
  },
];
