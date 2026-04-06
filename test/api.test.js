import test from "node:test";
import assert from "node:assert/strict";

import { createStore } from "../src/store.js";
import { handleRequest } from "../src/server.js";

async function dispatch({ method, url, body }, store = createStore()) {
  const response = {
    statusCode: 200,
    headers: {},
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(payload = "") {
      this.body = payload.toString();
    },
  };

  const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
  const request = {
    method,
    url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  };

  await handleRequest(request, response, store);

  return {
    statusCode: response.statusCode,
    headers: response.headers,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

test("incident actions API acknowledges and mutes incidents", async () => {
  const store = createStore();

  const acknowledgeResponse = await dispatch(
    {
      method: "POST",
      url: "/api/incidents/inc-204/actions",
      body: {
      action: "acknowledge",
      actor: "Morgan Lee",
      note: "Taking point on the outage.",
      at: "2026-04-06T09:18:00.000Z",
      },
    },
    store,
  );
  const acknowledged = acknowledgeResponse.json;

  assert.equal(acknowledgeResponse.statusCode, 200);
  assert.equal(acknowledged.state, "acknowledged");
  assert.equal(acknowledged.owner, "Morgan Lee");
  assert.equal(acknowledged.events[0].eventType, "acknowledged");

  const muteResponse = await dispatch(
    {
      method: "POST",
      url: "/api/incidents/inc-204/actions",
      body: {
      action: "mute",
      actor: "Morgan Lee",
      note: "Holding pages while rollback completes.",
      at: "2026-04-06T09:22:00.000Z",
      },
    },
    store,
  );
  const muted = muteResponse.json;

  assert.equal(muteResponse.statusCode, 200);
  assert.equal(muted.alertsMuted, true);
  assert.equal(muted.events[0].eventType, "muted");
});

test("incident actions API rejects missing actor metadata", async () => {
  const response = await dispatch({
    method: "POST",
    url: "/api/incidents/inc-204/actions",
    body: {
      action: "acknowledge",
      actor: "",
      note: "No actor supplied.",
    },
  });
  const payload = response.json;

  assert.equal(response.statusCode, 400);
  assert.match(payload.error, /Actor is required/);
});
