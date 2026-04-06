const http = require('node:http');
const { RETENTION_DAYS } = require('./audit-store');

function createApp(options) {
  return http.createServer(createHandler(options));
}

function createHandler(options) {
  if (!options || !options.store) {
    throw new Error('createHandler requires a store');
  }

  const { store } = options;

  return async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const incidentMatch = url.pathname.match(/^\/api\/incidents\/([^/]+)\/actions$/);
      const policyMatch = url.pathname.match(/^\/api\/policies\/([^/]+)\/changes$/);

      if (request.method === 'POST' && incidentMatch) {
        const body = await readJsonBody(request);
        const record = store.recordIncidentAction({
          incidentId: decodeURIComponent(incidentMatch[1]),
          actionType: body.actionType,
          actor: body.actor,
          note: body.note,
          occurredAt: body.occurredAt
        });

        return writeJson(response, 201, record);
      }

      if (request.method === 'GET' && incidentMatch) {
        return writeJson(response, 200, {
          retentionDays: RETENTION_DAYS,
          items: store.listIncidentActions(decodeURIComponent(incidentMatch[1]))
        });
      }

      if (request.method === 'POST' && policyMatch) {
        const body = await readJsonBody(request);
        const record = store.recordPolicyChange({
          policyId: decodeURIComponent(policyMatch[1]),
          changeType: body.changeType,
          actor: body.actor,
          summary: body.summary,
          before: body.before,
          after: body.after,
          occurredAt: body.occurredAt
        });

        return writeJson(response, 201, record);
      }

      if (request.method === 'GET' && policyMatch) {
        return writeJson(response, 200, {
          retentionDays: RETENTION_DAYS,
          items: store.listPolicyChanges(decodeURIComponent(policyMatch[1]))
        });
      }

      return writeJson(response, 404, { error: 'Not found' });
    } catch (error) {
      const statusCode = error.statusCode ?? 400;
      return writeJson(response, statusCode, { error: error.message });
    }
  };
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const bodyText = Buffer.concat(chunks).toString('utf8');

  try {
    return JSON.parse(bodyText);
  } catch {
    const error = new Error('Request body must be valid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload));
}

module.exports = {
  createApp,
  createHandler
};
