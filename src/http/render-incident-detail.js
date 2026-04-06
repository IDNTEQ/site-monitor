function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value) {
  return new Date(value).toISOString().replace(".000", "");
}

function renderCheckRows(checks) {
  return checks
    .map(
      (check) => `
        <tr>
          <td>${escapeHtml(formatDate(check.checkedAt))}</td>
          <td><span class="chip chip-${escapeHtml(check.outcome)}">${escapeHtml(check.outcome)}</span></td>
          <td>${escapeHtml(check.statusCode)}</td>
          <td>${escapeHtml(check.responseTimeMs)} ms</td>
          <td>${escapeHtml(check.errorClass ?? "None")}</td>
          <td>${escapeHtml(check.matchingRuleResult)}</td>
        </tr>
      `
    )
    .join("");
}

function renderDeliveryRows(deliveries) {
  return deliveries
    .map(
      (delivery) => `
        <tr>
          <td>${escapeHtml(formatDate(delivery.deliveredAt))}</td>
          <td>${escapeHtml(delivery.channel)}</td>
          <td>${escapeHtml(delivery.target)}</td>
          <td>${escapeHtml(delivery.status)}</td>
          <td>${escapeHtml(delivery.detail)}</td>
        </tr>
      `
    )
    .join("");
}

function renderTimelineItems(timeline) {
  return timeline
    .map(
      (event) => `
        <li class="timeline-item">
          <div class="timeline-meta">
            <span class="timeline-label">${escapeHtml(event.label)}</span>
            <time datetime="${escapeHtml(event.createdAt)}">${escapeHtml(
              formatDate(event.createdAt)
            )}</time>
          </div>
          <p class="timeline-summary">${escapeHtml(event.summary)}</p>
          <p class="timeline-actor">Actor: ${escapeHtml(event.actor)}</p>
          ${
            event.note
              ? `<p class="timeline-note">Note: ${escapeHtml(event.note)}</p>`
              : ""
          }
        </li>
      `
    )
    .join("");
}

export function renderIncidentDetailPage(detail) {
  const { incident } = detail;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Incident ${escapeHtml(incident.id)} | site-monitor</title>
    <style>
      :root {
        color-scheme: light;
        --page: #f3efe5;
        --panel: #fffdf8;
        --ink: #172033;
        --muted: #5c677d;
        --line: #d5c8b0;
        --accent: #b04b2f;
        --accent-soft: #f5d4ca;
        --ok: #2c7a4b;
        --ok-soft: #dbefdf;
        --bad: #a22b2b;
        --bad-soft: #f8d7d7;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top right, rgba(176, 75, 47, 0.16), transparent 28rem),
          linear-gradient(180deg, #f6f1e7 0%, #efe6d6 100%);
      }

      main {
        width: min(1100px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 32px 0 48px;
      }

      .hero,
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 16px 40px rgba(23, 32, 51, 0.08);
      }

      .hero {
        padding: 28px;
        margin-bottom: 20px;
      }

      .hero-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
      }

      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 0.78rem;
        color: var(--muted);
        margin: 0 0 8px;
      }

      h1, h2 {
        margin: 0;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 700;
      }

      .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 22px;
      }

      .summary-card {
        padding: 16px;
        border-radius: 18px;
        background: #f9f4ea;
        border: 1px solid var(--line);
      }

      .summary-card strong,
      .summary-card span {
        display: block;
      }

      .summary-card strong {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr);
        gap: 20px;
      }

      .stack {
        display: grid;
        gap: 20px;
      }

      .panel {
        padding: 22px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        font-size: 0.96rem;
      }

      th,
      td {
        text-align: left;
        padding: 12px 10px;
        border-bottom: 1px solid #eadfcd;
        vertical-align: top;
      }

      th {
        font-size: 0.82rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
      }

      .chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 0.82rem;
        font-weight: 700;
      }

      .chip-passed {
        color: var(--ok);
        background: var(--ok-soft);
      }

      .chip-failed {
        color: var(--bad);
        background: var(--bad-soft);
      }

      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 14px;
      }

      .timeline-item {
        padding-left: 18px;
        border-left: 3px solid var(--accent);
      }

      .timeline-meta {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        font-size: 0.9rem;
      }

      .timeline-label {
        font-weight: 700;
      }

      .timeline-summary,
      .timeline-actor,
      .timeline-note {
        margin: 8px 0 0;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      }

      .monitor-meta {
        display: grid;
        gap: 10px;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      }

      .monitor-meta div {
        padding-bottom: 10px;
        border-bottom: 1px solid #eadfcd;
      }

      .monitor-meta strong {
        display: block;
        margin-bottom: 4px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.8rem;
      }

      @media (max-width: 800px) {
        main {
          width: min(100vw - 20px, 100%);
          padding-top: 18px;
        }

        .hero,
        .panel {
          border-radius: 18px;
        }

        .hero {
          padding: 20px;
        }

        .hero-header,
        .timeline-meta {
          flex-direction: column;
        }

        .layout {
          grid-template-columns: 1fr;
        }

        table,
        thead,
        tbody,
        th,
        td,
        tr {
          display: block;
        }

        thead {
          display: none;
        }

        tr {
          padding: 12px 0;
          border-bottom: 1px solid #eadfcd;
        }

        td {
          border: 0;
          padding: 6px 0;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="hero">
        <p class="eyebrow">site-monitor incident detail</p>
        <div class="hero-header">
          <div>
            <h1>Incident ${escapeHtml(incident.id)}</h1>
            <p>${escapeHtml(incident.affectedMonitor.name)} in ${escapeHtml(
              incident.affectedMonitor.environment
            )}</p>
          </div>
          <span class="status-pill">${escapeHtml(incident.status)}</span>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <strong>First failure</strong>
            <span>${escapeHtml(formatDate(incident.firstFailureAt))}</span>
          </div>
          <div class="summary-card">
            <strong>Opened</strong>
            <span>${escapeHtml(formatDate(incident.openedAt))}</span>
          </div>
          <div class="summary-card">
            <strong>Acknowledged</strong>
            <span>${escapeHtml(formatDate(incident.acknowledgedAt))}</span>
          </div>
          <div class="summary-card">
            <strong>Resolved</strong>
            <span>${escapeHtml(formatDate(incident.resolvedAt))}</span>
          </div>
        </div>
      </section>

      <div class="layout">
        <div class="stack">
          <section class="panel">
            <h2>Timeline</h2>
            <ul class="timeline">${renderTimelineItems(detail.timeline)}</ul>
          </section>

          <section class="panel">
            <h2>Latest Check Outcomes</h2>
            <table>
              <thead>
                <tr>
                  <th>Checked At</th>
                  <th>Outcome</th>
                  <th>Status Code</th>
                  <th>Response Time</th>
                  <th>Error Class</th>
                  <th>Matching Rule</th>
                </tr>
              </thead>
              <tbody>${renderCheckRows(detail.latestCheckOutcomes)}</tbody>
            </table>
          </section>
        </div>

        <div class="stack">
          <section class="panel">
            <h2>Affected Monitor</h2>
            <div class="monitor-meta">
              <div>
                <strong>Monitor</strong>
                <span>${escapeHtml(incident.affectedMonitor.name)}</span>
              </div>
              <div>
                <strong>Endpoint</strong>
                <span>${escapeHtml(incident.affectedMonitor.method)} ${escapeHtml(
                  incident.affectedMonitor.url
                )}</span>
              </div>
              <div>
                <strong>Expected Status</strong>
                <span>${escapeHtml(incident.affectedMonitor.expectedStatusRange)}</span>
              </div>
              <div>
                <strong>Matching Rule</strong>
                <span>${escapeHtml(incident.affectedMonitor.matchingRule.description)}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2>Delivery History</h2>
            <table>
              <thead>
                <tr>
                  <th>Delivered At</th>
                  <th>Channel</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>${renderDeliveryRows(detail.deliveryHistory)}</tbody>
            </table>
          </section>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
