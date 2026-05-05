import http from "node:http";
import https from "node:https";

const DEFAULT_TIMEOUT_MS = 5000;

function createErrorClass(error) {
  return error?.name ?? "Error";
}

function realHttpPost(url, body, {
  headers = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const payload = JSON.stringify(body);
    const client = parsedUrl.protocol === "https:" ? https : http;
    const request = client.request(
      parsedUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode ?? 0,
          });
        });
      },
    );

    request.on("timeout", () => {
      const error = new Error("Webhook delivery timed out.");
      error.name = "TimeoutError";
      request.destroy(error);
    });
    request.on("error", reject);
    request.end(payload);
  });
}

function normalizeHttpPostResult(result) {
  if (typeof result === "number") {
    return {
      statusCode: result,
    };
  }

  return {
    statusCode: result?.statusCode ?? 0,
  };
}

export function createAlertDeliveryService({
  httpPost = realHttpPost,
  now = () => new Date(),
} = {}) {
  async function deliver({ monitor, incident, eventType }) {
    const endpoints = (monitor.alertPolicy?.endpoints ?? []).filter(
      (endpoint) => endpoint.type === "webhook",
    );
    if (endpoints.length === 0) {
      return [];
    }

    const payload = {
      eventType,
      monitorId: monitor.id,
      monitorName: monitor.name,
      incidentId: incident.id,
      openedAt: incident.openedAt,
      url: monitor.url,
    };
    const deliveryRecords = [];

    for (const endpoint of endpoints) {
      const deliveredAt = now().toISOString();
      try {
        const result = normalizeHttpPostResult(
          await httpPost(endpoint.url, payload, {
            timeoutMs: endpoint.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          }),
        );
        deliveryRecords.push({
          endpointId: endpoint.id,
          eventType,
          deliveredAt,
          statusCode: result.statusCode,
        });
      } catch (error) {
        deliveryRecords.push({
          endpointId: endpoint.id,
          eventType,
          deliveredAt,
          statusCode: 0,
          errorClass: createErrorClass(error),
        });
      }
    }

    incident.deliveryHistory = [
      ...(incident.deliveryHistory ?? []),
      ...deliveryRecords,
    ];
    return deliveryRecords;
  }

  return {
    deliver,
  };
}
