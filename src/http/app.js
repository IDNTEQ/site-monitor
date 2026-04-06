import http from "node:http";

import { InMemoryMonitorRepository } from "../repositories/in-memory-monitor-repository.js";
import { createDashboardService, IncidentNotFoundError } from "../services/dashboard-service.js";
import {
  renderDashboardPage,
  renderHtmlErrorPage,
  renderIncidentSummaryPage,
} from "./pages.js";

function writeResponse(response, statusCode, body, contentType, headers = {}) {
  response.writeHead(statusCode, {
    "content-type": contentType,
    ...headers,
  });
  response.end(body);
}

function createJsonResponse(response, statusCode, payload) {
  writeResponse(
    response,
    statusCode,
    JSON.stringify(payload),
    "application/json; charset=utf-8",
  );
}

function createHtmlResponse(response, statusCode, body, headers) {
  writeResponse(response, statusCode, body, "text/html; charset=utf-8", headers);
}

function htmlResult(statusCode, body, headers) {
  return {
    statusCode,
    contentType: "text/html; charset=utf-8",
    body,
    headers,
  };
}

export async function handleApiRequest({
  service,
  method,
  pathname,
  searchParams = new URLSearchParams(),
}) {
  if (method === "GET" && pathname === "/api/dashboard") {
    const dashboard = await service.getDashboard({
      asOf: searchParams.get("asOf") ?? undefined,
      datasetDays: searchParams.get("datasetDays") ?? undefined,
      monitorLimit: searchParams.get("monitorLimit") ?? undefined,
      incidentLimit: searchParams.get("incidentLimit") ?? undefined,
      environment: searchParams.get("environment") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      recentIncidentState: searchParams.get("recentIncidentState") ?? undefined,
    });

    return {
      statusCode: 200,
      payload: { dashboard },
    };
  }

  return {
    statusCode: 404,
    payload: {
      error: "Route not found.",
    },
  };
}

export async function handlePageRequest({
  service,
  method,
  pathname,
  searchParams = new URLSearchParams(),
}) {
  if (method === "GET" && pathname === "/") {
    return htmlResult(303, "", {
      location: "/dashboard",
    });
  }

  if (method === "GET" && pathname === "/dashboard") {
    const filters = {
      asOf: searchParams.get("asOf") ?? undefined,
      environment: searchParams.get("environment") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      recentIncidentState: searchParams.get("recentIncidentState") ?? undefined,
    };
    const dashboard = await service.getDashboard(filters);
    return htmlResult(200, renderDashboardPage(dashboard, filters));
  }

  const incidentRouteMatch = pathname.match(/^\/incidents\/([^/]+)$/);
  if (method === "GET" && incidentRouteMatch) {
    const incident = await service.getIncidentSummary(incidentRouteMatch[1]);
    return htmlResult(200, renderIncidentSummaryPage(incident));
  }

  return htmlResult(404, renderHtmlErrorPage("Page not found", "Route not found."));
}

function createDefaultService() {
  return createDashboardService({
    repository: new InMemoryMonitorRepository({
      monitors: [
        {
          id: "mon-homepage",
          name: "Homepage",
          environment: "production",
          url: "https://example.com",
          status: "active",
          healthState: "healthy",
          recentIncidentState: "resolved",
          tags: ["web"],
          lastCheckAt: "2026-04-06T12:04:00.000Z",
          responseTimeMs: 128,
          createdAt: "2026-04-01T09:00:00.000Z",
          updatedAt: "2026-04-06T12:04:00.000Z",
          currentIncident: null,
        },
        {
          id: "mon-billing",
          name: "Billing",
          environment: "production",
          url: "https://example.com/billing",
          status: "active",
          healthState: "degraded",
          recentIncidentState: "open",
          tags: ["payments"],
          lastCheckAt: "2026-04-06T12:03:00.000Z",
          responseTimeMs: 0,
          createdAt: "2026-04-01T09:00:00.000Z",
          updatedAt: "2026-04-06T12:03:00.000Z",
          currentIncident: {
            id: "INC-204",
            state: "open",
            severity: "critical",
            openedAt: "2026-04-06T11:55:00.000Z",
          },
        },
        {
          id: "mon-search",
          name: "Search",
          environment: "staging",
          url: "https://staging.example.com/search",
          status: "paused",
          healthState: "healthy",
          recentIncidentState: "none",
          tags: ["search"],
          lastCheckAt: "2026-04-06T11:00:00.000Z",
          responseTimeMs: 142,
          createdAt: "2026-04-01T09:00:00.000Z",
          updatedAt: "2026-04-06T11:00:00.000Z",
          currentIncident: null,
        },
      ],
    }),
    clock: () => new Date("2026-04-06T12:05:00.000Z"),
  });
}

export function createApp({ service = createDefaultService() } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    try {
      if (url.pathname.startsWith("/api")) {
        const result = await handleApiRequest({
          service,
          method: request.method,
          pathname: url.pathname,
          searchParams: url.searchParams,
        });
        createJsonResponse(response, result.statusCode, result.payload);
        return;
      }

      const result = await handlePageRequest({
        service,
        method: request.method,
        pathname: url.pathname,
        searchParams: url.searchParams,
      });
      createHtmlResponse(response, result.statusCode, result.body, result.headers);
    } catch (error) {
      if (error instanceof IncidentNotFoundError) {
        createHtmlResponse(
          response,
          404,
          renderHtmlErrorPage("Incident not found", error.message),
        );
        return;
      }

      createHtmlResponse(
        response,
        500,
        renderHtmlErrorPage("Unexpected error", "The dashboard request failed."),
      );
    }
  });
}
