import test from "node:test";
import assert from "node:assert/strict";

import { IncidentRepository } from "../src/repositories/incident-repository.js";
import { getIncidentDetail } from "../src/services/get-incident-detail.js";

test("getIncidentDetail returns incident evidence and ordered timeline data", () => {
  const repository = new IncidentRepository();

  const detail = getIncidentDetail(repository, "inc-204");

  assert.ok(detail);
  assert.equal(detail.incident.status, "resolved");
  assert.equal(detail.incident.firstFailureAt, "2026-04-05T14:03:00Z");
  assert.deepEqual(
    detail.timeline.map((event) => event.label),
    [
      "Failure onset",
      "Notification delivery",
      "Notification delivery",
      "Acknowledged",
      "Recovered",
      "Manual resolution"
    ]
  );
  assert.equal(detail.latestCheckOutcomes[0].checkedAt, "2026-04-05T14:16:00Z");
  assert.equal(detail.latestCheckOutcomes[0].matchingRuleResult, "matched keyword");
  assert.equal(detail.deliveryHistory[0].channel, "PagerDuty");
  assert.equal(detail.deliveryHistory[0].deliveredAt, "2026-04-05T14:16:10Z");
});

test("getIncidentDetail returns null for unknown incidents", () => {
  const repository = new IncidentRepository();

  assert.equal(getIncidentDetail(repository, "inc-missing"), null);
});
