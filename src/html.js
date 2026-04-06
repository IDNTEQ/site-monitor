const { ALLOWED_METHODS } = require("./monitor-validation");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function fieldError(errors, field) {
  if (!errors[field] || errors[field].length === 0) {
    return "";
  }

  return `<p class="field-error" data-field="${escapeHtml(field)}">${escapeHtml(errors[field][0])}</p>`;
}

function renderFormFields(values, errors = {}) {
  const methodOptions = ALLOWED_METHODS.map((method) => {
    const selected = (values.method || "GET") === method ? " selected" : "";
    return `<option value="${method}"${selected}>${method}</option>`;
  }).join("");

  return `
    <label>
      <span>Name</span>
      <input type="text" name="name" value="${escapeHtml(values.name || "")}" maxlength="120" />
      ${fieldError(errors, "name")}
    </label>
    <label>
      <span>URL</span>
      <input type="url" name="url" value="${escapeHtml(values.url || "")}" required />
      ${fieldError(errors, "url")}
    </label>
    <label>
      <span>Method</span>
      <select name="method" required>${methodOptions}</select>
      ${fieldError(errors, "method")}
    </label>
    <label>
      <span>Interval (seconds)</span>
      <input type="number" min="30" max="86400" name="intervalSeconds" value="${escapeHtml(values.intervalSeconds || 60)}" required />
      ${fieldError(errors, "intervalSeconds")}
    </label>
    <label>
      <span>Timeout (ms)</span>
      <input type="number" min="100" max="60000" name="timeoutMs" value="${escapeHtml(values.timeoutMs || 5000)}" required />
      ${fieldError(errors, "timeoutMs")}
    </label>
    <label>
      <span>Expected status min</span>
      <input type="number" min="100" max="599" name="expectedStatusMin" value="${escapeHtml(values.expectedStatusMin || 200)}" required />
      ${fieldError(errors, "expectedStatusMin")}
    </label>
    <label>
      <span>Expected status max</span>
      <input type="number" min="100" max="599" name="expectedStatusMax" value="${escapeHtml(values.expectedStatusMax || 299)}" required />
      ${fieldError(errors, "expectedStatusMax")}
    </label>
    <label>
      <span>Keyword match</span>
      <input type="text" name="keywordMatch" value="${escapeHtml(values.keywordMatch || "")}" maxlength="256" />
      ${fieldError(errors, "keywordMatch")}
    </label>
    ${fieldError(errors, "status")}
  `;
}

function layout({ title, content }) {
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --bg: #f4f6f8;
          --panel: #ffffff;
          --border: #c9d4df;
          --text: #0f1720;
          --muted: #4a6278;
          --accent: #174e7a;
          --accent-soft: #d7e7f5;
          --danger: #b42318;
          --warning: #9a6700;
          --success: #146c2e;
        }

        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "Segoe UI", "Helvetica Neue", sans-serif;
          background: linear-gradient(180deg, #e9eef3 0%, var(--bg) 280px);
          color: var(--text);
        }

        main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px 20px 64px;
        }

        header {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          margin-bottom: 24px;
        }

        h1, h2, h3, p { margin-top: 0; }

        .hero {
          background: radial-gradient(circle at top right, #eff7ff 0%, #ffffff 55%);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 24px 60px rgba(16, 24, 40, 0.08);
          margin-bottom: 24px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 20px;
        }

        .panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 18px 45px rgba(16, 24, 40, 0.05);
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          margin-top: 16px;
        }

        .summary div {
          background: var(--accent-soft);
          border-radius: 14px;
          padding: 14px;
        }

        form {
          display: grid;
          gap: 14px;
        }

        label {
          display: grid;
          gap: 6px;
          font-weight: 600;
        }

        input, select, button {
          font: inherit;
        }

        input, select {
          padding: 11px 12px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: #fff;
        }

        button, .button-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          border-radius: 12px;
          border: none;
          background: var(--accent);
          color: #fff;
          text-decoration: none;
          cursor: pointer;
          font-weight: 600;
        }

        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .button-secondary {
          background: #3b556d;
        }

        .button-danger {
          background: #8f2d1f;
        }

        .monitor-list {
          display: grid;
          gap: 12px;
        }

        .monitor-card {
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px;
          display: grid;
          gap: 10px;
          background: #fbfdff;
        }

        .monitor-card header {
          margin: 0;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status-active {
          background: #dff7e5;
          color: var(--success);
        }

        .status-paused {
          background: #fff3d0;
          color: var(--warning);
        }

        .status-archived {
          background: #f3d6d2;
          color: var(--danger);
        }

        .meta {
          color: var(--muted);
          font-size: 0.95rem;
        }

        .field-error, .form-error {
          color: var(--danger);
          font-size: 0.92rem;
          margin: 0;
          font-weight: 600;
        }

        .empty {
          color: var(--muted);
        }

        .breadcrumbs {
          color: var(--muted);
          margin-bottom: 12px;
        }

        @media (max-width: 820px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .summary {
            grid-template-columns: 1fr;
          }
        }
      </style>
    </head>
    <body>
      <main>
        ${content}
      </main>
    </body>
  </html>`;
}

function renderMonitorListPage({ monitors, values = {}, errors = {} }) {
  const activeCount = monitors.filter((monitor) => monitor.status === "active").length;
  const pausedCount = monitors.filter((monitor) => monitor.status === "paused").length;
  const archivedCount = monitors.filter((monitor) => monitor.status === "archived").length;

  const listMarkup = monitors.length === 0
    ? `<p class="empty">No monitors yet. Create the first monitor to start scheduled checks.</p>`
    : monitors.map((monitor) => `
      <article class="monitor-card">
        <header>
          <h3>${escapeHtml(monitor.name || monitor.url)}</h3>
          <span class="pill status-${escapeHtml(monitor.status)}">${escapeHtml(monitor.status)}</span>
        </header>
        <p class="meta">${escapeHtml(monitor.method)} ${escapeHtml(monitor.url)}</p>
        <p class="meta">Every ${escapeHtml(monitor.intervalSeconds)}s, timeout ${escapeHtml(monitor.timeoutMs)}ms, expected ${escapeHtml(monitor.expectedStatusMin)}-${escapeHtml(monitor.expectedStatusMax)}</p>
        <a class="button-link" href="/monitors/${escapeHtml(monitor.id)}">Manage monitor</a>
      </article>
    `).join("");

  return layout({
    title: "Monitors",
    content: `
      <header>
        <div>
          <p class="breadcrumbs">site-monitor / monitor management</p>
          <h1>Create and manage monitors</h1>
          <p>Define the endpoint, schedule, timeout, and matching rules used by the monitor worker.</p>
        </div>
      </header>
      <section class="hero">
        <h2>Monitor inventory</h2>
        <p>Paused and archived monitors stay visible for operators but are excluded from the scheduled check list.</p>
        <div class="summary">
          <div><strong>${activeCount}</strong><br />Active</div>
          <div><strong>${pausedCount}</strong><br />Paused</div>
          <div><strong>${archivedCount}</strong><br />Archived</div>
        </div>
      </section>
      <div class="grid">
        <section class="panel">
          <h2>New monitor</h2>
          <form method="post" action="/monitors">
            ${renderFormFields(values, errors)}
            <button type="submit">Create monitor</button>
          </form>
        </section>
        <section class="panel">
          <h2>Current monitors</h2>
          <div class="monitor-list">${listMarkup}</div>
        </section>
      </div>
    `
  });
}

function renderMonitorDetailPage({ monitor, values = monitor, errors = {} }) {
  return layout({
    title: monitor.name || monitor.url,
    content: `
      <p class="breadcrumbs"><a href="/monitors">Monitors</a> / ${escapeHtml(monitor.name || monitor.url)}</p>
      <section class="hero">
        <h1>${escapeHtml(monitor.name || monitor.url)}</h1>
        <p>${escapeHtml(monitor.method)} ${escapeHtml(monitor.url)}</p>
        <span class="pill status-${escapeHtml(monitor.status)}">${escapeHtml(monitor.status)}</span>
      </section>
      <div class="grid">
        <section class="panel">
          <h2>Edit configuration</h2>
          <form method="post" action="/monitors/${escapeHtml(monitor.id)}">
            ${renderFormFields(values, errors)}
            <button type="submit">Save changes</button>
          </form>
        </section>
        <section class="panel">
          <h2>Lifecycle</h2>
          <p class="meta">Created ${escapeHtml(monitor.createdAt)}<br />Updated ${escapeHtml(monitor.updatedAt)}</p>
          <div class="button-row">
            <form method="post" action="/monitors/${escapeHtml(monitor.id)}">
              <button class="button-secondary" type="submit" name="_action" value="pause">Pause</button>
            </form>
            <form method="post" action="/monitors/${escapeHtml(monitor.id)}">
              <button class="button-secondary" type="submit" name="_action" value="resume">Resume</button>
            </form>
            <form method="post" action="/monitors/${escapeHtml(monitor.id)}">
              <button class="button-danger" type="submit" name="_action" value="archive">Archive</button>
            </form>
          </div>
          ${fieldError(errors, "status")}
          <h3>Scheduling note</h3>
          <p class="meta">Only monitors in the active state are returned by the scheduled-monitor API used by the worker.</p>
        </section>
      </div>
    `
  });
}

module.exports = {
  renderMonitorListPage,
  renderMonitorDetailPage
};
