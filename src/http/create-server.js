import http from "node:http";

import { IncidentRepository } from "../repositories/incident-repository.js";
import { getIncidentDetail } from "../services/get-incident-detail.js";
import { renderIncidentDetailPage } from "./render-incident-detail.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8"
  });
  response.end(html);
}

function renderIndex(repository) {
  const rows = repository
    .listIncidents()
    .map(
      (incident) => `<li><a href="/incidents/${incident.id}">${incident.id}</a> · ${
        incident.monitorName
      } · ${incident.state} · ${incident.openedAt}</li>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>site-monitor</title>
  </head>
  <body>
    <h1>site-monitor</h1>
    <p>Available incident details:</p>
    <ul>${rows}</ul>
  </body>
</html>`;
}

export function createServer({ repository = new IncidentRepository() } = {}) {
  return http.createServer(createRequestHandler({ repository }));
}

export function createRequestHandler({
  repository = new IncidentRepository()
} = {}) {
  return (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    if (request.method !== "GET") {
      sendJson(response, 405, { error: "method_not_allowed" });
      return;
    }

    if (url.pathname === "/") {
      sendHtml(response, 200, renderIndex(repository));
      return;
    }

    if (url.pathname.startsWith("/api/incidents/")) {
      const incidentId = url.pathname.slice("/api/incidents/".length);
      const detail = getIncidentDetail(repository, incidentId);

      if (!detail) {
        sendJson(response, 404, { error: "incident_not_found" });
        return;
      }

      sendJson(response, 200, detail);
      return;
    }

    if (url.pathname.startsWith("/incidents/")) {
      const incidentId = url.pathname.slice("/incidents/".length);
      const detail = getIncidentDetail(repository, incidentId);

      if (!detail) {
        sendHtml(response, 404, "<h1>Incident not found</h1>");
        return;
      }

      sendHtml(response, 200, renderIncidentDetailPage(detail));
      return;
    }

    sendJson(response, 404, { error: "not_found" });
  };
}
