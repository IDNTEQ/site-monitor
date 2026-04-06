export const incidents = [
  {
    id: "inc-204",
    state: "resolved",
    openedAt: "2026-04-05T14:05:00Z",
    acknowledgedAt: "2026-04-05T14:09:00Z",
    resolvedAt: "2026-04-05T14:19:00Z",
    affectedMonitor: {
      id: "mon-checkout-prod",
      name: "checkout-web",
      environment: "production",
      method: "GET",
      url: "https://checkout.example.com/health",
      expectedStatusRange: "200-299",
      matchingRule: {
        type: "keyword",
        description: "Response body must contain checkout-ready"
      }
    },
    checkResults: [
      {
        id: "chk-1",
        checkedAt: "2026-04-05T14:03:00Z",
        outcome: "failed",
        statusCode: 503,
        responseTimeMs: 1840,
        errorClass: "UpstreamHttpError",
        matchingRuleResult: "missing keyword"
      },
      {
        id: "chk-2",
        checkedAt: "2026-04-05T14:04:00Z",
        outcome: "failed",
        statusCode: 503,
        responseTimeMs: 2012,
        errorClass: "UpstreamHttpError",
        matchingRuleResult: "missing keyword"
      },
      {
        id: "chk-3",
        checkedAt: "2026-04-05T14:05:00Z",
        outcome: "failed",
        statusCode: 503,
        responseTimeMs: 2095,
        errorClass: "ThresholdBreach",
        matchingRuleResult: "missing keyword"
      },
      {
        id: "chk-4",
        checkedAt: "2026-04-05T14:11:00Z",
        outcome: "failed",
        statusCode: 502,
        responseTimeMs: 1934,
        errorClass: "UpstreamHttpError",
        matchingRuleResult: "missing keyword"
      },
      {
        id: "chk-5",
        checkedAt: "2026-04-05T14:15:00Z",
        outcome: "passed",
        statusCode: 200,
        responseTimeMs: 312,
        errorClass: null,
        matchingRuleResult: "matched keyword"
      },
      {
        id: "chk-6",
        checkedAt: "2026-04-05T14:16:00Z",
        outcome: "passed",
        statusCode: 200,
        responseTimeMs: 298,
        errorClass: null,
        matchingRuleResult: "matched keyword"
      }
    ],
    deliveryHistory: [
      {
        id: "del-1",
        channel: "PagerDuty",
        target: "web-primary",
        status: "delivered",
        deliveredAt: "2026-04-05T14:05:18Z",
        detail: "Initial incident page sent to primary on-call schedule."
      },
      {
        id: "del-2",
        channel: "Slack",
        target: "#site-monitor-alerts",
        status: "delivered",
        deliveredAt: "2026-04-05T14:05:34Z",
        detail: "Failure evidence posted with latest check summary."
      },
      {
        id: "del-3",
        channel: "PagerDuty",
        target: "web-primary",
        status: "delivered",
        deliveredAt: "2026-04-05T14:16:10Z",
        detail: "Recovery notification sent after two passing checks."
      }
    ],
    timeline: [
      {
        id: "evt-1",
        type: "failure_started",
        actor: "system",
        createdAt: "2026-04-05T14:05:00Z",
        summary: "Failure threshold reached after three consecutive failed checks."
      },
      {
        id: "evt-2",
        type: "notification_sent",
        actor: "system",
        createdAt: "2026-04-05T14:05:18Z",
        summary: "PagerDuty delivery recorded for web-primary."
      },
      {
        id: "evt-3",
        type: "notification_sent",
        actor: "system",
        createdAt: "2026-04-05T14:05:34Z",
        summary: "Slack delivery recorded for #site-monitor-alerts."
      },
      {
        id: "evt-4",
        type: "acknowledged",
        actor: "Avery Chen",
        createdAt: "2026-04-05T14:09:00Z",
        summary: "Incident acknowledged by on-call responder.",
        note: "Investigating elevated 503 responses from the checkout upstream."
      },
      {
        id: "evt-5",
        type: "recovered",
        actor: "system",
        createdAt: "2026-04-05T14:16:00Z",
        summary: "Monitor recovered after two consecutive passing checks."
      },
      {
        id: "evt-6",
        type: "resolved",
        actor: "Avery Chen",
        createdAt: "2026-04-05T14:19:00Z",
        summary: "Incident manually resolved after vendor mitigation verification.",
        note: "Closed after confirming the upstream provider rollback."
      }
    ]
  }
];
