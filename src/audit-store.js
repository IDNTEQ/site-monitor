const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const RETENTION_DAYS = 90;

class AuditStore {
  constructor(options = {}) {
    const dbPath = options.dbPath ?? ':memory:';

    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS incident_action_audits (
        id TEXT PRIMARY KEY,
        incident_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS policy_change_audits (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL,
        change_type TEXT NOT NULL,
        actor TEXT NOT NULL,
        summary TEXT NOT NULL,
        before_value TEXT,
        after_value TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS incident_action_audits_incident_created_idx
        ON incident_action_audits (incident_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS policy_change_audits_policy_created_idx
        ON policy_change_audits (policy_id, created_at DESC);
    `);
  }

  close() {
    this.db.close();
  }

  recordIncidentAction(input) {
    const id = randomUUID();
    const incidentId = requireNonEmptyString(input.incidentId, 'incidentId');
    const actionType = requireNonEmptyString(input.actionType, 'actionType');
    const actor = requireNonEmptyString(input.actor, 'actor');
    const note = optionalString(input.note, 'note');
    const createdAt = normalizeTimestamp(input.occurredAt);

    this.db
      .prepare(`
        INSERT INTO incident_action_audits (
          id,
          incident_id,
          action_type,
          actor,
          note,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(id, incidentId, actionType, actor, note, createdAt);

    return this.getIncidentAction(id);
  }

  listIncidentActions(incidentId) {
    requireNonEmptyString(incidentId, 'incidentId');

    const rows = this.db
      .prepare(`
        SELECT
          id,
          incident_id,
          action_type,
          actor,
          note,
          created_at
        FROM incident_action_audits
        WHERE incident_id = ?
        ORDER BY created_at DESC, id DESC
      `)
      .all(incidentId);

    return rows.map(mapIncidentActionRow);
  }

  recordPolicyChange(input) {
    const id = randomUUID();
    const policyId = requireNonEmptyString(input.policyId, 'policyId');
    const changeType = requireNonEmptyString(input.changeType, 'changeType');
    const actor = requireNonEmptyString(input.actor, 'actor');
    const summary = requireNonEmptyString(input.summary, 'summary');
    const beforeValue = optionalJson(input.before);
    const afterValue = optionalJson(input.after);
    const createdAt = normalizeTimestamp(input.occurredAt);

    this.db
      .prepare(`
        INSERT INTO policy_change_audits (
          id,
          policy_id,
          change_type,
          actor,
          summary,
          before_value,
          after_value,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(id, policyId, changeType, actor, summary, beforeValue, afterValue, createdAt);

    return this.getPolicyChange(id);
  }

  listPolicyChanges(policyId) {
    requireNonEmptyString(policyId, 'policyId');

    const rows = this.db
      .prepare(`
        SELECT
          id,
          policy_id,
          change_type,
          actor,
          summary,
          before_value,
          after_value,
          created_at
        FROM policy_change_audits
        WHERE policy_id = ?
        ORDER BY created_at DESC, id DESC
      `)
      .all(policyId);

    return rows.map(mapPolicyChangeRow);
  }

  purgeExpiredRecords(options = {}) {
    const referenceTime = normalizeTimestamp(options.referenceTime);

    const deleteIncidentActions = this.db
      .prepare(`
        DELETE FROM incident_action_audits
        WHERE julianday(created_at) < julianday(?) - ?
      `)
      .run(referenceTime, RETENTION_DAYS);

    const deletePolicyChanges = this.db
      .prepare(`
        DELETE FROM policy_change_audits
        WHERE julianday(created_at) < julianday(?) - ?
      `)
      .run(referenceTime, RETENTION_DAYS);

    return {
      referenceTime,
      retentionDays: RETENTION_DAYS,
      incidentActionsDeleted: deleteIncidentActions.changes,
      policyChangesDeleted: deletePolicyChanges.changes
    };
  }

  getIncidentAction(id) {
    const row = this.db
      .prepare(`
        SELECT
          id,
          incident_id,
          action_type,
          actor,
          note,
          created_at
        FROM incident_action_audits
        WHERE id = ?
      `)
      .get(id);

    return row ? mapIncidentActionRow(row) : null;
  }

  getPolicyChange(id) {
    const row = this.db
      .prepare(`
        SELECT
          id,
          policy_id,
          change_type,
          actor,
          summary,
          before_value,
          after_value,
          created_at
        FROM policy_change_audits
        WHERE id = ?
      `)
      .get(id);

    return row ? mapPolicyChangeRow(row) : null;
  }
}

function mapIncidentActionRow(row) {
  return {
    id: row.id,
    incidentId: row.incident_id,
    actionType: row.action_type,
    actor: row.actor,
    note: row.note,
    occurredAt: row.created_at
  };
}

function mapPolicyChangeRow(row) {
  return {
    id: row.id,
    policyId: row.policy_id,
    changeType: row.change_type,
    actor: row.actor,
    summary: row.summary,
    before: parseJson(row.before_value),
    after: parseJson(row.after_value),
    occurredAt: row.created_at
  };
}

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function optionalString(value, fieldName) {
  if (value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string when provided`);
  }

  return value;
}

function optionalJson(value) {
  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function parseJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return JSON.parse(value);
}

function normalizeTimestamp(value) {
  const date = value === undefined ? new Date() : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error('occurredAt/referenceTime must be a valid ISO-8601 timestamp');
  }

  return date.toISOString();
}

module.exports = {
  AuditStore,
  RETENTION_DAYS
};
