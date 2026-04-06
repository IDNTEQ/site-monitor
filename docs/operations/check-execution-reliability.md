# Check Execution Reliability

This issue slice adds a narrow worker-facing audit flow for `NFR-002`:

- capture scheduled check records with terminal completion outcomes
- compute the seven-day completion ratio required by the PRD
- render Prometheus-style worker metrics for staging verification

## Audit Input

The staging audit script expects a JSON file with this shape:

```json
{
  "environment": "staging",
  "windowStart": "2026-04-01T00:00:00.000Z",
  "windowEnd": "2026-04-08T00:00:00.000Z",
  "target": 0.99,
  "records": [
    {
      "checkId": "check-1",
      "monitorId": "homepage",
      "scheduledAt": "2026-04-01T00:00:00.000Z",
      "completedAt": "2026-04-01T00:00:30.000Z",
      "outcome": "succeeded"
    }
  ]
}
```

`records` should contain one item per scheduled check. A check counts as completed when it has `completedAt` and its `outcome` is a terminal worker outcome such as `succeeded`, `failed`, or `timeout`.

## Running The Audit

```bash
npm run audit:staging-reliability -- ./path/to/staging-audit.json
```

Use `--format json` to emit machine-readable output:

```bash
node scripts/run-staging-reliability-audit.js ./path/to/staging-audit.json --format json
```

## Metrics

The worker metrics renderer emits these top-level metrics:

- `site_monitor_worker_scheduled_checks_total`
- `site_monitor_worker_completed_checks_total`
- `site_monitor_worker_missed_checks_total`
- `site_monitor_worker_check_completion_ratio`
- `site_monitor_worker_check_completion_target_ratio`
- `site_monitor_worker_check_completion_target_met`

Per-monitor counts and ratios are also exported with `monitor_id` labels so staging soak audits can isolate unreliable monitors without changing the aggregate target calculation.
