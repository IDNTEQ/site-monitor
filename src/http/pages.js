function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(title, currentPath, content) {
  const dashboardCurrent = currentPath === "/dashboard" ? ' aria-current="page"' : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} | site-monitor</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #17212b;
        --muted: #52606d;
        --surface: #f6f8fb;
        --card: #ffffff;
        --line: #ccd6e0;
        --accent: #0b5cab;
        --danger: #8f2d2d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background: linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%);
      }
      a { color: var(--accent); }
      .skip-link {
        position: absolute;
        left: 1rem;
        top: -3rem;
        background: #ffffff;
        padding: 0.75rem 1rem;
        border: 2px solid var(--accent);
      }
      .skip-link:focus { top: 1rem; }
      header {
        background: #132030;
        color: #ffffff;
        padding: 1rem 1.25rem;
      }
      nav {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        align-items: center;
      }
      nav a {
        color: inherit;
        text-decoration: none;
      }
      nav a[aria-current="page"] {
        text-decoration: underline;
        text-underline-offset: 0.2rem;
      }
      main {
        max-width: 1100px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
      }
      section, form, article {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 0.75rem;
        padding: 1rem;
        margin-bottom: 1rem;
      }
      .grid {
        display: grid;
        gap: 1rem;
      }
      .grid.cols-2 {
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
      .grid.cols-4 {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }
      dl {
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr;
        gap: 0.5rem 1rem;
        margin: 0;
      }
      dt { font-weight: 700; }
      dd { margin: 0; }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 0.65rem 0.5rem;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      label {
        display: block;
        font-weight: 700;
        margin-bottom: 0.25rem;
      }
      input, textarea, select, button {
        font: inherit;
      }
      input, textarea, select {
        width: 100%;
        padding: 0.55rem 0.7rem;
        border: 1px solid #8ea0b3;
        border-radius: 0.5rem;
      }
      button {
        padding: 0.6rem 0.9rem;
        border: 1px solid #274d73;
        border-radius: 0.5rem;
        background: #173a5e;
        color: #ffffff;
        cursor: pointer;
      }
      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .status-label {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 700;
      }
      .summary-count {
        font-size: 1.8rem;
        font-weight: 700;
        margin-top: 0.35rem;
      }
      .muted {
        color: var(--muted);
      }
      .errors {
        border-color: #c66a6a;
        background: #fff4f4;
      }
      .field-error {
        color: var(--danger);
        margin-top: 0.35rem;
      }
      .list-reset {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .timeline-item + .timeline-item {
        margin-top: 0.75rem;
        padding-top: 0.75rem;
        border-top: 1px solid var(--line);
      }
    </style>
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <header>
      <nav aria-label="Primary">
        <strong>site-monitor</strong>
        <a href="/dashboard"${dashboardCurrent}>Dashboard</a>
      </nav>
    </header>
    <main id="main-content">
      ${content}
    </main>
  </body>
</html>`;
}

function humanizeLabel(value) {
  return String(value)
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderStatusLabel(label, icon) {
  return `<span class="status-label"><span aria-hidden="true">${escapeHtml(icon)}</span> ${escapeHtml(humanizeLabel(label))}</span>`;
}

function renderKeyValueRows(entries) {
  return `<dl>${entries
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${value === null ? "None" : escapeHtml(value)}</dd>`,
    )
    .join("")}</dl>`;
}

function renderErrorSummary(errors) {
  const errorEntries = Object.entries(errors ?? {});
  if (errorEntries.length === 0) {
    return "";
  }

  return `<section class="errors" role="alert" aria-labelledby="error-summary-title">
    <h2 id="error-summary-title">Please fix the following</h2>
    <ul>
      ${errorEntries
        .map(([field, message]) => `<li><a href="#${escapeHtml(field)}">${escapeHtml(message)}</a></li>`)
        .join("")}
    </ul>
  </section>`;
}

function renderActionButtons(buttons) {
  return `<div class="button-row">${buttons
    .map(
      (button) =>
        `<button type="submit" name="action" value="${escapeHtml(button.value)}">${escapeHtml(button.label)}</button>`,
    )
    .join("")}</div>`;
}

export function renderDashboardPage(dashboard, filters = {}) {
  const summaryCards = [
    ["Healthy", dashboard.summary.healthy, "o"],
    ["Degraded", dashboard.summary.degraded, "~"],
    ["Open incidents", dashboard.summary.incident, "!"],
    ["Paused", dashboard.summary.paused, "="],
  ];

  return renderPage(
    "Dashboard",
    "/dashboard",
    `<h1>Dashboard</h1>
    <p class="muted">Showing the last ${escapeHtml(dashboard.dataset.days)} days from ${escapeHtml(
      dashboard.dataset.startedAt,
    )} to ${escapeHtml(dashboard.dataset.asOf)}.</p>
    <section aria-labelledby="summary-title">
      <h2 id="summary-title">Current health summary</h2>
      <div class="grid cols-4">
        ${summaryCards
          .map(
            ([label, count, icon]) => `<article>
              <div>${renderStatusLabel(label, icon)}</div>
              <p class="summary-count"${label === "Open incidents" ? ' aria-live="polite"' : ""}>${escapeHtml(
                count,
              )}</p>
            </article>`,
          )
          .join("")}
      </div>
    </section>
    <form action="/dashboard" method="get" aria-labelledby="filters-title">
      <h2 id="filters-title">Filters</h2>
      <div class="grid cols-2">
        <div>
          <label for="environment-filter">Environment</label>
          <input id="environment-filter" name="environment" value="${escapeHtml(
            filters.environment ?? "",
          )}" />
        </div>
        <div>
          <label for="status-filter">Status</label>
          <input id="status-filter" name="status" value="${escapeHtml(filters.status ?? "")}" />
        </div>
        <div>
          <label for="tag-filter">Tag</label>
          <input id="tag-filter" name="tag" value="${escapeHtml(filters.tag ?? "")}" />
        </div>
        <div>
          <label for="recent-incident-state-filter">Recent incident state</label>
          <input
            id="recent-incident-state-filter"
            name="recentIncidentState"
            value="${escapeHtml(filters.recentIncidentState ?? "")}"
          />
        </div>
      </div>
      <input type="hidden" name="asOf" value="${escapeHtml(dashboard.dataset.asOf)}" />
      <button type="submit">Apply filters</button>
    </form>
    <div class="grid cols-2">
      <section aria-labelledby="monitor-table-title">
        <h2 id="monitor-table-title">Monitor table</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Monitor</th>
              <th scope="col">Environment</th>
              <th scope="col">Status</th>
              <th scope="col">Last check</th>
              <th scope="col">Latency</th>
            </tr>
          </thead>
          <tbody>
            ${dashboard.monitors
              .map(
                (monitor) => `<tr>
                  <td><a href="/monitors/${escapeHtml(monitor.id)}">${escapeHtml(monitor.name)}</a></td>
                  <td>${escapeHtml(monitor.environment)}</td>
                  <td>${renderStatusLabel(monitor.status, monitor.status === "incident" ? "!" : monitor.status === "degraded" ? "~" : monitor.status === "paused" ? "=" : "o")}</td>
                  <td>${escapeHtml(monitor.lastCheckAt ?? "No checks yet")}</td>
                  <td>${escapeHtml(monitor.responseTimeMs ?? "n/a")}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="open-incidents-title">
        <h2 id="open-incidents-title">Open incidents</h2>
        <ul class="list-reset">
          ${dashboard.openIncidents
            .map(
              (incident) => `<li>
                <a href="/incidents/${escapeHtml(incident.id)}">${escapeHtml(incident.monitorName)}</a>
                <div>${renderStatusLabel(incident.severity, "!")}</div>
                <p class="muted">Opened ${escapeHtml(incident.openedAt)}</p>
              </li>`,
            )
            .join("")}
        </ul>
      </section>
    </div>`,
  );
}

export function renderMonitorDetailPage(detail) {
  const buttons =
    detail.monitor.status === "active"
      ? [
          { value: "pause", label: "Pause monitor" },
          { value: "archive", label: "Archive monitor" },
        ]
      : detail.monitor.status === "paused"
        ? [
            { value: "resume", label: "Resume monitor" },
            { value: "archive", label: "Archive monitor" },
          ]
        : [];

  return renderPage(
    "Monitor Detail",
    "",
    `<p><a href="/dashboard">Back to dashboard</a></p>
    <h1>Monitor Detail</h1>
    <section aria-labelledby="monitor-summary-title">
      <h2 id="monitor-summary-title">${escapeHtml(detail.monitor.name)}</h2>
      ${renderKeyValueRows([
        ["Environment", detail.monitor.environment],
        ["URL", detail.monitor.url],
        ["Method", detail.monitor.method],
        ["Status", detail.monitor.status],
        ["Interval seconds", detail.monitor.intervalSeconds],
        ["Timeout milliseconds", detail.monitor.timeoutMs],
        ["Expected status", `${detail.monitor.expectedStatusMin}-${detail.monitor.expectedStatusMax}`],
        ["Keyword", detail.monitor.keyword ?? "None"],
        ["Tags", detail.monitor.tags.join(", ") || "None"],
        ["Last check", detail.monitor.lastCheckAt ?? "No checks yet"],
      ])}
    </section>
    <form action="/monitors/${escapeHtml(detail.monitor.id)}/actions" method="post" aria-labelledby="monitor-actions-title">
      <h2 id="monitor-actions-title">Monitor actions</h2>
      ${
        buttons.length > 0
          ? renderActionButtons(buttons)
          : "<p>This monitor has no available state actions.</p>"
      }
    </form>
    <section aria-labelledby="incident-link-title">
      <h2 id="incident-link-title">Latest incident</h2>
      ${
        detail.monitor.currentIncident
          ? `<p><a href="/incidents/${escapeHtml(detail.monitor.currentIncident.id)}">${escapeHtml(
              detail.monitor.currentIncident.id,
            )}</a></p>`
          : "<p>No current incident.</p>"
      }
    </section>
    <section aria-labelledby="recent-checks-title">
      <h2 id="recent-checks-title">Recent check history</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Checked at</th>
            <th scope="col">Outcome</th>
            <th scope="col">Status code</th>
            <th scope="col">Response time</th>
            <th scope="col">Error class</th>
            <th scope="col">Matching rule</th>
          </tr>
        </thead>
        <tbody>
          ${detail.recentChecks
            .map(
              (check) => `<tr>
                <td>${escapeHtml(check.checkedAt)}</td>
                <td>${escapeHtml(check.outcome)}</td>
                <td>${escapeHtml(check.statusCode)}</td>
                <td>${escapeHtml(check.responseTimeMs)}</td>
                <td>${escapeHtml(check.errorClass ?? "None")}</td>
                <td>${escapeHtml(check.matchingRuleResult ?? "None")}</td>
              </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>`,
  );
}

function renderTimelineItem(event) {
  return `<li class="timeline-item">
    <strong>${escapeHtml(event.eventType)}</strong>
    <div>${escapeHtml(event.createdAt)}</div>
    <div>${escapeHtml(event.actor ?? "system")}</div>
    <p>${escapeHtml(event.note ?? "No note")}</p>
  </li>`;
}

export function renderIncidentDetailPage(detail, formState = {}) {
  const errors = formState.errors ?? {};
  const actor = formState.actor ?? "";
  const note = formState.note ?? "";

  return renderPage(
    "Incident Detail",
    "",
    `<p><a href="/dashboard">Back to dashboard</a></p>
    <h1>Incident Detail</h1>
    ${renderErrorSummary(errors)}
    <section aria-labelledby="incident-summary-title">
      <h2 id="incident-summary-title">${escapeHtml(detail.incident.id)}</h2>
      ${renderKeyValueRows([
        ["State", detail.incident.state],
        ["Monitor", detail.incident.affectedMonitor.name],
        ["Environment", detail.incident.affectedMonitor.environment],
        ["Opened at", detail.incident.openedAt ?? "Unknown"],
        ["First failure", detail.incident.firstFailureAt ?? "Unknown"],
        ["Acknowledged at", detail.incident.acknowledgedAt ?? "Not acknowledged"],
        ["Resolved at", detail.incident.resolvedAt ?? "Not resolved"],
      ])}
    </section>
    <form action="/incidents/${escapeHtml(detail.incident.id)}/actions" method="post" aria-labelledby="incident-actions-title">
      <h2 id="incident-actions-title">Incident actions</h2>
      <div class="grid cols-2">
        <div>
          <label for="actor">Operator name</label>
          <input id="actor" name="actor" value="${escapeHtml(actor)}" aria-describedby="${errors.actor ? "actor-error" : ""}" />
          ${errors.actor ? `<p class="field-error" id="actor-error">${escapeHtml(errors.actor)}</p>` : ""}
        </div>
        <div>
          <label for="note">Action note</label>
          <textarea id="note" name="note" rows="3">${escapeHtml(note)}</textarea>
        </div>
      </div>
      ${renderActionButtons([
        { value: "acknowledge", label: "Acknowledge incident" },
        { value: "mute", label: "Mute alerts for this incident" },
        { value: "unmute", label: "Unmute alerts for this incident" },
        { value: "resolve", label: "Resolve incident" },
      ])}
    </form>
    <div class="grid cols-2">
      <section aria-labelledby="evidence-title">
        <h2 id="evidence-title">Latest check evidence</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Checked at</th>
              <th scope="col">Status code</th>
              <th scope="col">Response time</th>
              <th scope="col">Error class</th>
              <th scope="col">Matching rule</th>
            </tr>
          </thead>
          <tbody>
            ${detail.latestCheckResults
              .map(
                (check) => `<tr>
                  <td>${escapeHtml(check.checkedAt)}</td>
                  <td>${escapeHtml(check.statusCode)}</td>
                  <td>${escapeHtml(check.responseTimeMs)}</td>
                  <td>${escapeHtml(check.errorClass ?? "None")}</td>
                  <td>${escapeHtml(check.matchingRuleResult ?? "None")}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="delivery-history-title">
        <h2 id="delivery-history-title">Delivery history</h2>
        <ul>
          ${detail.deliveryHistory
            .map(
              (delivery) => `<li>${escapeHtml(delivery.channel)}: ${escapeHtml(
                delivery.status,
              )} at ${escapeHtml(delivery.deliveredAt ?? "Unknown")}</li>`,
            )
            .join("")}
        </ul>
      </section>
    </div>
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title">Timeline</h2>
      <ol>
        ${detail.timeline.map((event) => renderTimelineItem(event)).join("")}
      </ol>
    </section>`,
  );
}

export function renderHtmlErrorPage(title, message) {
  return renderPage(
    title,
    "",
    `<h1>${escapeHtml(title)}</h1><section><p>${escapeHtml(message)}</p><p><a href="/dashboard">Return to dashboard</a></p></section>`,
  );
}
