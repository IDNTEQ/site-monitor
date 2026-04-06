import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createStore } from "./store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "..", "public");

function json(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

async function serveFile(response, filePath, contentType) {
  const body = await readFile(filePath);
  response.writeHead(200, {
    "Content-Type": contentType,
  });
  response.end(body);
}

async function parseJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function normaliseActionBody(body) {
  return {
    type: body.action,
    actor: body.actor ?? "",
    note: body.note ?? "",
    at: body.at ?? new Date().toISOString(),
  };
}

export async function handleRequest(request, response, store) {
  const url = new URL(request.url, "http://localhost");

  try {
    if (request.method === "GET" && url.pathname === "/api/incidents") {
      return json(response, 200, {
        incidents: store.listIncidents(),
      });
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/incidents/")) {
      const incidentId = url.pathname.split("/")[3];
      const incident = store.getIncident(incidentId);

      if (!incident) {
        return json(response, 404, {
          error: "Incident not found.",
        });
      }

      return json(response, 200, incident);
    }

    if (
      request.method === "POST" &&
      url.pathname.match(/^\/api\/incidents\/[^/]+\/actions$/)
    ) {
      const incidentId = url.pathname.split("/")[3];
      const incident = store.getIncident(incidentId);

      if (!incident) {
        return json(response, 404, {
          error: "Incident not found.",
        });
      }

      const body = await parseJson(request);
      const nextIncident = store.applyIncidentAction(
        incidentId,
        normaliseActionBody(body),
      );

      return json(response, 200, nextIncident);
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname.startsWith("/incidents/"))
    ) {
      return serveFile(
        response,
        path.join(publicDir, "index.html"),
        "text/html; charset=utf-8",
      );
    }

    if (request.method === "GET" && url.pathname === "/app.js") {
      return serveFile(
        response,
        path.join(publicDir, "app.js"),
        "text/javascript; charset=utf-8",
      );
    }

    if (request.method === "GET" && url.pathname === "/styles.css") {
      return serveFile(
        response,
        path.join(publicDir, "styles.css"),
        "text/css; charset=utf-8",
      );
    }

    return json(response, 404, {
      error: "Not found.",
    });
  } catch (error) {
    return json(response, 400, {
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  }
}

export function createApp(store = createStore()) {
  return createServer((request, response) => handleRequest(request, response, store));
}

export function startServer(port = Number(process.env.PORT ?? 3000)) {
  const app = createApp();
  app.listen(port, () => {
    process.stdout.write(
      `site-monitor incident action server listening on http://localhost:${port}\n`,
    );
  });
  return app;
}

if (process.argv[1] === __filename) {
  startServer();
}
