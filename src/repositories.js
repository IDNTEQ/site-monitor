import { randomUUID } from "node:crypto";

import { encryptSecret } from "./crypto.js";

export function createMonitorRepository(database, encryptionKey) {
  const insertMonitor = database.prepare(`
    INSERT INTO monitors (
      id,
      name,
      url,
      auth_type,
      auth_username,
      auth_secret_ciphertext,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const selectMonitor = database.prepare(`
    SELECT
      id,
      name,
      url,
      auth_type,
      auth_username,
      auth_secret_ciphertext,
      created_at
    FROM monitors
    WHERE id = ?
  `);

  return {
    create(input) {
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const auth = normalizeMonitorAuth(input.auth, encryptionKey);

      insertMonitor.run(
        id,
        input.name,
        input.url,
        auth.type,
        auth.username,
        auth.secretCiphertext,
        createdAt
      );

      return presentMonitor({
        id,
        name: input.name,
        url: input.url,
        auth_type: auth.type,
        auth_username: auth.username,
        auth_secret_ciphertext: auth.secretCiphertext,
        created_at: createdAt
      });
    },

    findById(id) {
      const row = selectMonitor.get(id);
      return row ? presentMonitor(row) : null;
    }
  };
}

export function createNotificationChannelRepository(database, encryptionKey) {
  const insertChannel = database.prepare(`
    INSERT INTO notification_channels (
      id,
      type,
      destination,
      credential_ciphertext,
      created_at
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const selectChannel = database.prepare(`
    SELECT
      id,
      type,
      destination,
      credential_ciphertext,
      created_at
    FROM notification_channels
    WHERE id = ?
  `);

  return {
    create(input) {
      const id = randomUUID();
      const createdAt = new Date().toISOString();

      if (!input.credentials?.secret) {
        throw new Error("Notification credentials.secret is required.");
      }

      const credentialCiphertext = encryptSecret(input.credentials.secret, encryptionKey);

      insertChannel.run(id, input.type, input.destination, credentialCiphertext, createdAt);

      return presentNotificationChannel({
        id,
        type: input.type,
        destination: input.destination,
        credential_ciphertext: credentialCiphertext,
        created_at: createdAt
      });
    },

    findById(id) {
      const row = selectChannel.get(id);
      return row ? presentNotificationChannel(row) : null;
    }
  };
}

function normalizeMonitorAuth(auth, encryptionKey) {
  if (!auth) {
    return {
      type: null,
      username: null,
      secretCiphertext: null
    };
  }

  if (!auth.type || !auth.secret) {
    throw new Error("Monitor auth requires both type and secret.");
  }

  return {
    type: auth.type,
    username: auth.username ?? null,
    secretCiphertext: encryptSecret(auth.secret, encryptionKey)
  };
}

function presentMonitor(row) {
  const hasSecret = Boolean(row.auth_secret_ciphertext);

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    createdAt: row.created_at,
    auth: row.auth_type
      ? {
          type: row.auth_type,
          username: row.auth_username,
          secretConfigured: hasSecret
        }
      : null
  };
}

function presentNotificationChannel(row) {
  return {
    id: row.id,
    type: row.type,
    destination: row.destination,
    createdAt: row.created_at,
    credentials: {
      secretConfigured: Boolean(row.credential_ciphertext)
    }
  };
}
