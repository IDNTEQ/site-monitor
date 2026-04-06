const ENCRYPTION_KEY_BYTES = 32;

export function loadConfig(env = process.env) {
  const port = Number.parseInt(env.PORT ?? "3000", 10);
  const databasePath = env.DATABASE_PATH ?? "./site-monitor.sqlite";
  const encryptionKey = decodeBase64Key(env.SITE_MONITOR_SECRET_KEY);

  return {
    port,
    databasePath,
    encryptionKey
  };
}

function decodeBase64Key(value) {
  if (!value) {
    throw new Error("SITE_MONITOR_SECRET_KEY must be set to a base64-encoded 32-byte key.");
  }

  const key = Buffer.from(value, "base64");

  if (key.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error("SITE_MONITOR_SECRET_KEY must decode to exactly 32 bytes.");
  }

  return key;
}
