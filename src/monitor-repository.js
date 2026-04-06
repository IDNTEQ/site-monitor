const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

function mapRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    method: row.method,
    intervalSeconds: row.interval_seconds,
    timeoutMs: row.timeout_ms,
    expectedStatusMin: row.expected_status_min,
    expectedStatusMax: row.expected_status_max,
    keywordMatch: row.keyword_match,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

class MonitorRepository {
  constructor(databasePath) {
    const directory = path.dirname(databasePath);
    fs.mkdirSync(directory, { recursive: true });
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS monitors (
        id TEXT PRIMARY KEY,
        name TEXT,
        url TEXT NOT NULL,
        method TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL,
        timeout_ms INTEGER NOT NULL,
        expected_status_min INTEGER NOT NULL,
        expected_status_max INTEGER NOT NULL,
        keyword_match TEXT,
        status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  close() {
    this.database.close();
  }

  create(monitor) {
    const statement = this.database.prepare(`
      INSERT INTO monitors (
        id,
        name,
        url,
        method,
        interval_seconds,
        timeout_ms,
        expected_status_min,
        expected_status_max,
        keyword_match,
        status,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    statement.run(
      monitor.id,
      monitor.name,
      monitor.url,
      monitor.method,
      monitor.intervalSeconds,
      monitor.timeoutMs,
      monitor.expectedStatusMin,
      monitor.expectedStatusMax,
      monitor.keywordMatch,
      monitor.status,
      monitor.createdAt,
      monitor.updatedAt
    );

    return this.getById(monitor.id);
  }

  getById(id) {
    const statement = this.database.prepare("SELECT * FROM monitors WHERE id = ?");
    return mapRow(statement.get(id));
  }

  listAll() {
    const statement = this.database.prepare("SELECT * FROM monitors ORDER BY created_at DESC");
    return statement.all().map(mapRow);
  }

  listScheduled() {
    const statement = this.database.prepare("SELECT * FROM monitors WHERE status = 'active' ORDER BY created_at DESC");
    return statement.all().map(mapRow);
  }

  update(id, changes) {
    const fields = [];
    const values = [];

    const mapping = [
      ["name", "name"],
      ["url", "url"],
      ["method", "method"],
      ["intervalSeconds", "interval_seconds"],
      ["timeoutMs", "timeout_ms"],
      ["expectedStatusMin", "expected_status_min"],
      ["expectedStatusMax", "expected_status_max"],
      ["keywordMatch", "keyword_match"],
      ["status", "status"],
      ["updatedAt", "updated_at"]
    ];

    for (const [sourceKey, columnName] of mapping) {
      if (Object.prototype.hasOwnProperty.call(changes, sourceKey)) {
        fields.push(`${columnName} = ?`);
        values.push(changes[sourceKey]);
      }
    }

    if (fields.length === 0) {
      return this.getById(id);
    }

    const statement = this.database.prepare(`UPDATE monitors SET ${fields.join(", ")} WHERE id = ?`);
    statement.run(...values, id);
    return this.getById(id);
  }
}

module.exports = {
  MonitorRepository
};
