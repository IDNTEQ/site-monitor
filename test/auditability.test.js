const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const test = require('node:test');
const { AuditStore, RETENTION_DAYS } = require('../src/audit-store');
const { createHandler } = require('../src/create-app');

test('purgeExpiredRecords preserves the 90-day boundary for audit data', () => {
  const store = new AuditStore();

  try {
    store.recordIncidentAction({
      incidentId: 'inc-204',
      actionType: 'acknowledge',
      actor: 'oncall@example.com',
      note: 'older than retention',
      occurredAt: '2026-01-05T23:59:59.000Z'
    });
    store.recordIncidentAction({
      incidentId: 'inc-204',
      actionType: 'mute',
      actor: 'oncall@example.com',
      note: 'exactly at retention boundary',
      occurredAt: '2026-01-06T00:00:00.000Z'
    });
    store.recordPolicyChange({
      policyId: 'policy-primary',
      changeType: 'threshold-updated',
      actor: 'reliability@example.com',
      summary: 'older than retention',
      before: { failureThreshold: 2 },
      after: { failureThreshold: 3 },
      occurredAt: '2026-01-04T23:59:59.000Z'
    });
    store.recordPolicyChange({
      policyId: 'policy-primary',
      changeType: 'channels-updated',
      actor: 'reliability@example.com',
      summary: 'inside retention',
      before: { channels: ['email'] },
      after: { channels: ['email', 'pager'] },
      occurredAt: '2026-01-06T00:00:00.000Z'
    });

    const result = store.purgeExpiredRecords({
      referenceTime: '2026-04-06T00:00:00.000Z'
    });

    assert.deepEqual(result, {
      referenceTime: '2026-04-06T00:00:00.000Z',
      retentionDays: RETENTION_DAYS,
      incidentActionsDeleted: 1,
      policyChangesDeleted: 1
    });

    assert.deepEqual(store.listIncidentActions('inc-204').map((item) => item.note), [
      'exactly at retention boundary'
    ]);
    assert.deepEqual(store.listPolicyChanges('policy-primary').map((item) => item.summary), [
      'inside retention'
    ]);
  } finally {
    store.close();
  }
});

test('API exposes retained incident actions and policy changes', async () => {
  const store = new AuditStore();
  const handler = createHandler({ store });

  try {
    let response = await invokeJson(handler, 'POST', '/api/incidents/inc-204/actions', {
      actionType: 'acknowledge',
      actor: 'oncall@example.com',
      note: 'Investigating payment failures'
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.actionType, 'acknowledge');
    assert.equal(response.body.actor, 'oncall@example.com');

    response = await invokeJson(handler, 'GET', '/api/incidents/inc-204/actions');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.retentionDays, RETENTION_DAYS);
    assert.equal(response.body.items.length, 1);
    assert.equal(response.body.items[0].note, 'Investigating payment failures');

    response = await invokeJson(handler, 'POST', '/api/policies/policy-primary/changes', {
      changeType: 'channels-updated',
      actor: 'reliability@example.com',
      summary: 'Added pager escalation',
      before: { channels: ['email'] },
      after: { channels: ['email', 'pager'] }
    });

    assert.equal(response.statusCode, 201);
    assert.equal(response.body.summary, 'Added pager escalation');
    assert.deepEqual(response.body.after, { channels: ['email', 'pager'] });

    response = await invokeJson(handler, 'GET', '/api/policies/policy-primary/changes');
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.retentionDays, RETENTION_DAYS);
    assert.equal(response.body.items.length, 1);
    assert.deepEqual(response.body.items[0].before, { channels: ['email'] });
  } finally {
    store.close();
  }
});

async function invokeJson(handler, method, path, payload) {
  const bodyText = payload === undefined ? '' : JSON.stringify(payload);
  const request = Readable.from(bodyText ? [Buffer.from(bodyText)] : []);
  request.method = method;
  request.url = path;

  const response = createMockResponse();
  await handler(request, response);

  return {
    statusCode: response.statusCode,
    body: JSON.parse(response.bodyText)
  };
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    bodyText: '',
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(bodyText) {
      this.bodyText = bodyText;
    }
  };
}
