const { URL } = require("node:url");
const { NotFoundError, ValidationError } = require("./monitor-service");
const { renderMonitorListPage, renderMonitorDetailPage } = require("./html");

async function parseRequestBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  const contentType = request.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return body ? JSON.parse(body) : {};
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(body));
  }

  return {};
}

function sendHtml(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "text/html; charset=utf-8" });
  response.end(body);
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function redirect(response, location) {
  response.writeHead(302, { location });
  response.end();
}

function notFound(response) {
  sendJson(response, 404, { error: "Not found" });
}

function monitorValues(source = {}) {
  return {
    name: source.name || "",
    url: source.url || "",
    method: source.method || "GET",
    intervalSeconds: source.intervalSeconds || 60,
    timeoutMs: source.timeoutMs || 5000,
    expectedStatusMin: source.expectedStatusMin || 200,
    expectedStatusMax: source.expectedStatusMax || 299,
    keywordMatch: source.keywordMatch || ""
  };
}

function createApp({ monitorService }) {
  return async function app(request, response) {
    const requestUrl = new URL(request.url, "http://localhost");
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);

    try {
      if (request.method === "GET" && requestUrl.pathname === "/") {
        redirect(response, "/monitors");
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/health") {
        sendJson(response, 200, { status: "ok" });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/monitors") {
        const monitors = monitorService.listMonitors();
        sendHtml(response, 200, renderMonitorListPage({ monitors }));
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/monitors") {
        const formValues = await parseRequestBody(request);

        try {
          const monitor = monitorService.createMonitor(formValues);
          redirect(response, `/monitors/${monitor.id}`);
        } catch (error) {
          if (!(error instanceof ValidationError)) {
            throw error;
          }

          sendHtml(
            response,
            400,
            renderMonitorListPage({
              monitors: monitorService.listMonitors(),
              values: monitorValues(formValues),
              errors: error.errors
            })
          );
        }

        return;
      }

      if (request.method === "GET" && pathSegments[0] === "monitors" && pathSegments.length === 2) {
        const monitor = monitorService.getMonitor(pathSegments[1]);
        sendHtml(response, 200, renderMonitorDetailPage({ monitor }));
        return;
      }

      if (request.method === "POST" && pathSegments[0] === "monitors" && pathSegments.length === 2) {
        const monitorId = pathSegments[1];
        const formValues = await parseRequestBody(request);

        try {
          if (formValues._action) {
            monitorService.applyAction(monitorId, formValues._action);
          } else {
            monitorService.updateMonitor(monitorId, formValues);
          }

          redirect(response, `/monitors/${monitorId}`);
        } catch (error) {
          if (!(error instanceof ValidationError)) {
            throw error;
          }

          const monitor = monitorService.getMonitor(monitorId);
          sendHtml(
            response,
            400,
            renderMonitorDetailPage({
              monitor,
              values: monitorValues({ ...monitor, ...formValues }),
              errors: error.errors
            })
          );
        }

        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/monitors") {
        sendJson(response, 200, { data: monitorService.listMonitors() });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/api/monitors/scheduled") {
        sendJson(response, 200, { data: monitorService.listScheduledMonitors() });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/api/monitors") {
        const payload = await parseRequestBody(request);
        const monitor = monitorService.createMonitor(payload);
        sendJson(response, 201, { data: monitor });
        return;
      }

      if (request.method === "PATCH" && pathSegments[0] === "api" && pathSegments[1] === "monitors" && pathSegments.length === 3) {
        const monitorId = pathSegments[2];
        const payload = await parseRequestBody(request);
        const monitor = payload.action
          ? monitorService.applyAction(monitorId, payload.action)
          : monitorService.updateMonitor(monitorId, payload);
        sendJson(response, 200, { data: monitor });
        return;
      }

      notFound(response);
    } catch (error) {
      if (error instanceof ValidationError) {
        sendJson(response, 400, { error: error.message, fieldErrors: error.errors });
        return;
      }

      if (error instanceof NotFoundError) {
        sendJson(response, 404, { error: error.message });
        return;
      }

      sendJson(response, 500, {
        error: "Internal server error",
        detail: error.message
      });
    }
  };
}

module.exports = {
  createApp
};
