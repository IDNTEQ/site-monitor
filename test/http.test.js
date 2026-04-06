import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { createRequestHandler } from "../src/http/create-server.js";

async function makeRequest(method, url) {
  const handler = createRequestHandler();
  const request = new EventEmitter();
  request.method = method;
  request.url = url;

  let statusCode = null;
  let headers = {};
  let body = "";

  const response = {
    writeHead(code, nextHeaders) {
      statusCode = code;
      headers = nextHeaders;
    },
    end(chunk = "") {
      body += chunk;
    }
  };

  handler(request, response);

  return {
    statusCode,
    headers,
    body
  };
}

test("GET /api/incidents/:incidentId returns incident detail JSON", async () => {
  const response = await makeRequest("GET", "/api/incidents/inc-204");
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.equal(payload.incident.affectedMonitor.name, "checkout-web");
  assert.equal(payload.latestCheckOutcomes[1].statusCode, 200);
  assert.equal(payload.latestCheckOutcomes[2].errorClass, "UpstreamHttpError");
  assert.equal(payload.timeline[0].label, "Failure onset");
});

test("GET /incidents/:incidentId renders incident detail page with evidence sections", async () => {
  const response = await makeRequest("GET", "/incidents/inc-204");

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /Latest Check Outcomes/);
  assert.match(response.body, /Delivery History/);
  assert.match(response.body, /Failure onset/);
  assert.match(response.body, /Manual resolution/);
  assert.match(response.body, /checkout\.example\.com\/health/);
});

test("GET /api/incidents/:incidentId returns 404 for unknown incidents", async () => {
  const response = await makeRequest("GET", "/api/incidents/missing");
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 404);
  assert.equal(payload.error, "incident_not_found");
});
