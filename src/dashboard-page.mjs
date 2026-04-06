import { createDashboardData, filterMonitors } from "./dashboard-data.mjs";

const ROW_LIMIT = 12;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function metricCard(label, value, tone, detail) {
  return `
    <article class="metric metric-${tone}">
      <p class="metric-label">${escapeHtml(label)}</p>
      <p class="metric-value">${escapeHtml(value)}</p>
      <p class="metric-detail">${escapeHtml(detail)}</p>
    </article>
  `;
}

function renderSummary(summary, dataset) {
  return `
    <section class="metrics" aria-label="Dashboard summary">
      ${metricCard("Healthy", summary.healthy, "healthy", `${dataset.monitorCount} monitors in 30-day slice`)}
      ${metricCard("Degraded", summary.degraded, "degraded", "Elevated latency or reduced headroom")}
      ${metricCard("Open incidents", summary.openIncidents, "incident", "Actionable failures across environments")}
      ${metricCard("Paused", summary.paused, "paused", "Excluded from active checks")}
    </section>
  `;
}

function renderFilterSelect(id, label, options, selected) {
  const optionMarkup = options
    .map((option) => {
      const value = option === "all" ? "all" : option;
      const isSelected = value === selected ? " selected" : "";
      return `<option value="${escapeHtml(value)}"${isSelected}>${escapeHtml(option)}</option>`;
    })
    .join("");

  return `
    <label class="filter-field" for="${escapeHtml(id)}">
      <span>${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}" name="${escapeHtml(id)}">${optionMarkup}</select>
    </label>
  `;
}

function renderFilters(filters, selected) {
  return `
    <section class="filters" aria-label="Monitor filters">
      ${renderFilterSelect("environment", "Environment", ["all", ...filters.environments], selected.environment)}
      ${renderFilterSelect("status", "Status", filters.statuses, selected.status)}
      ${renderFilterSelect("tag", "Tag", filters.tags, selected.tag)}
      ${renderFilterSelect("incidentState", "Incident state", filters.incidentStates, selected.incidentState)}
    </section>
  `;
}

function renderSparkline(points) {
  return points
    .map((point, index) => {
      const height = point === 0 ? 22 : 42;
      return `<span class="spark-bar" style="height:${height}px" aria-hidden="true"></span>`;
    })
    .join("");
}

function renderMonitorRows(monitors) {
  if (!monitors.length) {
    return `
      <tr>
        <td colspan="7" class="empty-state">No monitors match the current filter combination.</td>
      </tr>
    `;
  }

  return monitors
    .slice(0, ROW_LIMIT)
    .map(
      (monitor) => `
        <tr>
          <td>
            <p class="row-title">${escapeHtml(monitor.name)}</p>
            <p class="row-meta">${escapeHtml(monitor.environment)} · ${escapeHtml(monitor.tag)}</p>
          </td>
          <td><span class="status-pill status-${escapeHtml(monitor.status)}">${escapeHtml(monitor.status)}</span></td>
          <td>${escapeHtml(`${monitor.latencyMs} ms`)}</td>
          <td>${escapeHtml(`${monitor.availability30d}%`)}</td>
          <td>${escapeHtml(String(monitor.incidents30d))}</td>
          <td>${escapeHtml(monitor.lastCheckedAt)}</td>
          <td>
            <div class="sparkline" aria-label="Recent monitor health">
              ${renderSparkline(monitor.sparkline)}
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function renderIncidents(incidents) {
  return incidents
    .map(
      (incident) => `
        <article class="incident-card">
          <div class="incident-head">
            <p class="incident-id">${escapeHtml(incident.id)}</p>
            <span class="severity-pill severity-${escapeHtml(incident.severity)}">${escapeHtml(incident.severity)}</span>
          </div>
          <p class="incident-monitor">${escapeHtml(incident.monitorName)}</p>
          <p class="incident-summary">${escapeHtml(incident.summary)}</p>
          <dl class="incident-meta">
            <div><dt>Age</dt><dd>${escapeHtml(incident.age)}</dd></div>
            <div><dt>Owner</dt><dd>${escapeHtml(incident.owner)}</dd></div>
          </dl>
        </article>
      `
    )
    .join("");
}

function renderPageContent(data, selectedFilters) {
  const filtered = filterMonitors(data.monitors, selectedFilters);

  return `
    ${renderSummary(data.summary, data.dataset)}
    ${renderFilters(data.filters, selectedFilters)}
    <section class="content-grid">
      <section class="panel panel-table" aria-labelledby="monitor-heading">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Primary content</p>
            <h2 id="monitor-heading">Monitor overview</h2>
          </div>
          <p class="panel-detail">${escapeHtml(`${filtered.length} matching monitors · first ${Math.min(filtered.length, ROW_LIMIT)} shown`)}</p>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Monitor</th>
                <th>Status</th>
                <th>P95 latency</th>
                <th>30-day availability</th>
                <th>Incidents</th>
                <th>Last check</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody id="monitor-rows">${renderMonitorRows(filtered)}</tbody>
          </table>
        </div>
      </section>
      <aside class="panel panel-incidents" aria-labelledby="incident-heading">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Triage</p>
            <h2 id="incident-heading">Open incidents</h2>
          </div>
          <p class="panel-detail">${escapeHtml(`${data.incidents.length} active incidents`)}</p>
        </div>
        <div id="incident-list" class="incident-list">
          ${renderIncidents(data.incidents)}
        </div>
      </aside>
    </section>
  `;
}

function renderStyles() {
  return `
    :root {
      color-scheme: light;
      --bg: #f4efe7;
      --surface: rgba(255, 250, 243, 0.88);
      --surface-strong: #fff7ee;
      --ink: #17231f;
      --muted: #556663;
      --line: rgba(23, 35, 31, 0.1);
      --healthy: #1e7a59;
      --degraded: #a65a18;
      --incident: #ba2d1d;
      --paused: #426b84;
      --accent: #0d4f63;
      --shadow: 0 24px 54px rgba(23, 35, 31, 0.08);
      font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(240, 151, 87, 0.3), transparent 34%),
        radial-gradient(circle at top right, rgba(41, 102, 130, 0.14), transparent 28%),
        linear-gradient(180deg, #f7f2e9 0%, var(--bg) 100%);
    }

    .shell {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }

    .masthead {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      align-items: end;
      margin-bottom: 20px;
    }

    .brand {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .brand-mark {
      width: 54px;
      height: 54px;
      border-radius: 18px;
      display: grid;
      place-items: center;
      font-size: 24px;
      color: #fff;
      background: linear-gradient(135deg, #194d5d 0%, #ee8654 100%);
      box-shadow: var(--shadow);
    }

    .brand-copy h1,
    .brand-copy p,
    .hero h2,
    .hero p {
      margin: 0;
    }

    .brand-copy h1 {
      font-size: clamp(2rem, 5vw, 3.1rem);
      line-height: 0.95;
      letter-spacing: -0.06em;
    }

    .brand-copy p {
      margin-top: 6px;
      color: var(--muted);
      font-size: 0.96rem;
    }

    .hero {
      justify-self: end;
      max-width: 420px;
      padding: 18px 20px;
      border: 1px solid rgba(13, 79, 99, 0.12);
      border-radius: 24px;
      background: rgba(255, 248, 238, 0.7);
      box-shadow: var(--shadow);
    }

    .hero h2 {
      font-size: 1.1rem;
      margin-bottom: 6px;
    }

    .hero p {
      color: var(--muted);
      line-height: 1.5;
    }

    .metrics,
    .filters,
    .content-grid {
      opacity: 0;
      transform: translateY(12px);
      animation: settle 420ms ease-out forwards;
    }

    .filters {
      animation-delay: 90ms;
    }

    .content-grid {
      animation-delay: 160ms;
    }

    @keyframes settle {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 14px;
    }

    .metric,
    .panel,
    .filters {
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--surface);
      box-shadow: var(--shadow);
      backdrop-filter: blur(10px);
    }

    .metric {
      padding: 18px 20px;
    }

    .metric-label,
    .metric-detail,
    .eyebrow,
    .panel-detail,
    .row-meta,
    .incident-summary,
    .incident-meta,
    .filter-field span {
      color: var(--muted);
    }

    .metric-label,
    .metric-value,
    .metric-detail,
    .eyebrow,
    .panel-detail,
    .row-title,
    .row-meta,
    .incident-id,
    .incident-monitor,
    .incident-summary {
      margin: 0;
    }

    .metric-value {
      margin-top: 10px;
      font-size: clamp(2rem, 4vw, 2.9rem);
      line-height: 0.95;
      letter-spacing: -0.08em;
    }

    .metric-detail {
      margin-top: 10px;
      line-height: 1.45;
    }

    .metric-healthy {
      background: linear-gradient(180deg, rgba(238, 251, 244, 0.95) 0%, rgba(255, 250, 243, 0.88) 100%);
    }

    .metric-degraded {
      background: linear-gradient(180deg, rgba(255, 241, 226, 0.95) 0%, rgba(255, 250, 243, 0.88) 100%);
    }

    .metric-incident {
      background: linear-gradient(180deg, rgba(255, 233, 226, 0.98) 0%, rgba(255, 250, 243, 0.9) 100%);
    }

    .metric-paused {
      background: linear-gradient(180deg, rgba(233, 243, 249, 0.98) 0%, rgba(255, 250, 243, 0.9) 100%);
    }

    .filters {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      padding: 16px;
      margin-bottom: 14px;
    }

    .filter-field {
      display: grid;
      gap: 8px;
      font-size: 0.92rem;
    }

    .filter-field select {
      width: 100%;
      border: 1px solid rgba(23, 35, 31, 0.16);
      border-radius: 14px;
      padding: 12px 14px;
      color: var(--ink);
      background: var(--surface-strong);
      font: inherit;
    }

    .content-grid {
      display: grid;
      grid-template-columns: minmax(0, 2.1fr) minmax(300px, 0.95fr);
      gap: 14px;
    }

    .panel {
      padding: 18px;
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: end;
      margin-bottom: 16px;
    }

    .panel-head h2 {
      margin: 4px 0 0;
      font-size: 1.38rem;
      letter-spacing: -0.04em;
    }

    .table-wrap {
      overflow: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 13px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(23, 35, 31, 0.08);
      vertical-align: middle;
      white-space: nowrap;
    }

    th {
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .row-title {
      font-weight: 700;
    }

    .row-meta {
      margin-top: 4px;
      font-size: 0.88rem;
    }

    .status-pill,
    .severity-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 0.84rem;
      font-weight: 700;
      text-transform: capitalize;
    }

    .status-healthy {
      color: var(--healthy);
      background: rgba(30, 122, 89, 0.12);
    }

    .status-degraded {
      color: var(--degraded);
      background: rgba(166, 90, 24, 0.12);
    }

    .status-incident,
    .severity-critical {
      color: var(--incident);
      background: rgba(186, 45, 29, 0.12);
    }

    .status-paused,
    .severity-elevated {
      color: var(--paused);
      background: rgba(66, 107, 132, 0.14);
    }

    .sparkline {
      display: flex;
      align-items: end;
      gap: 4px;
      min-height: 42px;
    }

    .spark-bar {
      width: 6px;
      border-radius: 999px;
      background: linear-gradient(180deg, #1f7463 0%, #ee8654 100%);
    }

    .incident-list {
      display: grid;
      gap: 12px;
    }

    .incident-card {
      padding: 14px;
      border: 1px solid rgba(23, 35, 31, 0.08);
      border-radius: 18px;
      background: rgba(255, 252, 247, 0.96);
    }

    .incident-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 10px;
    }

    .incident-id {
      font-weight: 800;
      letter-spacing: 0.06em;
      font-size: 0.82rem;
    }

    .incident-monitor {
      font-weight: 700;
    }

    .incident-summary {
      margin-top: 6px;
      line-height: 1.5;
    }

    .incident-meta {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 12px 0 0;
      font-size: 0.9rem;
    }

    .incident-meta div,
    .incident-meta dt,
    .incident-meta dd {
      margin: 0;
    }

    .empty-state {
      color: var(--muted);
      text-align: center;
      padding: 28px 14px;
    }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 980px) {
      .masthead,
      .content-grid {
        grid-template-columns: 1fr;
      }

      .hero {
        justify-self: stretch;
        max-width: none;
      }

      .metrics,
      .filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 640px) {
      .shell {
        width: min(100vw - 18px, 100%);
        padding-top: 18px;
      }

      .metrics,
      .filters {
        grid-template-columns: 1fr;
      }

      .metric,
      .panel,
      .filters {
        border-radius: 20px;
      }

      .panel-head {
        flex-direction: column;
        align-items: start;
      }

      th:nth-child(4),
      td:nth-child(4),
      th:nth-child(7),
      td:nth-child(7) {
        display: none;
      }
    }
  `;
}

function renderClientScript() {
  return `
    (() => {
      const data = JSON.parse(document.getElementById("dashboard-data").textContent);
      const rowLimit = ${ROW_LIMIT};
      const monitorRows = document.getElementById("monitor-rows");
      const incidentList = document.getElementById("incident-list");
      const filterInputs = {
        environment: document.getElementById("environment"),
        status: document.getElementById("status"),
        tag: document.getElementById("tag"),
        incidentState: document.getElementById("incidentState")
      };
      const panelDetail = document.querySelector(".panel-table .panel-detail");

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
      }

      function renderSparkline(points) {
        return points
          .map((point) => {
            const height = point === 0 ? 22 : 42;
            return '<span class="spark-bar" style="height:' + height + 'px" aria-hidden="true"></span>';
          })
          .join("");
      }

      function filterMonitors(monitors, filters) {
        return monitors.filter((monitor) => {
          if (filters.environment !== "all" && monitor.environment !== filters.environment) return false;
          if (filters.status !== "all" && monitor.status !== filters.status) return false;
          if (filters.tag !== "all" && monitor.tag !== filters.tag) return false;
          if (filters.incidentState !== "all" && monitor.incidentState !== filters.incidentState) return false;
          return true;
        });
      }

      function renderRows(monitors) {
        if (!monitors.length) {
          return '<tr><td colspan="7" class="empty-state">No monitors match the current filter combination.</td></tr>';
        }

        return monitors.slice(0, rowLimit).map((monitor) => {
          return [
            "<tr>",
            "<td><p class=\\"row-title\\">" + escapeHtml(monitor.name) + "</p><p class=\\"row-meta\\">" + escapeHtml(monitor.environment + " · " + monitor.tag) + "</p></td>",
            "<td><span class=\\"status-pill status-" + escapeHtml(monitor.status) + "\\">" + escapeHtml(monitor.status) + "</span></td>",
            "<td>" + escapeHtml(monitor.latencyMs + " ms") + "</td>",
            "<td>" + escapeHtml(monitor.availability30d + "%") + "</td>",
            "<td>" + escapeHtml(String(monitor.incidents30d)) + "</td>",
            "<td>" + escapeHtml(monitor.lastCheckedAt) + "</td>",
            "<td><div class=\\"sparkline\\" aria-label=\\"Recent monitor health\\">" + renderSparkline(monitor.sparkline) + "</div></td>",
            "</tr>"
          ].join("");
        }).join("");
      }

      function renderIncidents(incidents) {
        return incidents.map((incident) => {
          return [
            "<article class=\\"incident-card\\">",
            "<div class=\\"incident-head\\"><p class=\\"incident-id\\">" + escapeHtml(incident.id) + "</p><span class=\\"severity-pill severity-" + escapeHtml(incident.severity) + "\\">" + escapeHtml(incident.severity) + "</span></div>",
            "<p class=\\"incident-monitor\\">" + escapeHtml(incident.monitorName) + "</p>",
            "<p class=\\"incident-summary\\">" + escapeHtml(incident.summary) + "</p>",
            "<dl class=\\"incident-meta\\">",
            "<div><dt>Age</dt><dd>" + escapeHtml(incident.age) + "</dd></div>",
            "<div><dt>Owner</dt><dd>" + escapeHtml(incident.owner) + "</dd></div>",
            "</dl>",
            "</article>"
          ].join("");
        }).join("");
      }

      function update() {
        const selected = {
          environment: filterInputs.environment.value,
          status: filterInputs.status.value,
          tag: filterInputs.tag.value,
          incidentState: filterInputs.incidentState.value
        };
        const filtered = filterMonitors(data.monitors, selected);
        monitorRows.innerHTML = renderRows(filtered);
        panelDetail.textContent = filtered.length + " matching monitors · first " + Math.min(filtered.length, rowLimit) + " shown";
      }

      Object.values(filterInputs).forEach((input) => {
        input.addEventListener("change", update, { passive: true });
      });

      requestIdleCallback?.(() => {
        incidentList.innerHTML = renderIncidents(data.incidents);
      }, { timeout: 400 });
    })();
  `;
}

export function renderDashboardPage() {
  const data = createDashboardData();
  const selectedFilters = {
    environment: "all",
    status: "all",
    tag: "all",
    incidentState: "all"
  };

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>site-monitor dashboard</title>
        <meta
          name="description"
          content="Operational dashboard optimized for fast first render on a 30-day dataset slice."
        >
        <style>${renderStyles()}</style>
      </head>
      <body>
        <main class="shell">
          <header class="masthead">
            <div class="brand">
              <div class="brand-mark" aria-hidden="true">S</div>
              <div class="brand-copy">
                <p>site-monitor</p>
                <h1>Dashboard under load.</h1>
              </div>
            </div>
            <section class="hero" aria-label="Performance note">
              <h2>30-day slice, rendered first</h2>
              <p>
                Summary tiles, incident queue, and the first page of monitor rows ship in the initial document.
                Filtering stays client-side so the primary content is visible before any enhancement work.
              </p>
            </section>
          </header>
          ${renderPageContent(data, selectedFilters)}
        </main>
        <script id="dashboard-data" type="application/json">${escapeHtml(JSON.stringify(data))}</script>
        <script>${renderClientScript()}</script>
      </body>
    </html>
  `.trim();
}
