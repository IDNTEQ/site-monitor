function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function humanizeLabel(value) {
  return String(value)
    .split(/[_-]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
        --ink: #16202a;
        --muted: #536272;
        --surface: #eff4f8;
        --card: #ffffff;
        --line: #cfdae5;
        --accent: #1558a6;
        --alert: #a53030;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, #f7fbff 0%, transparent 28%),
          linear-gradient(180deg, #e8eef5 0%, #f6f8fb 100%);
      }
      a {
        color: var(--accent);
      }
      .skip-link {
        position: absolute;
        left: 1rem;
        top: -3rem;
        padding: 0.75rem 1rem;
        background: #ffffff;
        border: 2px solid var(--accent);
      }
      .skip-link:focus {
        top: 1rem;
      }
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
        max-width: 1120px;
        margin: 0 auto;
        padding: 1.5rem 1rem 3rem;
      }
      section, form, article {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 0.85rem;
        padding: 1rem;
        margin-bottom: 1rem;
        box-shadow: 0 10px 30px rgba(19, 32, 48, 0.05);
      }
      h1, h2, h3, p {
        margin-top: 0;
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
      .summary-card {
        background: linear-gradient(180deg, #ffffff 0%, #f7f9fc 100%);
      }
      .summary-count {
        font-size: 1.95rem;
        font-weight: 700;
        margin-bottom: 0;
      }
      .status-label {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-weight: 700;
      }
      .muted {
        color: var(--muted);
      }
      label {
        display: block;
        font-weight: 700;
        margin-bottom: 0.3rem;
      }
      input, select {
        width: 100%;
        font: inherit;
        padding: 0.55rem 0.7rem;
        border: 1px solid #8ea0b3;
        border-radius: 0.5rem;
      }
      button {
        font: inherit;
        padding: 0.65rem 0.95rem;
        border: 1px solid #274d73;
        border-radius: 0.5rem;
        background: #173a5e;
        color: #ffffff;
        cursor: pointer;
      }
      .table-wrap {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 0.7rem 0.5rem;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      .list-reset {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .incident-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        font-size: 0.92rem;
        font-weight: 700;
        text-decoration: none;
      }
      .incident-chip-open {
        background: #ffe4de;
        color: #7a1f1f;
      }
      .incident-chip-muted {
        background: #edf3f8;
        color: #40515f;
      }
      .incident-preview + .incident-preview {
        margin-top: 0.85rem;
        padding-top: 0.85rem;
        border-top: 1px solid var(--line);
      }
      .table-empty {
        padding: 1rem 0.5rem;
      }
      .error-panel {
        border-color: #c66a6a;
        background: #fff4f4;
      }
      dl {
        display: grid;
        grid-template-columns: minmax(150px, 220px) 1fr;
        gap: 0.5rem 1rem;
        margin: 0;
      }
      dt {
        font-weight: 700;
      }
      dd {
        margin: 0;
      }
      @media (max-width: 700px) {
        main {
          padding-inline: 0.75rem;
        }
        section, form, article {
          padding: 0.85rem;
        }
        dl {
          grid-template-columns: 1fr;
        }
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
    <main id="main-content">${content}</main>
  </body>
</html>`;
}

function renderStatusLabel(label, icon) {
  return `<span class="status-label"><span aria-hidden="true">${escapeHtml(icon)}</span> ${escapeHtml(
    humanizeLabel(label),
  )}</span>`;
}

function renderSelectOptions(options, selectedValue) {
  return options
    .map((option) => {
      const selected = option.value === selectedValue ? ' selected="selected"' : "";
      return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
    })
    .join("");
}

function renderRecentIncidentCell(monitor) {
  if (monitor.incidentId) {
    return `<a class="incident-chip incident-chip-open" href="/incidents/${escapeHtml(
      monitor.incidentId,
    )}">! Open ${escapeHtml(monitor.incidentId)}</a>`;
  }

  const label =
    monitor.recentIncidentState === "resolved"
      ? "Resolved recently"
      : monitor.recentIncidentState === "acknowledged"
        ? "Acknowledged recently"
        : "No recent incident";

  return `<span class="incident-chip incident-chip-muted">${escapeHtml(label)}</span>`;
}

function renderIncidentAge(openedAt, asOf) {
  if (!openedAt) {
    return "Unknown age";
  }

  const ageMs = Date.parse(asOf) - Date.parse(openedAt);
  if (Number.isNaN(ageMs) || ageMs < 0) {
    return "Unknown age";
  }

  const ageMinutes = Math.floor(ageMs / (60 * 1000));
  if (ageMinutes < 1) {
    return "Opened less than a minute ago";
  }

  if (ageMinutes < 60) {
    return `Opened ${ageMinutes} minute${ageMinutes === 1 ? "" : "s"} ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  return `Opened ${ageHours} hour${ageHours === 1 ? "" : "s"} ago`;
}

function renderKeyValueRows(entries) {
  return `<dl>${entries
    .map(
      ([key, value]) =>
        `<dt>${escapeHtml(key)}</dt><dd>${value === null ? "None" : escapeHtml(value)}</dd>`,
    )
    .join("")}</dl>`;
}

export function renderDashboardPage(dashboard, filters = {}) {
  const summaryCards = [
    ["Healthy", dashboard.summary.healthy, "o"],
    ["Degraded", dashboard.summary.degraded, "~"],
    ["Incident monitors", dashboard.summary.incident, "!"],
    ["Paused", dashboard.summary.paused, "="],
  ];
  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "healthy", label: "Healthy" },
    { value: "degraded", label: "Degraded" },
    { value: "incident", label: "Incident" },
    { value: "paused", label: "Paused" },
  ];
  const recentIncidentOptions = [
    { value: "", label: "Any recent incident state" },
    { value: "open", label: "Open" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "resolved", label: "Resolved" },
    { value: "none", label: "None" },
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
            ([label, count, icon]) => `<article class="summary-card">
              <div>${renderStatusLabel(label, icon)}</div>
              <p class="summary-count"${label === "Incident monitors" ? ' aria-live="polite"' : ""}>${escapeHtml(
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
          <select id="status-filter" name="status">
            ${renderSelectOptions(statusOptions, filters.status ?? "")}
          </select>
        </div>
        <div>
          <label for="tag-filter">Tag</label>
          <input id="tag-filter" name="tag" value="${escapeHtml(filters.tag ?? "")}" />
        </div>
        <div>
          <label for="recent-incident-state-filter">Recent incident state</label>
          <select id="recent-incident-state-filter" name="recentIncidentState">
            ${renderSelectOptions(recentIncidentOptions, filters.recentIncidentState ?? "")}
          </select>
        </div>
      </div>
      <input type="hidden" name="asOf" value="${escapeHtml(dashboard.dataset.asOf)}" />
      <button type="submit">Apply filters</button>
    </form>
    <div class="grid cols-2">
      <section aria-labelledby="monitor-table-title">
        <h2 id="monitor-table-title">Monitor table</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Monitor</th>
                <th scope="col">Environment</th>
                <th scope="col">Status</th>
                <th scope="col">Recent incident</th>
                <th scope="col">Last check</th>
                <th scope="col">Latency</th>
              </tr>
            </thead>
            <tbody>
              ${
                dashboard.monitors.length > 0
                  ? dashboard.monitors
                      .map(
                        (monitor) => `<tr>
                          <td>${escapeHtml(monitor.name)}</td>
                          <td>${escapeHtml(monitor.environment)}</td>
                          <td>${renderStatusLabel(
                            monitor.status,
                            monitor.status === "incident"
                              ? "!"
                              : monitor.status === "degraded"
                                ? "~"
                                : monitor.status === "paused"
                                  ? "="
                                  : "o",
                          )}</td>
                          <td>${renderRecentIncidentCell(monitor)}</td>
                          <td>${escapeHtml(monitor.lastCheckAt ?? "No checks yet")}</td>
                          <td>${escapeHtml(monitor.responseTimeMs ?? "n/a")}</td>
                        </tr>`,
                      )
                      .join("")
                  : '<tr><td class="table-empty" colspan="6">No monitors matched the current dashboard filters.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="open-incidents-title">
        <h2 id="open-incidents-title">Open incidents</h2>
        <ul class="list-reset">
          ${
            dashboard.openIncidents.length > 0
              ? dashboard.openIncidents
                  .map(
                    (incident) => `<li class="incident-preview">
                      <a href="/incidents/${escapeHtml(incident.id)}">${escapeHtml(incident.id)}</a>
                      <div>${escapeHtml(incident.monitorName)}</div>
                      <div>${renderStatusLabel(incident.severity, "!")}</div>
                      <p class="muted">${escapeHtml(
                        renderIncidentAge(incident.openedAt, dashboard.dataset.asOf),
                      )}</p>
                    </li>`,
                  )
                  .join("")
              : '<li class="muted">No open incidents right now.</li>'
          }
        </ul>
      </section>
    </div>`,
  );
}

export function renderIncidentSummaryPage(incident) {
  return renderPage(
    "Incident Summary",
    "",
    `<p><a href="/dashboard">Back to dashboard</a></p>
    <h1>Incident Summary</h1>
    <section aria-labelledby="incident-summary-title">
      <h2 id="incident-summary-title">${escapeHtml(incident.id)}</h2>
      ${renderKeyValueRows([
        ["Monitor", incident.monitor.name],
        ["Environment", incident.monitor.environment],
        ["State", incident.state],
        ["Severity", incident.severity],
        ["Opened at", incident.openedAt ?? "Unknown"],
        ["Acknowledged at", incident.acknowledgedAt ?? "Not acknowledged"],
        ["Resolved at", incident.resolvedAt ?? "Not resolved"],
      ])}
    </section>
    <section>
      <h2>Responder note</h2>
      <p class="muted">This route exists so dashboard incident links land on an operator-facing page while deeper timeline and action workflows are delivered separately.</p>
    </section>`,
  );
}

export function renderHtmlErrorPage(title, message) {
  return renderPage(
    title,
    "",
    `<section class="error-panel" role="alert">
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
    </section>`,
  );
}
