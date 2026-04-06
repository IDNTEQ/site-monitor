import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDatabase } from "./database.js";

const config = loadConfig();
const database = openDatabase(config.databasePath);
const app = createApp({
  database,
  encryptionKey: config.encryptionKey
});

app.listen(config.port, () => {
  process.stdout.write(`site-monitor listening on port ${config.port}\n`);
});
