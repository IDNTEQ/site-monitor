const http = require("node:http");
const path = require("node:path");
const { MonitorRepository } = require("./monitor-repository");
const { MonitorService } = require("./monitor-service");
const { createApp } = require("./app");

const databasePath = process.env.SITE_MONITOR_DB_PATH || path.join(process.cwd(), "data", "site-monitor.sqlite");
const repository = new MonitorRepository(databasePath);
const monitorService = new MonitorService(repository);
const app = createApp({ monitorService });
const server = http.createServer(app);
const port = Number.parseInt(process.env.PORT || "3000", 10);

server.listen(port, () => {
  // Simple startup log for local development.
  console.log(`site-monitor listening on http://localhost:${port}`);
});

process.on("SIGINT", () => {
  repository.close();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  repository.close();
  server.close(() => process.exit(0));
});
