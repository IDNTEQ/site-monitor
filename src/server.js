const { AuditStore } = require('./audit-store');
const { createApp } = require('./create-app');

const port = Number(process.env.PORT ?? 3000);
const dbPath = process.env.DB_PATH ?? ':memory:';

const store = new AuditStore({ dbPath });
const server = createApp({ store });

server.listen(port, () => {
  process.stdout.write(`site-monitor audit API listening on :${port}\n`);
});

function shutdown() {
  server.close(() => {
    store.close();
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
