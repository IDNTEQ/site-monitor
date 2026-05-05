import http from "node:http";

import { InMemoryMonitorRepository } from "../repositories/in-memory-monitor-repository.js";
import {
  createMonitorService,
  IncidentNotFoundError,
  MonitorNotFoundError,
  MonitorValidationError,
} from "../services/monitor-service.js";
import {
  renderDashboardPage,
  renderHtmlErrorPage,
  renderIncidentDetailPage,
  renderMonitorDetailPage,
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

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const body = Buffer.concat(chunks).toString("utf8");
  const contentType = (request.headers["content-type"] ?? "").split(";")[0];

  if (contentType === "application/x-www-form-urlencoded") {
    return Object.fromEntries(new URLSearchParams(body));
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function htmlResult(statusCode, body, headers) {
  return {
    statusCode,
    contentType: "text/html; charset=utf-8",
    body,
    headers,
  };
}

function parseIntegerField(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function parseTagField(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildMonitorInputFromPageBody(body = {}) {
  return {
    name: body.name ?? "",
    environment: body.environment ?? "",
    url: body.url ?? "",
    method: body.method ?? "",
    intervalSeconds: parseIntegerField(body.intervalSeconds),
    timeoutMs: parseIntegerField(body.timeoutMs),
    expectedStatusMin: parseIntegerField(body.expectedStatusMin),
    expectedStatusMax: parseIntegerField(body.expectedStatusMax),
    keyword: body.keyword ?? "",
    tags: parseTagField(body.tags),
  };
}

export async function handleApiRequest({
  service,
  method,
  pathname,
  body,
  searchParams = new URLSearchParams(),
}) {
  if (method === "POST" && pathname === "/api/monitors") {
    const monitor = await service.createMonitor(body ?? {});
    return {
      statusCode: 201,
      payload: { monitor },
    };
  }

  const maintenanceWindowRouteMatch = pathname.match(
    /^\/api\/monitors\/([^/]+)\/maintenance-windows$/,
  );
  if (method === "POST" && maintenanceWindowRouteMatch) {
    const maintenanceWindow = await service.createMaintenanceWindow(
      maintenanceWindowRouteMatch[1],
      body ?? {},
    );
    return {
      statusCode: 201,
      payload: { maintenanceWindow },
    };
  }

  const previewRouteMatch = pathname.match(/^\/api\/monitors\/([^/]+)\/policy-preview$/);
  if (method === "POST" && previewRouteMatch) {
    const preview = await service.previewAlertDecision(
      previewRouteMatch[1],
      body ?? {},
    );
    return {
      statusCode: 200,
      payload: { preview },
    };
  }

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

  const incidentRouteMatch = pathname.match(/^\/api\/incidents\/([^/]+)$/);
  if (method === "GET" && incidentRouteMatch) {
    return {
      statusCode: 200,
      payload: await service.getIncidentDetail(incidentRouteMatch[1]),
    };
  }

  const incidentActionRouteMatch = pathname.match(/^\/api\/incidents\/([^/]+)\/actions$/);
  if (method === "POST" && incidentActionRouteMatch) {
    return {
      statusCode: 200,
      payload: await service.applyIncidentAction(incidentActionRouteMatch[1], body ?? {}),
    };
  }

  const monitorRouteMatch = pathname.match(/^\/api\/monitors\/([^/]+)$/);
  if (method === "PATCH" && monitorRouteMatch) {
    const monitor = await service.updateMonitor(monitorRouteMatch[1], body ?? {});
    return {
      statusCode: 200,
      payload: { monitor },
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
  body,
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

  if (method === "POST" && pathname === "/monitors") {
    try {
      const monitor = await service.createMonitor(buildMonitorInputFromPageBody(body));
      return htmlResult(303, "", {
        location: `/monitors/${monitor.id}`,
      });
    } catch (error) {
      if (!(error instanceof MonitorValidationError)) {
        throw error;
      }

      const dashboard = await service.getDashboard();
      return htmlResult(
        422,
        renderDashboardPage(dashboard, {}, {
          values: body ?? {},
          errors: error.fieldErrors,
        }),
      );
    }
  }

  const monitorRouteMatch = pathname.match(/^\/monitors\/([^/]+)$/);
  if (method === "GET" && monitorRouteMatch) {
    const detail = await service.getMonitorDetail(monitorRouteMatch[1]);
    return htmlResult(200, renderMonitorDetailPage(detail));
  }

  if (method === "POST" && monitorRouteMatch) {
    try {
      await service.updateMonitor(
        monitorRouteMatch[1],
        buildMonitorInputFromPageBody(body),
      );
      return htmlResult(303, "", {
        location: `/monitors/${monitorRouteMatch[1]}`,
      });
    } catch (error) {
      if (!(error instanceof MonitorValidationError)) {
        throw error;
      }

      const detail = await service.getMonitorDetail(monitorRouteMatch[1]);
      return htmlResult(
        422,
        renderMonitorDetailPage(detail, {
          values: body ?? {},
          errors: error.fieldErrors,
        }),
      );
    }
  }

  const monitorActionRouteMatch = pathname.match(/^\/monitors\/([^/]+)\/actions$/);
  if (method === "POST" && monitorActionRouteMatch) {
    try {
      await service.updateMonitor(monitorActionRouteMatch[1], {
        action: body?.action,
      });
      return htmlResult(303, "", {
        location: `/monitors/${monitorActionRouteMatch[1]}`,
      });
    } catch (error) {
      if (!(error instanceof MonitorValidationError)) {
        throw error;
      }

      const detail = await service.getMonitorDetail(monitorActionRouteMatch[1]);
      return htmlResult(
        422,
        renderMonitorDetailPage(detail, {
          errors: error.fieldErrors,
        }),
      );
    }
  }

  const incidentRouteMatch = pathname.match(/^\/incidents\/([^/]+)$/);
  if (method === "GET" && incidentRouteMatch) {
    const detail = await service.getIncidentDetail(incidentRouteMatch[1]);
    return htmlResult(200, renderIncidentDetailPage(detail));
  }

  const incidentActionRouteMatch = pathname.match(/^\/incidents\/([^/]+)\/actions$/);
  if (method === "POST" && incidentActionRouteMatch) {
    try {
      await service.applyIncidentAction(incidentActionRouteMatch[1], body ?? {});
      return htmlResult(303, "", {
        location: `/incidents/${incidentActionRouteMatch[1]}`,
      });
    } catch (error) {
      if (error instanceof MonitorValidationError) {
        const detail = await service.getIncidentDetail(incidentActionRouteMatch[1]);
        return htmlResult(
          422,
          renderIncidentDetailPage(detail, {
            actor: body?.actor ?? "",
            note: body?.note ?? "",
            errors: error.fieldErrors,
          }),
        );
      }

      throw error;
    }
  }

  return htmlResult(404, renderHtmlErrorPage("Page not found", "Route not found."));
}

export function createApp({
  service = createMonitorService({
    repository: new InMemoryMonitorRepository(),
  }),
} = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    try {
      const body = await readRequestBody(request);
      if (body === null) {
        createJsonResponse(response, 400, {
          error: "Request body must be valid JSON.",
        });
        return;
      }

      if (url.pathname.startsWith("/api")) {
        const result = await handleApiRequest({
          service,
          method: request.method,
          pathname: url.pathname,
          body,
          searchParams: url.searchParams,
        });
        createJsonResponse(response, result.statusCode, result.payload);
        return;
      }

      const result = await handlePageRequest({
        service,
        method: request.method,
        pathname: url.pathname,
        body,
        searchParams: url.searchParams,
      });
      createHtmlResponse(response, result.statusCode, result.body, result.headers);
    } catch (error) {
      if (error instanceof MonitorValidationError) {
        createJsonResponse(response, 422, {
          errors: error.fieldErrors,
        });
        return;
      }

      if (error instanceof MonitorNotFoundError) {
        createHtmlResponse(
          response,
          404,
          renderHtmlErrorPage("Monitor not found", error.message),
        );
        return;
      }

      if (error instanceof IncidentNotFoundError) {
        createHtmlResponse(
          response,
          404,
          renderHtmlErrorPage("Incident not found", error.message),
        );
        return;
      }

      createJsonResponse(response, 500, {
        error: "Internal server error.",
      });
    }
  });
}
