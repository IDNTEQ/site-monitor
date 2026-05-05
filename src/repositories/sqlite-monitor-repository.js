import Database from "better-sqlite3";

function serialize(value) {
  return JSON.stringify(value);
}

function deserialize(value) {
  return JSON.parse(value);
}

export class SqliteMonitorRepository {
  constructor({ filename }) {
    if (typeof filename !== "string" || filename.length === 0) {
      throw new Error("SqliteMonitorRepository requires a filename.");
    }

    this.database = new Database(filename);
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS monitors (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS worker_runs (
        id TEXT PRIMARY KEY,
        checked_at TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS worker_runs_checked_at_idx
        ON worker_runs (checked_at);
    `);

    this.statements = {
      upsertMonitor: this.database.prepare(`
        INSERT INTO monitors (id, data)
        VALUES (@id, @data)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
      `),
      getMonitorById: this.database.prepare(
        "SELECT data FROM monitors WHERE id = ?",
      ),
      listMonitors: this.database.prepare(
        "SELECT data FROM monitors ORDER BY rowid",
      ),
      appendWorkerRun: this.database.prepare(`
        INSERT INTO worker_runs (id, checked_at, data)
        VALUES (@id, @checkedAt, @data)
        ON CONFLICT(id) DO UPDATE SET
          checked_at = excluded.checked_at,
          data = excluded.data
      `),
      listWorkerRuns: this.database.prepare(
        "SELECT data FROM worker_runs ORDER BY rowid",
      ),
    };
  }

  async create(monitor) {
    const stored = deserialize(serialize(monitor));
    this.statements.upsertMonitor.run({
      id: stored.id,
      data: serialize(stored),
    });
    return deserialize(serialize(stored));
  }

  async getById(monitorId) {
    const row = this.statements.getMonitorById.get(monitorId);
    return row ? deserialize(row.data) : null;
  }

  async update(monitor) {
    const stored = deserialize(serialize(monitor));
    this.statements.upsertMonitor.run({
      id: stored.id,
      data: serialize(stored),
    });
    return deserialize(serialize(stored));
  }

  async list() {
    return this.statements.listMonitors.all().map((row) => deserialize(row.data));
  }

  async appendWorkerRun(workerRun) {
    const stored = deserialize(serialize(workerRun));
    this.statements.appendWorkerRun.run({
      id: stored.id,
      checkedAt: stored.checkedAt,
      data: serialize(stored),
    });
    return deserialize(serialize(stored));
  }

  async listWorkerRuns() {
    return this.statements.listWorkerRuns.all().map((row) => deserialize(row.data));
  }

  close() {
    this.database.close();
  }
}
