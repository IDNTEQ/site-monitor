import { createServer } from "node:http";
import { URL } from "node:url";

import {
  createMonitorRepository,
  createNotificationChannelRepository
} from "./repositories.js";

export function createApp({ database, encryptionKey }) {
  const monitorRepository = createMonitorRepository(database, encryptionKey);
  const notificationChannelRepository = createNotificationChannelRepository(database, encryptionKey);

  return createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    try {
      if (request.method === "POST" && url.pathname === "/api/monitors") {
        const payload = await readJsonBody(request);
        const monitor = monitorRepository.create(payload);
        return sendJson(response, 201, monitor);
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/monitors/")) {
        const monitorId = url.pathname.replace("/api/monitors/", "");
        const monitor = monitorRepository.findById(monitorId);

        if (!monitor) {
          return sendJson(response, 404, { error: "Monitor not found." });
        }

        return sendJson(response, 200, monitor);
      }

      if (request.method === "POST" && url.pathname === "/api/notification-channels") {
        const payload = await readJsonBody(request);
        const channel = notificationChannelRepository.create(payload);
        return sendJson(response, 201, channel);
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/notification-channels/")) {
        const channelId = url.pathname.replace("/api/notification-channels/", "");
        const channel = notificationChannelRepository.findById(channelId);

        if (!channel) {
          return sendJson(response, 404, { error: "Notification channel not found." });
        }

        return sendJson(response, 200, channel);
      }

      return sendJson(response, 404, { error: "Route not found." });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}
