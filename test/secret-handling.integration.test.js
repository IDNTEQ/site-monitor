import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { randomBytes } from "node:crypto";

import { createApp } from "../src/app.js";
import { decryptSecret } from "../src/crypto.js";
import { openDatabase } from "../src/database.js";

test("monitor auth secrets are encrypted at rest and never returned after creation", async () => {
  const harness = await createHarness();

  try {
    const createResponse = await fetch(`${harness.baseUrl}/api/monitors`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Checkout API",
        url: "https://checkout.example.com/health",
        auth: {
          type: "basic",
          username: "monitor-bot",
          secret: "super-secret-password"
        }
      })
    });

    assert.equal(createResponse.status, 201);

    const createdMonitor = await createResponse.json();
    assert.deepEqual(createdMonitor.auth, {
      type: "basic",
      username: "monitor-bot",
      secretConfigured: true
    });
    assert.equal(JSON.stringify(createdMonitor).includes("super-secret-password"), false);

    const fetchResponse = await fetch(`${harness.baseUrl}/api/monitors/${createdMonitor.id}`);
    assert.equal(fetchResponse.status, 200);

    const storedMonitor = await fetchResponse.json();
    assert.deepEqual(storedMonitor.auth, createdMonitor.auth);
    assert.equal(JSON.stringify(storedMonitor).includes("super-secret-password"), false);

    const monitorRow = harness.database
      .prepare("SELECT auth_secret_ciphertext FROM monitors WHERE id = ?")
      .get(createdMonitor.id);

    assert.ok(monitorRow.auth_secret_ciphertext);
    assert.notEqual(monitorRow.auth_secret_ciphertext, "super-secret-password");
    assert.equal(decryptSecret(monitorRow.auth_secret_ciphertext, harness.encryptionKey), "super-secret-password");
  } finally {
    await harness.close();
  }
});

test("notification credentials are encrypted at rest and never returned after creation", async () => {
  const harness = await createHarness();

  try {
    const createResponse = await fetch(`${harness.baseUrl}/api/notification-channels`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        type: "webhook",
        destination: "https://notify.example.com/hooks/site-monitor",
        credentials: {
          secret: "notify-token-123"
        }
      })
    });

    assert.equal(createResponse.status, 201);

    const createdChannel = await createResponse.json();
    assert.deepEqual(createdChannel.credentials, {
      secretConfigured: true
    });
    assert.equal(JSON.stringify(createdChannel).includes("notify-token-123"), false);

    const fetchResponse = await fetch(`${harness.baseUrl}/api/notification-channels/${createdChannel.id}`);
    assert.equal(fetchResponse.status, 200);

    const storedChannel = await fetchResponse.json();
    assert.deepEqual(storedChannel.credentials, createdChannel.credentials);
    assert.equal(JSON.stringify(storedChannel).includes("notify-token-123"), false);

    const channelRow = harness.database
      .prepare("SELECT credential_ciphertext FROM notification_channels WHERE id = ?")
      .get(createdChannel.id);

    assert.ok(channelRow.credential_ciphertext);
    assert.notEqual(channelRow.credential_ciphertext, "notify-token-123");
    assert.equal(decryptSecret(channelRow.credential_ciphertext, harness.encryptionKey), "notify-token-123");
  } finally {
    await harness.close();
  }
});

async function createHarness() {
  const directory = mkdtempSync(join(tmpdir(), "site-monitor-secret-test-"));
  const databasePath = join(directory, "site-monitor.sqlite");
  const database = openDatabase(databasePath);
  const encryptionKey = randomBytes(32);
  const app = createApp({
    database,
    encryptionKey
  });

  app.listen(0);
  await once(app, "listening");

  const address = app.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected app to listen on an ephemeral TCP port.");
  }

  return {
    app,
    database,
    directory,
    encryptionKey,
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      await new Promise((resolve, reject) => {
        app.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
      database.close();
      rmSync(directory, { recursive: true, force: true });
    }
  };
}
