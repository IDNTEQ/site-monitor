import http from "node:http";

import { ValidationError } from "../domain/alertPolicy.js";
import { NotFoundError } from "../services/policyService.js";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json"
  });
  response.end(JSON.stringify(payload));
}

async function parseJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ValidationError("request body must be valid JSON.");
  }
}

function routeMatch(method, pathname, expression) {
  return method && pathname ? expression.exec(`${method} ${pathname}`) : null;
}

export function createHandler({ policyService }) {
  return async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const alertPolicyRoute = routeMatch(
      request.method,
      url.pathname,
      /^PATCH \/api\/monitors\/([^/]+)\/alert-policy$/
    );
    const maintenanceRoute = routeMatch(
      request.method,
      url.pathname,
      /^POST \/api\/monitors\/([^/]+)\/maintenance-windows$/
    );
    const previewRoute = routeMatch(
      request.method,
      url.pathname,
      /^POST \/api\/monitors\/([^/]+)\/policy-preview$/
    );

    try {
      if (alertPolicyRoute) {
        const body = await parseJsonBody(request);
        const result = await policyService.updateAlertPolicy(alertPolicyRoute[1], body);
        sendJson(response, 200, result);
        return;
      }

      if (maintenanceRoute) {
        const body = await parseJsonBody(request);
        const result = await policyService.createMaintenanceWindow(maintenanceRoute[1], body);
        sendJson(response, 201, result);
        return;
      }

      if (previewRoute) {
        const body = await parseJsonBody(request);
        const result = await policyService.previewDecision(previewRoute[1], body);
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof ValidationError) {
        sendJson(response, 400, {
          error: error.message,
          details: error.details ?? {}
        });
        return;
      }

      if (error instanceof NotFoundError) {
        sendJson(response, 404, { error: error.message });
        return;
      }

      sendJson(response, 500, { error: "Internal server error." });
    }
  };
}

export function createApp({ policyService }) {
  return http.createServer(createHandler({ policyService }));
}
